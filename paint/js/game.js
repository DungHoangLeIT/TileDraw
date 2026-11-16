/* Tô Tranh: nối luật chơi (PaintCore) với giao diện, diễn hoạt và âm thanh. */
(function () {
  const { Round, LEVELS, TRAY_SIZE, GRID, VISIBLE } = PaintCore;
  const { COLORS, PICTURES, ICONS, GLYPHS, DROP, regionCounts, pictureSVG } = PaintArt;

  const TILE_RATIO = 1.12;
  const MAX_TILE = 62;
  const GAP_X = 18; // ô cách xa nhau để thẻ đung đưa không chạm nhau
  const GAP_Y = 12; // chừa chỗ cho đầu chốt vàng nhô lên trên mỗi thẻ
  const STEP_K = 0.11; // mỗi lớp thẻ nằm thấp hơn lớp ngoài một đoạn bằng chừng này chiều cao thẻ, dọc theo móc thẳng đứng
  const HOLE = 0.14; // vị trí lỗ treo tính theo chiều cao thẻ
  const SWING_PERIOD = 1.7; // mọi thẻ cùng nhịp, chỉ khác biên độ và pha
  const STORE_LEVEL = 'to-tranh.level';
  const STORE_SOUND = 'to-tranh.sound';
  const STORE_SEEN = 'to-tranh.seen';

  const $ = (id) => document.getElementById(id);
  const el = {
    stage: $('stage'), decor: $('decor'), picMount: $('picMount'),
    board: $('board'), tray: $('tray'), tiles: $('tiles'), hooks: $('hooks'), gates: $('gates'), fx: $('fx'), shelfBar: $('shelfBar'),
    panel: $('panel'), panelTitle: $('panelTitle'), panelBody: $('panelBody'), panelActions: $('panelActions'),
    levelNum: $('levelNum'), tilesLeft: $('tilesLeft'), paintProgress: $('paintProgress'),
    undo: $('undoBtn'), shuffle: $('shuffleBtn'), pull: $('pullBtn'),
    sound: $('soundBtn'), restart: $('restartBtn'), prev: $('prevBtn'), next: $('nextBtn'),
  };

  let round = null;
  let levelIndex = 0;
  let tileEls = []; // thẻ trong hộp chưa có phần tử; tạo khi phát ra board
  let regionEls = {}; // màu -> danh sách vùng theo thứ tự tô
  let metrics = null;
  let visualTray = null; // thứ tự khay đang hiển thị khi 3 thẻ vừa khớp chưa kịp biến mất
  let session = 0; // tăng khi đổi màn để hủy các hẹn giờ còn treo
  let pendingFlights = 0;
  let shownPainted = {};
  let inputLocked = false;
  let celebrated = false;

  function later(fn, ms) {
    const mine = session;
    setTimeout(() => { if (mine === session) fn(); }, ms);
  }

  function storeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* trình duyệt chặn lưu trữ: chơi tiếp bình thường */ }
  }

  /* ---------- Âm thanh tổng hợp bằng WebAudio, không cần file ---------- */
  const sound = {
    on: storeGet(STORE_SOUND) !== 'off',
    ctx: null,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    },
    tone(freq, dur, type = 'sine', vol = 0.12, delay = 0, slideTo = null) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },
    tap() { this.tone(520, 0.07, 'triangle', 0.1); },
    denied() { this.tone(170, 0.1, 'square', 0.04); },
    match() { [660, 880, 1100].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, i * 0.05)); },
    whoosh() { this.tone(300, 0.42, 'sine', 0.05, 0, 1100); },
    splash() {
      this.tone(900, 0.18, 'sine', 0.1, 0, 300);
      this.tone(1500, 0.1, 'triangle', 0.05, 0.04);
    },
    deal() { for (let i = 0; i < 6; i++) this.tone(380 + i * 60, 0.05, 'triangle', 0.05, i * 0.05); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.11, i * 0.11)); },
    unlocked() { [880, 1320].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.09, i * 0.07)); },
    crack() { this.tone(1800, 0.05, 'square', 0.03); this.tone(1300, 0.06, 'square', 0.03, 0.04); },
    shatter() { [2000, 2600, 3200, 2300].forEach((f, i) => this.tone(f, 0.07, 'triangle', 0.05, i * 0.03)); },
    open() { [392, 523, 784].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.09, i * 0.07)); },
    curtain() { this.tone(520, 0.2, 'sine', 0.05, 0, 260); },
    boom() { this.tone(150, 0.45, 'sawtooth', 0.1, 0, 45); },
    lose() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.26, 'sawtooth', 0.05, i * 0.16)); },
  };

  function renderSoundIcon() {
    el.sound.innerHTML = sound.on ? ICONS.soundOn : ICONS.soundOff;
  }

  /* ---------- Tọa độ ---------- */
  function rectIn(node) {
    const s = el.stage.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    return { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
  }

  function computeMetrics() {
    const board = rectIn(el.board);
    const slots = [...el.tray.children].map(rectIn);
    const slotW = slots[0].width;
    const slotH = slots[0].height;
    const reserve = round.shelf.length ? slotH + 22 : 0;
    const availW = board.width - 44 - GAP_X * (GRID - 1);
    const availH = board.height - 38 - reserve - GAP_Y * (GRID - 1);
    const depthRoom = 1 + (VISIBLE - 1) * STEP_K; // một hàng cao bằng thẻ ngoài cùng cộng phần thò ra của 2 lớp sau
    const tileW = Math.floor(Math.min(availW / GRID, availH / (GRID * TILE_RATIO * depthRoom), MAX_TILE));
    const tileH = Math.round(tileW * TILE_RATIO);
    const step = Math.round(tileH * STEP_K);
    const rowH = tileH + (VISIBLE - 1) * step;
    const gridW = GRID * tileW + GAP_X * (GRID - 1);
    const gridH = GRID * rowH + GAP_Y * (GRID - 1);
    return {
      step, rowH,
      tileW, tileH, slots, slotW, slotH, board,
      shelfBase: board.top + board.height + 14,
      originX: board.left + (board.width - gridW) / 2,
      originY: board.top + (board.height - reserve - gridH) / 2 + 5,
      trayScale: slotW / tileW,
    };
  }

  function positionFor(tile) {
    const m = metrics;
    if (tile.zone === 'board') {
      const col = tile.cell % GRID;
      const row = Math.floor(tile.cell / GRID);
      const stack = round.cells[tile.cell];
      const level = stack.indexOf(tile.id);
      // Thẻ ngoài cùng nằm cao nhất ở đầu móc; mỗi lớp sau thấp hơn một nấc. Thẻ chưa hiện nằm cùng chỗ lớp 3.
      const depth = Math.min(VISIBLE - 1, stack.length - 1 - level);
      return {
        x: m.originX + col * (m.tileW + GAP_X),
        y: m.originY + row * (m.rowH + GAP_Y) + depth * m.step,
        s: 1,
        z: 10 + level,
      };
    }
    if (tile.zone === 'shelf') {
      const i = round.shelf.indexOf(tile.id);
      const gap = 6;
      const left = m.board.left + (m.board.width - (3 * m.slotW + 2 * gap)) / 2;
      return { x: left + i * (m.slotW + gap), y: m.shelfBase - m.slotH - 14, s: m.trayScale, z: 4000 + i };
    }
    const order = visualTray || round.tray;
    const i = Math.max(0, order.indexOf(tile.id));
    const slot = m.slots[Math.min(i, TRAY_SIZE - 1)];
    return { x: slot.left, y: slot.top, s: m.trayScale, z: 5000 + i };
  }

  function place(tile) {
    const node = tileEls[tile.id];
    if (!node) return;
    const p = positionFor(tile);
    node.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.s})`;
    node.style.zIndex = p.z;
  }

  function placeTray() {
    (visualTray || round.tray).forEach((id) => place(round.tiles[id]));
  }

  function layoutAll(animate) {
    // Khi có kệ tạm thì thu nhỏ tranh, nhường chỗ để thẻ trên board không bị nhỏ đi.
    el.stage.classList.toggle('shelf-on', round.shelf.length > 0);
    metrics = computeMetrics();
    el.stage.style.setProperty('--tw', `${metrics.tileW}px`);
    el.stage.style.setProperty('--th', `${metrics.tileH}px`);
    el.stage.style.setProperty('--step', `${metrics.step}px`);
    el.stage.style.setProperty('--sh', `${metrics.rowH}px`);

    const shelfOn = round.shelf.length > 0;
    el.shelfBar.classList.toggle('on', shelfOn);
    if (shelfOn) {
      el.shelfBar.style.width = `${3 * metrics.slotW + 24}px`;
      el.shelfBar.style.height = `${metrics.slotH + 10}px`;
      el.shelfBar.style.top = `${metrics.shelfBase - metrics.slotH - 19}px`;
    }

    // Mỗi ô có một cái móc xuyên qua lỗ của cả chồng thẻ.
    [...el.hooks.children].forEach((hook, cell) => {
      const x = metrics.originX + (cell % GRID) * (metrics.tileW + GAP_X) + metrics.tileW / 2;
      const y = metrics.originY + Math.floor(cell / GRID) * (metrics.rowH + GAP_Y) + metrics.tileH * HOLE;
      hook.style.transform = `translate(${x}px, ${y}px)`;
      hook.hidden = round.holes[cell];
      el.rods.children[cell].style.transform = `translate(${x}px, ${y}px)`;
      el.rods.children[cell].hidden = round.holes[cell];
      el.gates.children[cell].style.transform = `translate(${x - metrics.tileW / 2}px, ${y - metrics.tileH * HOLE}px)`;
    });

    round.tiles.forEach((t) => {
      const node = tileEls[t.id];
      if (!node || (t.zone === 'gone' && !(visualTray && visualTray.includes(t.id)))) return;
      if (!animate) node.classList.add('no-anim');
      place(t);
    });
    if (!animate) {
      void el.tiles.offsetWidth;
      tileEls.forEach((n) => n && n.classList.remove('no-anim'));
    }
  }

  /* ---------- Thẻ và phát thẻ từ hộp ---------- */
  const PADLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#8a5a0e" stroke-width="4.2" stroke-linecap="round"/><path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#ffe9a0" stroke-width="2" stroke-linecap="round"/><rect x="3.5" y="10" width="17" height="12.5" rx="3.2" fill="#ffc531" stroke="#8a5a0e" stroke-width="1.6"/><rect x="5.3" y="11.6" width="13.4" height="3.4" rx="1.7" fill="#fff3b0" opacity=".8"/></svg>';

  function setFace(node, color) {
    node.style.setProperty('--c', COLORS[color].hex);
    node.setAttribute('aria-label', `Thẻ ${COLORS[color].label}`);
    const dot = node.querySelector('.dot');
    if (dot && dot.dataset.g !== color) {
      dot.innerHTML = GLYPHS[color] || '';
      dot.dataset.g = color;
    }
  }

  /** Vẽ mặt thẻ theo trạng thái hiện tại: thẻ úp, thẻ khóa (kèm số bộ còn thiếu), thẻ băng (nguyên hoặc đã nứt). */
  function applyFace(tile) {
    const node = tileEls[tile.id];
    if (!node) return;
    const onBoard = tile.zone === 'board';
    const mystery = onBoard && round.hidden[tile.id];
    const lock = onBoard ? round.lock[tile.id] : 0;
    const ice = onBoard ? round.ice[tile.id] : 0;
    node.classList.toggle('mystery', mystery);
    node.classList.toggle('locked', lock > 0);
    node.classList.toggle('iced', ice > 0);
    node.classList.toggle('cracked', ice === 1);
    const timer = onBoard ? round.timer[tile.id] : 0;
    const keyed = onBoard && round.key[tile.id];
    node.classList.toggle('keyed', keyed);
    node.classList.toggle('timed', timer > 0);
    node.classList.toggle('urgent', timer > 0 && timer <= 3);
    if (mystery) {
      node.style.setProperty('--c', '#2748b8');
      node.setAttribute('aria-label', 'Thẻ úp, chưa biết màu');
    } else {
      setFace(node, tile.color);
      if (lock > 0) node.setAttribute('aria-label', `Thẻ ${COLORS[tile.color].label}, khóa, mở sau ${lock} bộ`);
      if (ice > 0) node.setAttribute('aria-label', `Thẻ ${COLORS[tile.color].label}, đóng băng`);
      if (keyed) node.setAttribute('aria-label', `Thẻ ${COLORS[tile.color].label}, có chìa khóa mở rương`);
      if (timer > 0) node.setAttribute('aria-label', `Thẻ ${COLORS[tile.color].label}, hẹn giờ, còn ${timer} lượt`);
    }
    node.querySelector('.mod b').textContent = lock > 0 ? lock : timer > 0 ? timer : '';
  }

  function createTile(tile, fromBox) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'tile no-anim';
    node.dataset.id = tile.id;
    node.innerHTML = `<span class="swing"><span class="face"><i class="dot"></i><span class="mod">${PADLOCK}<b></b></span></span></span>`;
    tileEls[tile.id] = node;
    applyFace(tile);
    // Cùng chu kỳ, khác biên độ và lệch pha, nên thẻ phía sau lần lượt lộ ra.
    // Mỗi thẻ có biên độ và tốc độ riêng, giữ nguyên suốt màn; lắc đều quanh phương thẳng đứng, trái phải bằng nhau.
    node.style.setProperty('--amp', `${(5 + Math.random() * 6).toFixed(1)}deg`);
    node.style.setProperty('--swing', `${(0.85 + Math.random() * 0.75).toFixed(2)}s`);
    node.style.setProperty('--phase', `${(-Math.random() * SWING_PERIOD * 2).toFixed(2)}s`);
    const s = 0.3;
    const x = fromBox.left + fromBox.width / 2 - (metrics.tileW * s) / 2;
    const y = fromBox.top + fromBox.height / 2 - (metrics.tileH * s) / 2;
    node.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    node.style.zIndex = 6000;
    el.tiles.appendChild(node);
    tileEls[tile.id] = node;
    return node;
  }

  /** Đầu màn: thẻ tỏa từ giữa board ra các móc. Thẻ nằm dưới lớp thứ 3 chưa hiện. */
  function animateDeal(placed) {
    const fromBox = rectIn(el.board);
    const nodes = placed.map((p) => createTile(round.tiles[p.id], fromBox));
    void el.tiles.offsetWidth;
    const step = Math.min(16, 420 / placed.length);
    placed.forEach((p, i) => {
      const node = nodes[i];
      node.classList.remove('no-anim');
      node.classList.add('blocked', 'hang');
      const stack = round.cells[p.cell];
      if (stack.length - 1 - stack.indexOf(p.id) >= VISIBLE) node.classList.add('under');
      node.style.transitionDelay = `${Math.round(i * step)}ms`;
      place(round.tiles[p.id]);
    });
    inputLocked = true;
    refreshControls();
    later(() => {
      nodes.forEach((n) => { n.style.transitionDelay = ''; });
      inputLocked = false;
      refreshAll();
    }, placed.length * step + 280);
  }

  /* ---------- Tranh và bảng màu ---------- */
  function buildPicture() {
    el.picMount.innerHTML = pictureSVG(LEVELS[levelIndex].picture);
    regionEls = {};
    el.picMount.querySelectorAll('.region').forEach((node) => {
      (regionEls[node.dataset.color] = regionEls[node.dataset.color] || []).push(node);
    });
  }

  const shownTotal = () => Object.values(shownPainted).reduce((a, b) => a + b, 0);

  function updateHud() {
    el.levelNum.textContent = levelIndex + 1;
    el.prev.disabled = levelIndex === 0;
    el.next.disabled = levelIndex === LEVELS.length - 1;
    el.tilesLeft.textContent = round.tiles.filter((t) => t.zone !== 'gone').length;
    el.paintProgress.textContent = `${shownTotal()}/${round.regionsTotal}`;
    el.tray.classList.toggle('danger', round.tray.length >= TRAY_SIZE - 1 && round.status === 'playing');
  }

  function refreshControls() {
    const b = round.boosters;
    const idle = round.status === 'playing' && !inputLocked;
    el.undo.querySelector('em').textContent = b.undo;
    el.shuffle.querySelector('em').textContent = b.shuffle;
    el.pull.querySelector('em').textContent = b.pull;
    el.undo.disabled = !idle || !round.canUndo();
    el.shuffle.disabled = !idle || !round.canShuffle();
    el.pull.disabled = !idle || !round.canPull();
  }

  function refreshBlocked() {
    round.tiles.forEach((t) => {
      const node = tileEls[t.id];
      if (!node || t.zone === 'gone') return;
      const onBoard = t.zone === 'board';
      // Thẻ bị che hoặc nằm sau móc bị chặn thì tối đi; thẻ khóa và thẻ băng ngoài cùng vẫn sáng để nhìn rõ.
      const reachable = round.isTop(t.id) && round.barrier(t.cell) === '';
      node.classList.toggle('blocked', onBoard && !reachable);
      node.classList.toggle('hang', onBoard);
      // Mỗi móc chỉ hiện 3 lớp ngoài cùng: lớp 1 và 2 đung đưa và giữ đúng màu, lớp 3 đứng yên và tối hơn.
      // Thẻ nằm dưới lớp 3 chưa hiện; khi lớp trên được lấy đi thì đùn lên thành lớp 3.
      if (onBoard) {
        const stack = round.cells[t.cell];
        const depth = Math.min(VISIBLE, stack.length - 1 - stack.indexOf(t.id));
        if (node.dataset.depth !== String(depth)) {
          const wasUnder = node.classList.contains('under');
          // Lớp trên được lấy đi: thẻ trượt lên một nấc dọc theo móc.
          if (node.dataset.depth !== undefined) place(t);
          node.dataset.depth = depth;
          node.classList.toggle('under', depth >= VISIBLE);
          if (wasUnder && depth < VISIBLE) {
            node.classList.add('rise');
            later(() => node.classList.remove('rise'), 420);
          }
        }
      } else {
        node.classList.remove('under', 'rise');
        delete node.dataset.depth;
      }
      applyFace(t);
    });
    [...el.gates.children].forEach((gate, cell) => {
      // Thanh gỗ (số vùng còn phải tô), rương (chờ chìa khóa), rèm (số lượt nữa thì đóng hoặc mở).
      const kind = round.barrier(cell);
      const curtain = round.blink[cell] >= 0;
      gate.hidden = !kind && !curtain;
      gate.className = `gate ${kind || (curtain ? 'curtain-open' : '')}`;
      gate.querySelector('em').textContent = kind === 'gate' ? round.gateLeft(cell) : curtain ? round.curtainIn(cell) : '';
    });
    animateChanges();
  }

  /* ---------- Diễn hoạt cho blocker: so trạng thái trước và sau mỗi nước đi rồi diễn phần thay đổi ---------- */
  let prevState = null;
  let lastPick = null; // { cell, key }: thẻ vừa lấy khỏi board, để chìa khóa bay từ đúng chỗ đó tới rương

  function cellBox(cell) {
    return {
      x: metrics.originX + (cell % GRID) * (metrics.tileW + GAP_X),
      y: metrics.originY + Math.floor(cell / GRID) * (metrics.rowH + GAP_Y),
    };
  }

  /** Một mảnh hiệu ứng tạm, to bằng một thẻ, đặt tại ô cell; tự xóa sau ms. */
  function ghost(cell, cls, html, ms) {
    const b = cellBox(cell);
    const g = document.createElement('div');
    g.className = `ghost ${cls}`;
    g.innerHTML = html || '';
    g.style.left = `${b.x}px`;
    g.style.top = `${b.y}px`;
    el.fx.appendChild(g);
    setTimeout(() => g.remove(), ms);
    return g;
  }

  function replay(node, cls, ms) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  }

  const GATE_HTML = (kind) => `<div class="gate ${kind}"><b><i></i><em></em></b></div>`;

  function openChest(cell) {
    const g = ghost(cell, 'g-chest', GATE_HTML('chest'), 1500);
    let delay = 0;
    if (lastPick && lastPick.key) {
      // Chìa khóa bay từ thẻ vừa lấy tới ổ khóa của rương.
      const from = cellBox(lastPick.cell);
      const to = cellBox(cell);
      const key = ghost(lastPick.cell, 'g-key', '', 560);
      void key.offsetWidth;
      key.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) rotate(360deg)`;
      delay = 440;
    }
    later(() => {
      g.classList.add('open');
      burst(cellBox(cell).x + metrics.tileW / 2, cellBox(cell).y + metrics.tileH / 2, '#f2c230', 12);
      sound.open();
    }, delay);
  }

  function snapshot() {
    const cells = [...Array(GRID * GRID).keys()];
    return {
      lock: round.lock.slice(), ice: round.ice.slice(), timer: round.timer.slice(), hidden: round.hidden.slice(),
      kind: cells.map((c) => round.barrier(c)),
      left: cells.map((c) => round.gateLeft(c)),
      turn: cells.map((c) => round.curtainIn(c)),
    };
  }

  function animateChanges() {
    const now = snapshot();
    const was = prevState;
    prevState = now;
    if (!was || !metrics) return;
    const mid = (cell) => [cellBox(cell).x + metrics.tileW / 2, cellBox(cell).y + metrics.tileH / 2];
    round.tiles.forEach((t) => {
      const node = tileEls[t.id];
      if (!node) return;
      const id = t.id;
      if (t.zone !== 'board') {
        if (was.hidden[id] && !now.hidden[id]) replay(node, 'reveal', 340); // thẻ úp lật ngửa
        return;
      }
      const num = node.querySelector('.mod b');
      if (was.lock[id] > now.lock[id]) {
        if (now.lock[id] > 0) { replay(num, 'pop', 320); replay(node, 'rattle', 320); }
        else {
          ghost(t.cell, 'g-lock', PADLOCK, 700);
          burst(...mid(t.cell), '#f2c230', 8);
          replay(node, 'freed', 420);
          sound.unlocked();
        }
      }
      if (was.ice[id] > now.ice[id]) {
        if (now.ice[id] > 0) {
          replay(node, 'rattle', 320);
          burst(...mid(t.cell), '#eefaff', 5);
          sound.crack();
        } else {
          ghost(t.cell, 'g-ice', '', 520);
          burst(...mid(t.cell), '#bfe6ff', 12);
          replay(node, 'freed', 420);
          sound.shatter();
        }
      }
      if (now.timer[id] > 0 && now.timer[id] !== was.timer[id]) replay(num, 'pop', 320);
      if (was.timer[id] > 0 && now.timer[id] === 0 && round.boom === id) {
        ghost(t.cell, 'g-boom', '', 720);
        replay(node, 'rattle', 320);
        burst(...mid(t.cell), '#d8483f', 14);
        sound.boom();
      }
    });
    was.kind.forEach((k0, c) => {
      const k1 = now.kind[c];
      const em = el.gates.children[c].querySelector('em');
      if (k0 === 'gate' && k1 === 'gate' && was.left[c] !== now.left[c]) replay(em, 'pop', 320);
      if (k0 === 'gate' && k1 !== 'gate') {
        ghost(c, 'g-gate', GATE_HTML('') + GATE_HTML(''), 720);
        burst(...mid(c), '#c98d55', 10);
        sound.open();
      }
      if (k0 === 'chest' && k1 !== 'chest') openChest(c);
      if (round.blink[c] >= 0) {
        if ((k0 === 'curtain') !== (k1 === 'curtain')) sound.curtain();
        else if (was.turn[c] !== now.turn[c]) replay(em, 'pop', 320);
      }
    });
  }

  function refreshAll() {
    refreshBlocked();
    updateHud();
    refreshControls();
  }

  function startLevel(index) {
    prevState = null;
    session += 1;
    levelIndex = index;
    storeSet(STORE_LEVEL, String(index));
    round = new Round(index, regionCounts(LEVELS[index].picture));
    visualTray = null;
    pendingFlights = 0;
    inputLocked = false;
    celebrated = false;
    shownPainted = {};
    Object.keys(round.counts).forEach((c) => { shownPainted[c] = 0; });
    tileEls = [];

    hidePanel();
    el.fx.innerHTML = '';
    el.tiles.innerHTML = '';
    buildPicture();
    layoutAll(false);
    refreshBlocked();
    animateDeal(round.initial);
    updateHud();
    introduceMechanics();
  }

  /* ---------- Giới thiệu cơ chế mới khi gặp lần đầu ---------- */
  const MECHANICS = [
    ['holes', 'Ô trống', 'Một số ô <b>không có móc</b>: thẻ không bao giờ rơi vào đó, nên các móc còn lại treo dày hơn.'],
    ['ice', 'Thẻ băng', 'Thẻ bị <b>đóng băng</b> không lấy được. Lấy một thẻ ở <b>móc kề cạnh</b> để băng nứt; nứt 2 lần thì tan.'],
    ['lock', 'Thẻ khóa', 'Thẻ có <b>ổ khóa</b> ghi một con số: ghép đủ chừng đó <b>bộ 3</b> nữa thì khóa mở.'],
    ['mystery', 'Thẻ úp', 'Thẻ có dấu <b>?</b> chưa lộ màu. Chỉ khi lấy vào khay mới biết nó màu gì.'],
    ['gates', 'Móc bị chặn', 'Móc có <b>thanh gỗ</b> chắn ngang chưa lấy được thẻ. Con số trên thanh là số <b>vùng phải tô</b> thêm để mở.'],
  ];

  MECHANICS.push(
    ['chests', 'Rương và chìa khóa', 'Móc bị <b>rương</b> úp lên chưa lấy được thẻ. Lấy thẻ có <b>chìa khóa vàng</b> vào khay thì một rương mở ra.'],
    ['curtains', 'Rèm', 'Móc có <b>rèm đỏ</b> lúc mở lúc đóng. Con số trên rèm là số <b>lần lấy thẻ</b> nữa thì rèm đổi trạng thái.'],
    ['timer', 'Thẻ hẹn giờ', 'Thẻ có <b>số đỏ</b>, khi nằm ngoài cùng sẽ đếm lùi sau mỗi lần bạn lấy thẻ trên board. Phải lấy nó <b>trước khi về 0</b>, nếu không sẽ thua.'],
  );

  function introduceMechanics() {
    const config = LEVELS[levelIndex];
    const seen = (storeGet(STORE_SEEN) || '').split(',');
    const fresh = MECHANICS.filter(([key]) => {
      const value = config[key];
      return (Array.isArray(value) ? value.length : value) && !seen.includes(key);
    });
    if (!fresh.length) return;
    storeSet(STORE_SEEN, seen.concat(fresh.map(([key]) => key)).filter(Boolean).join(','));
    showPanel(
      'Mới trong tranh này',
      `<ul class="news">${fresh.map(([, name, text]) => `<li><b>${name}.</b> ${text}</li>`).join('')}</ul>`,
      [{ label: 'Đã hiểu', run: hidePanel }],
    );
  }

  /* ---------- Chạm thẻ ---------- */
  function onTilePointer(event) {
    const node = event.target.closest('.tile');
    if (!node) return;
    event.preventDefault();
    sound.unlock();
    if (inputLocked || round.status !== 'playing') return;

    const id = Number(node.dataset.id);
    const res = round.tap(id);
    if (!res) {
      node.classList.remove('nudge');
      void node.offsetWidth;
      node.classList.add('nudge');
      sound.denied();
      return;
    }

    sound.tap();
    node.classList.remove('hang');
    visualTray = res.matched ? res.trayBefore : null;
    if (res.from === 'shelf' && round.shelf.length === 0) layoutAll(true);
    else {
      round.shelf.forEach((sid) => place(round.tiles[sid]));
      placeTray();
    }
    // Tính chuyến bay ngay lúc khớp, để màn thắng chỉ diễn sau khi vùng cuối cùng đã tô xong.
    if (res.paintEvent) pendingFlights += 1;
    lastPick = res.from === 'board' ? { cell: res.cell, key: round.key[res.id] } : null;
    refreshAll();
    lastPick = null;

    if (res.matched) later(() => resolveMatch(res), 235);
    if (res.status === 'lost') later(showLost, 420);
  }

  function resolveMatch(res) {
    const order = res.trayBefore;
    const ids = res.matched.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const centerId = ids[1];
    const centerNode = tileEls[centerId];
    ids.forEach((id) => {
      tileEls[id].classList.add('converge');
      tileEls[id].style.transform = centerNode.style.transform;
    });

    later(() => {
      const slot = metrics.slots[Math.min(order.indexOf(centerId), TRAY_SIZE - 1)];
      const cx = slot.left + slot.width / 2;
      const cy = slot.top + slot.height / 2;
      ids.forEach((id) => { tileEls[id].remove(); tileEls[id] = null; });
      burst(cx, cy, COLORS[res.color].hex, 10);
      sound.match();
      if (visualTray === res.trayBefore) visualTray = null;
      placeTray();
      updateHud();
      flyDrop(res.paintEvent, cx, cy);
    }, 135);
  }

  /* ---------- Giọt màu bay lên và loang kín vùng ---------- */
  function regionPoint(region) {
    const svg = el.picMount.querySelector('svg');
    const box = region.querySelector('.base').getBBox();
    const given = region.dataset.at ? region.dataset.at.split(',').map(Number) : null;
    const x = given ? given[0] : box.x + box.width / 2;
    const y = given ? given[1] : box.y + box.height / 2;
    const radius = Math.max(
      Math.hypot(x - box.x, y - box.y), Math.hypot(x - box.x - box.width, y - box.y),
      Math.hypot(x - box.x, y - box.y - box.height), Math.hypot(x - box.x - box.width, y - box.y - box.height),
    ) + 4;
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    const screen = pt.matrixTransform(svg.getScreenCTM());
    const stage = el.stage.getBoundingClientRect();
    return { x, y, radius, left: screen.x - stage.left, top: screen.y - stage.top };
  }

  function flyDrop(ev, startX, startY) {
    const region = regionEls[ev.color][ev.index];
    const target = regionPoint(region);
    const size = metrics.slotW * 1.1;
    const fly = document.createElement('div');
    fly.className = 'flying';
    fly.style.width = `${size}px`;
    fly.style.height = `${size}px`;
    fly.innerHTML = DROP(COLORS[ev.color].hex);
    fly.style.transform = `translate(${startX - size / 2}px, ${startY - size / 2}px) scale(1)`;
    el.fx.appendChild(fly);
    void fly.offsetWidth;
    const scale = 0.6;
    fly.style.transform = `translate(${target.left - (size * scale) / 2}px, ${target.top - (size * scale) / 2}px) scale(${scale})`;
    sound.whoosh();

    later(() => {
      fly.remove();
      pendingFlights -= 1;
      paintRegion(region, target);
      shownPainted[ev.color] += 1;
      updateHud();
      sound.splash();
      burst(target.left, target.top, COLORS[ev.color].hex, 12);
      el.decor.classList.remove('shake');
      void el.decor.offsetWidth;
      el.decor.classList.add('shake');
      if (round.status === 'won' && pendingFlights === 0) celebrate();
    }, 530);
  }

  /** Cho hình tròn cắt nở ra từ điểm giọt màu rơi đến khi phủ kín vùng. */
  function paintRegion(region, target) {
    const circle = el.picMount.querySelector(`#rc-${region.dataset.region} circle`);
    const paint = region.querySelector('.paint');
    circle.setAttribute('cx', target.x);
    circle.setAttribute('cy', target.y);
    const mine = session;
    const start = performance.now();
    const duration = 320 + Math.min(target.radius, 260) * 1.6;
    const finish = () => {
      paint.removeAttribute('clip-path');
      region.classList.add('painted');
    };
    function frame(now) {
      if (mine !== session) return;
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      circle.setAttribute('r', target.radius * (1 - (1 - t) * (1 - t)));
      if (t < 1) requestAnimationFrame(frame);
      else finish();
    }
    requestAnimationFrame(frame);
    // Tab chạy nền không gọi requestAnimationFrame: vẫn phải tô xong.
    later(() => { if (!region.classList.contains('painted')) finish(); }, duration + 400);
  }

  /* ---------- Hiệu ứng ---------- */
  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      const angle = (i / count) * Math.PI * 2 + Math.random();
      const dist = 24 + Math.random() * 32;
      s.style.left = `${x - 4}px`;
      s.style.top = `${y - 4}px`;
      s.style.background = color;
      s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      el.fx.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }

  function confetti() {
    const colors = Object.keys(round.counts).map((c) => COLORS[c].hex);
    const w = el.stage.clientWidth;
    for (let i = 0; i < 46; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = `${Math.random() * w}px`;
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', `${(Math.random() - 0.5) * 90}px`);
      c.style.animationDuration = `${1.3 + Math.random() * 1.1}s`;
      c.style.animationDelay = `${Math.random() * 0.45}s`;
      el.fx.appendChild(c);
      c.addEventListener('animationend', () => c.remove());
    }
  }

  /* ---------- Thắng / thua ---------- */
  function celebrate() {
    if (celebrated) return;
    celebrated = true;
    inputLocked = true;
    refreshControls();
    el.tray.classList.remove('danger');
    sound.win();
    el.picMount.querySelector('svg').classList.add('finished');
    confetti();
    later(showWin, 1500);
  }

  function showWin() {
    const name = PICTURES[LEVELS[levelIndex].picture].name;
    if (levelIndex >= LEVELS.length - 1) {
      showPanel(
        'Hoàn thành bộ tranh!',
        `<p>Bạn đã tô xong cả <b>${LEVELS.length} tranh</b>, và <b>${name}</b> là tranh cuối cùng.</p>`,
        [{ label: 'Chơi lại từ đầu', run: () => startLevel(0) }],
      );
    } else {
      const next = PICTURES[LEVELS[levelIndex + 1].picture].name;
      showPanel(
        `Tranh ${name} đã tô xong!`,
        `<p>Mọi vùng đã có màu. Tranh tiếp theo: <b>${next}</b>.</p>`,
        [{ label: `Sang tranh ${levelIndex + 2}`, run: () => startLevel(levelIndex + 1) }],
      );
    }
  }

  function showLost() {
    if (round.status !== 'lost') return;
    sound.lose();
    const actions = [];
    if (round.canPull()) {
      actions.push({ label: `Rút 3 thẻ lên kệ (còn ${round.boosters.pull})`, run: () => { hidePanel(); doPull(); } });
    }
    if (round.canUndo()) {
      actions.push({
        label: `Hoàn tác 1 thẻ (còn ${round.boosters.undo})`,
        run: () => { hidePanel(); doUndo(); },
        secondary: actions.length > 0,
      });
    }
    actions.push({ label: 'Chơi lại tranh này', run: () => startLevel(levelIndex), secondary: actions.length > 0 });
    if (round.boom >= 0 && round.tray.length < TRAY_SIZE) {
      showPanel('Hết giờ!', '<p>Một thẻ hẹn giờ đã đếm về 0 trước khi bạn kịp lấy.</p>', actions);
      return;
    }
    showPanel('Khay đầy rồi!', '<p>Bảy thẻ trong khay không ghép được bộ nào.</p>', actions);
  }

  function showHelp() {
    showPanel(
      'Tô Tranh',
      `<ol>
        <li>Chạm thẻ <b>ngoài cùng</b> trên mỗi móc để đưa vào khay. Thẻ treo phía sau lộ ra khi đung đưa.</li>
        <li>Đủ <b>3 thẻ cùng màu</b> là thành một giọt màu bay lên <b>tô một vùng</b> của tranh.</li>
        <li>Mỗi móc chỉ hiện <b>3 lớp thẻ</b>. Lấy thẻ ngoài cùng đi thì thẻ mới <b>đùn lên từ bên dưới</b>.</li>
        <li>Tô kín tranh là thắng. Khay đầy <b>7 thẻ</b> là thua.</li>
      </ol>`,
      [{ label: 'Chơi ngay', run: hidePanel }],
    );
  }

  function placePanel() {
    // Để hở bức tranh phía trên.
    const top = rectIn(el.decor);
    el.panel.style.top = `${top.top + top.height}px`;
  }

  function showPanel(title, bodyHtml, actions) {
    el.panelTitle.textContent = title;
    el.panelBody.innerHTML = bodyHtml;
    el.panelActions.innerHTML = '';
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${a.secondary ? ' secondary' : ''}`;
      b.textContent = a.label;
      b.addEventListener('click', () => { sound.unlock(); a.run(); });
      el.panelActions.appendChild(b);
    });
    placePanel();
    el.panel.hidden = false;
  }

  function hidePanel() {
    el.panel.hidden = true;
  }

  /* ---------- Trợ giúp ---------- */
  function doUndo() {
    const entry = round.undo();
    if (!entry) return;
    sound.tap();
    visualTray = null;
    if (entry.from === 'shelf') layoutAll(true);
    else {
      place(round.tiles[entry.id]);
      placeTray();
    }
    refreshAll();
  }

  function doPull() {
    if (!round.pull()) return;
    sound.whoosh();
    visualTray = null;
    layoutAll(true);
    refreshAll();
  }

  function doShuffle() {
    const ids = round.shuffle();
    if (!ids) return;
    sound.whoosh();
    inputLocked = true;
    refreshControls();
    ids.forEach((id) => {
      const node = tileEls[id];
      node.classList.remove('flip');
      void node.offsetWidth;
      node.classList.add('flip');
    });
    later(() => ids.forEach((id) => applyFace(round.tiles[id])), 160);
    later(() => {
      ids.forEach((id) => tileEls[id].classList.remove('flip'));
      inputLocked = false;
      refreshAll();
    }, 340);
  }

  function whenIdle(fn) {
    return () => {
      sound.unlock();
      if (inputLocked || round.status !== 'playing') return;
      fn();
    };
  }

  /* ---------- Khởi động ---------- */
  function init() {
    el.tray.innerHTML = '<div class="tray-slot"></div>'.repeat(TRAY_SIZE);
    el.hooks.innerHTML = '<i class="hook"></i>'.repeat(GRID * GRID);
    el.rods = document.createElement('div');
    el.rods.id = 'rods';
    el.rods.setAttribute('aria-hidden', 'true');
    el.rods.innerHTML = '<i class="rod"></i>'.repeat(GRID * GRID);
    el.stage.insertBefore(el.rods, el.tiles);
    el.gates.innerHTML = '<div class="gate" hidden><b><i></i><em></em></b></div>'.repeat(GRID * GRID);
    el.stage.style.setProperty('--swing', `${SWING_PERIOD}s`);
    el.undo.querySelector('i').innerHTML = ICONS.undo;
    el.shuffle.querySelector('i').innerHTML = ICONS.shuffle;
    el.pull.querySelector('i').innerHTML = ICONS.pull;
    el.restart.innerHTML = ICONS.restart;
    renderSoundIcon();

    el.tiles.addEventListener('pointerdown', onTilePointer);
    // Trình duyệt di động chỉ cho bật âm thanh khi nhấc ngón tay, không phải lúc vừa chạm xuống.
    document.addEventListener('pointerup', () => sound.unlock());
    el.undo.addEventListener('click', whenIdle(doUndo));
    el.shuffle.addEventListener('click', whenIdle(doShuffle));
    el.pull.addEventListener('click', whenIdle(doPull));
    el.restart.addEventListener('click', () => { sound.unlock(); startLevel(levelIndex); });
    el.prev.addEventListener('click', () => { sound.unlock(); if (levelIndex > 0) startLevel(levelIndex - 1); });
    el.next.addEventListener('click', () => { sound.unlock(); if (levelIndex < LEVELS.length - 1) startLevel(levelIndex + 1); });
    el.sound.addEventListener('click', () => {
      sound.on = !sound.on;
      storeSet(STORE_SOUND, sound.on ? 'on' : 'off');
      renderSoundIcon();
      sound.unlock();
      sound.tap();
    });

    // Board tự co giãn theo kích thước màn hình.
    let resizeFrame = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (!round) return;
        layoutAll(false);
        if (!el.panel.hidden) placePanel();
      });
    }).observe(el.stage);

    const saved = Number(storeGet(STORE_LEVEL));
    const start = Number.isInteger(saved) && saved >= 0 && saved < LEVELS.length ? saved : 0;
    startLevel(start);
    if (start === 0) showHelp();
  }

  // Cho phép test tự động đọc trạng thái màn hiện tại.
  window.ToTranh = { get round() { return round; } };

  init();
})();
