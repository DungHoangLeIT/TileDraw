/* Xưởng Robot: nối luật chơi (RoboCore) với giao diện, diễn hoạt và âm thanh. */
(function () {
  const { Round, LEVELS, TRAY_SIZE, PART_TYPES, TILE_UNITS } = RoboCore;
  const { ROBOTS, ENERGY_CELL, TYPE_LABEL, TYPE_SLOT, ICONS, robotSVG, workshopSVG, tileIcon } = RoboArt;

  const TILE_RATIO = 1.12;
  const MAX_TILE = 68;
  const LAYER_LIFT = 3; // ô lớp trên nhấc lên vài px để thấy rõ độ chồng
  const STORE_LEVEL = 'xuong-robot.level';
  const STORE_SOUND = 'xuong-robot.sound';

  const $ = (id) => document.getElementById(id);
  const el = {
    stage: $('stage'), decor: $('decor'), robotMount: $('robotMount'), nameplate: $('nameplate'),
    goals: $('goals'), board: $('board'), tray: $('tray'), tiles: $('tiles'), fx: $('fx'),
    shelfBar: $('shelfBar'), panel: $('panel'), panelTitle: $('panelTitle'), panelBody: $('panelBody'),
    panelActions: $('panelActions'), levelNum: $('levelNum'), tilesLeft: $('tilesLeft'),
    robotProgress: $('robotProgress'), undo: $('undoBtn'), shuffle: $('shuffleBtn'), pull: $('pullBtn'),
    sound: $('soundBtn'), restart: $('restartBtn'), levelChip: $('levelChip'),
    energy: $('energy'), energyFill: document.querySelector('.energy-fill'),
    energyCell: document.querySelector('.energy-cell'), energyText: $('energyText'),
  };

  let round = null;
  let levelIndex = 0;
  let tileEls = [];
  let metrics = null;
  let visualTray = null; // thứ tự khay đang hiển thị khi 3 ô vừa khớp chưa kịp biến mất
  let session = 0; // tăng khi đổi màn để hủy các hẹn giờ còn treo
  let pendingFlights = 0;
  let shownProgress = {};
  let shownDone = 0;
  let shownEnergy = 0;
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
    whoosh() { this.tone(300, 0.45, 'sine', 0.05, 0, 1100); },
    snap() {
      this.tone(140, 0.12, 'square', 0.1);
      this.tone(1400, 0.08, 'triangle', 0.09, 0.03);
      this.tone(2100, 0.1, 'triangle', 0.05, 0.07);
    },
    charge() { this.tone(420, 0.16, 'sine', 0.09, 0, 700); },
    energy() { [740, 990].forEach((f, i) => this.tone(f, 0.11, 'sine', 0.09, i * 0.06)); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.11, i * 0.11)); },
    lose() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.26, 'sawtooth', 0.05, i * 0.16)); },
  };

  function renderSoundIcon() {
    el.sound.innerHTML = sound.on ? ICONS.soundOn : ICONS.soundOff;
  }

  const levelRobot = () => levelIndex % ROBOTS.length;

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
    const reserve = round.shelf.length ? slotH + 24 : 0;

    const xs = round.tiles.map((t) => t.x);
    const ys = round.tiles.map((t) => t.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX + TILE_UNITS;
    const spanY = Math.max(...ys) - minY + TILE_UNITS;

    const padX = 8;
    const padY = 8 + LAYER_LIFT * round.config.layers.length;
    const availW = board.width - padX * 2;
    const availH = board.height - padY - 6 - reserve;
    const tileW = Math.floor(Math.min(
      availW / (spanX / TILE_UNITS),
      availH / ((spanY / TILE_UNITS) * TILE_RATIO),
      MAX_TILE,
    ));
    const tileH = Math.round(tileW * TILE_RATIO);
    const gridW = (spanX / TILE_UNITS) * tileW;
    const gridH = (spanY / TILE_UNITS) * tileH;

    return {
      tileW, tileH, slots, slotW, slotH, reserve, board,
      originX: board.left + (board.width - gridW) / 2 - (minX / TILE_UNITS) * tileW,
      originY: board.top + padY + (availH - gridH) / 2 - (minY / TILE_UNITS) * tileH,
      trayScale: slotW / tileW,
    };
  }

  function positionFor(tile) {
    const m = metrics;
    if (tile.zone === 'board') {
      return {
        x: m.originX + (tile.x / TILE_UNITS) * m.tileW,
        y: m.originY + (tile.y / TILE_UNITS) * m.tileH - tile.layer * LAYER_LIFT,
        s: 1,
        z: 10 + tile.layer * 200 + tile.y,
      };
    }
    if (tile.zone === 'shelf') {
      const i = round.shelf.indexOf(tile.id);
      const gap = 6;
      const total = 3 * m.slotW + 2 * gap;
      const left = m.board.left + (m.board.width - total) / 2;
      return {
        x: left + i * (m.slotW + gap),
        y: m.slots[0].top - m.slotH - 14,
        s: m.trayScale,
        z: 4000 + i,
      };
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
    // Khi có kệ tạm thì thu nhỏ khu robot, nhường chỗ để ô trên bàn không bị nhỏ đi.
    el.stage.classList.toggle('shelf-on', round.shelf.length > 0);
    metrics = computeMetrics();
    el.stage.style.setProperty('--tw', `${metrics.tileW}px`);
    el.stage.style.setProperty('--th', `${metrics.tileH}px`);

    const shelfOn = round.shelf.length > 0;
    el.shelfBar.classList.toggle('on', shelfOn);
    if (shelfOn) {
      const gap = 6;
      el.shelfBar.style.width = `${3 * metrics.slotW + 2 * gap + 12}px`;
      el.shelfBar.style.height = `${metrics.slotH + 10}px`;
      el.shelfBar.style.top = `${metrics.slots[0].top - metrics.slotH - 19}px`;
    }

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

  /* ---------- Dựng màn ---------- */
  function setFace(node, type) {
    node.classList.toggle('is-part', PART_TYPES.includes(type));
    node.setAttribute('aria-label', TYPE_LABEL[type]);
    node.querySelector('.face').innerHTML = tileIcon(levelRobot(), type);
  }

  function buildTiles() {
    el.tiles.innerHTML = '';
    tileEls = round.tiles.map((t, i) => {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'tile enter no-anim';
      node.dataset.id = t.id;
      node.style.setProperty('--delay', `${Math.min(i * 9, 420)}ms`);
      node.innerHTML = '<span class="face"></span>';
      setFace(node, t.type);
      el.tiles.appendChild(node);
      return node;
    });
    later(() => tileEls.forEach((n) => n && n.classList.remove('enter')), 900);
  }

  function buildGoals() {
    el.goals.innerHTML = PART_TYPES.map((type) => `
      <div class="goal" data-type="${type}">
        ${RoboArt.slotIcon(levelRobot(), TYPE_SLOT[type])}
        <span class="goal-text"><small>${TYPE_LABEL[type]}</small><b>0/${round.typeNeed(type)}</b></span>
      </div>`).join('');
  }

  function updateHud() {
    el.levelNum.textContent = levelIndex + 1;
    el.tilesLeft.textContent = celebrated ? 0 : round.boardCount();
    el.robotProgress.textContent = `${shownDone}/${round.slots.length}`;
    el.tray.classList.toggle('danger', round.tray.length >= TRAY_SIZE - 1 && round.status === 'playing');
  }

  function updateBoosters() {
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
      node.classList.toggle('blocked', !round.isFree(t.id) && t.zone !== 'tray');
    });
  }

  function refreshAll() {
    refreshBlocked();
    updateHud();
    updateBoosters();
  }

  function startLevel(index) {
    session += 1;
    levelIndex = index;
    storeSet(STORE_LEVEL, String(index));
    round = new Round(index);
    visualTray = null;
    pendingFlights = 0;
    inputLocked = false;
    celebrated = false;
    shownDone = 0;
    shownEnergy = 0;
    shownProgress = { head: 0, torso: 0, arm: 0, leg: 0 };

    hidePanel();
    el.fx.innerHTML = '';
    el.robotMount.innerHTML = robotSVG(levelRobot());
    el.nameplate.textContent = `Robot ${ROBOTS[levelRobot()].name}`;
    buildGoals();
    renderEnergy();
    buildTiles();
    layoutAll(false);
    refreshAll();
  }

  /* ---------- Chạm ô ---------- */
  function onTilePointer(event) {
    const node = event.target.closest('.tile');
    if (!node) return;
    event.preventDefault();
    sound.unlock();
    if (inputLocked || round.status !== 'playing') return;

    const id = Number(node.dataset.id);
    const res = round.tap(id);
    if (!res) {
      if (round.tiles[id].zone === 'board') {
        node.classList.remove('nudge');
        void node.offsetWidth;
        node.classList.add('nudge');
        sound.denied();
      }
      return;
    }

    sound.tap();
    if (res.from === 'shelf' && round.shelf.length === 0) {
      visualTray = res.matched ? res.trayBefore : null;
      layoutAll(true);
    } else if (res.from === 'shelf') {
      visualTray = res.matched ? res.trayBefore : null;
      round.shelf.forEach((sid) => place(round.tiles[sid]));
      placeTray();
    } else {
      visualTray = res.matched ? res.trayBefore : null;
      placeTray();
    }
    // Tính chuyến bay ngay lúc khớp, để màn thắng chỉ diễn sau khi bộ phận cuối cùng đã lắp xong.
    pendingFlights += res.slotEvents.length + (res.energyEvent ? 1 : 0);
    refreshAll();

    if (res.matched) later(() => resolveMatch(res), 225);
    if (res.status === 'lost') later(showLost, 420);
  }

  function resolveMatch(res) {
    const order = res.trayBefore;
    const ids = res.matched.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const centerId = ids[1];
    const centerNode = tileEls[centerId];

    ids.forEach((id) => {
      const node = tileEls[id];
      node.classList.add('converge');
      node.style.transform = centerNode.style.transform;
    });

    later(() => {
      const slot = metrics.slots[Math.min(order.indexOf(centerId), TRAY_SIZE - 1)];
      const cx = slot.left + slot.width / 2;
      const cy = slot.top + slot.height / 2;
      ids.forEach((id) => { tileEls[id].remove(); tileEls[id] = null; });
      burst(cx, cy, PART_TYPES.includes(res.type) ? '#ffd166' : '#9fe7ff', 10);
      sound.match();

      if (visualTray === res.trayBefore) visualTray = null;
      placeTray();
      updateHud();
      res.slotEvents.forEach((ev) => flyPart(ev, cx, cy));
      if (res.energyEvent) flyEnergy(cx, cy);
    }, 135);
  }

  /* ---------- Bộ phận bay lên và lắp vào khung ---------- */
  function slotNode(slot) {
    return el.robotMount.querySelector(`.slot[data-slot="${slot}"]`);
  }

  function launch(iconHtml, target, startX, startY, onLand) {
    const size = metrics.slotW * 1.15;
    const fly = document.createElement('div');
    fly.className = 'flying';
    fly.style.width = `${size}px`;
    fly.style.height = `${size}px`;
    fly.innerHTML = iconHtml;
    fly.style.transform = `translate(${startX - size / 2}px, ${startY - size / 2}px) scale(1)`;
    el.fx.appendChild(fly);
    void fly.offsetWidth;

    const scale = Math.max(target.width, target.height) / size;
    const tx = target.left + target.width / 2 - (size * scale) / 2;
    const ty = target.top + target.height / 2 - (size * scale) / 2;
    fly.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    sound.whoosh();

    later(() => {
      fly.remove();
      pendingFlights -= 1;
      onLand();
      if (round.status === 'won' && pendingFlights === 0) celebrate();
    }, 570);
  }

  function flyPart(ev, startX, startY) {
    const target = rectIn(slotNode(ev.slot).querySelector('.ghost'));
    const icon = RoboArt.slotIcon(levelRobot(), ev.slot);
    launch(icon, target, startX, startY, () => landPart(ev, target));
  }

  function flyEnergy(startX, startY) {
    const target = rectIn(el.energyCell);
    launch(ENERGY_CELL, target, startX, startY, () => {
      shownEnergy += 1;
      renderEnergy();
      el.energy.classList.remove('bump');
      void el.energy.offsetWidth;
      el.energy.classList.add('bump');
      sound.energy();
      burst(target.left + target.width / 2, target.top + target.height / 2, '#7ff0b0', 8);
    });
  }

  function renderEnergy() {
    const need = round.energyNeed;
    const fraction = need ? shownEnergy / need : 1;
    el.energyFill.style.height = `${fraction * 100}%`;
    el.energyText.textContent = `${shownEnergy}/${need}`;
    el.energy.classList.toggle('full', shownEnergy >= need);
    el.energy.setAttribute('aria-label', `Năng lượng robot ${shownEnergy} trên ${need}`);
    el.robotMount.style.setProperty('--energy', fraction);
  }

  function landPart(ev, target) {
    shownProgress[ev.type] += 3;
    const goal = el.goals.querySelector(`.goal[data-type="${ev.type}"]`);
    const need = round.typeNeed(ev.type);
    goal.querySelector('b').textContent = `${shownProgress[ev.type]}/${need}`;
    goal.classList.remove('bump');
    void goal.offsetWidth;
    goal.classList.add('bump');
    if (shownProgress[ev.type] >= need) goal.classList.add('done');

    const node = slotNode(ev.slot);
    const cx = target.left + target.width / 2;
    const cy = target.top + target.height / 2;
    if (ev.done) {
      node.classList.add('done', 'snap');
      shownDone += 1;
      sound.snap();
      burst(cx, cy, '#ffd166', 14);
      ring(cx, cy, Math.max(target.width, target.height) * 1.1);
      el.decor.classList.remove('shake');
      void el.decor.offsetWidth;
      el.decor.classList.add('shake');
    } else {
      // Bộ phận cần nhiều bộ 3: hiện dần từ dưới lên theo tiến độ.
      const rect = el.robotMount.querySelector(`#clip-${ev.slot} rect`);
      const [, top, , height] = RoboArt.BBOX[ev.slot];
      const newH = height * (ev.got / ev.need);
      rect.setAttribute('height', newH);
      rect.setAttribute('y', top + height - newH);
      node.classList.remove('bump');
      void node.getBoundingClientRect();
      node.classList.add('bump');
      sound.charge();
      burst(cx, cy, '#9fe7ff', 8);
    }
    updateHud();
  }

  /* ---------- Hiệu ứng ---------- */
  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      const angle = (i / count) * Math.PI * 2 + Math.random();
      const dist = 26 + Math.random() * 34;
      s.style.left = `${x - 4}px`;
      s.style.top = `${y - 4}px`;
      s.style.background = color;
      s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      el.fx.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }

  function ring(x, y, size) {
    const r = document.createElement('div');
    r.className = 'ring';
    r.style.left = `${x - size / 2}px`;
    r.style.top = `${y - size / 2}px`;
    r.style.width = `${size}px`;
    r.style.height = `${size}px`;
    el.fx.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  }

  function confetti() {
    const colors = ['#ffd166', '#2ec4b6', '#ef5d5d', '#5ec5ee', '#b18cf0', '#7ed67e'];
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
    updateBoosters();
    sound.win();
    el.robotMount.querySelector('.robot').classList.add('online');
    confetti();

    el.tilesLeft.textContent = 0;
    el.tray.classList.remove('danger');
    later(showWin, 1500);
  }

  function showWin() {
    const name = ROBOTS[levelRobot()].name;
    const isLast = levelIndex >= LEVELS.length - 1;
    if (isLast) {
      showPanel(
        'Xưởng đã xong việc!',
        `<p>Bạn đã lắp đủ <b>${LEVELS.length} robot</b>, và <b>${name}</b> là robot cuối cùng.</p>`,
        [{ label: 'Chơi lại từ đầu', run: () => startLevel(0) }],
      );
    } else {
      showPanel(
        `${name} đã khởi động!`,
        `<p>Bàn đã sạch, robot đủ 6 bộ phận và đầy pin. Robot tiếp theo đang chờ trên bệ.</p>`,
        [{ label: `Sang màn ${levelIndex + 2}`, run: () => startLevel(levelIndex + 1) }],
      );
    }
  }

  function showLost() {
    if (round.status !== 'lost') return;
    sound.lose();
    const actions = [];
    if (round.canPull()) {
      actions.push({
        label: `Rút 3 ô lên kệ (còn ${round.boosters.pull})`,
        run: () => { hidePanel(); doPull(); },
      });
    }
    if (round.canUndo()) {
      actions.push({
        label: `Hoàn tác 1 ô (còn ${round.boosters.undo})`,
        run: () => { hidePanel(); doUndo(); },
        secondary: actions.length > 0,
      });
    }
    actions.push({
      label: 'Chơi lại màn này',
      run: () => startLevel(levelIndex),
      secondary: actions.length > 0,
    });
    showPanel('Khay đầy rồi!', '<p>Bảy ô trong khay không ghép được bộ nào.</p>', actions);
  }

  function showHelp() {
    showPanel(
      'Xưởng Robot',
      `<ol>
        <li>Chạm ô <b>sáng</b> để đưa vào khay. Đủ <b>3 ô giống nhau</b> là cả bộ biến mất.</li>
        <li>Ô <b>viền vàng</b> là bộ phận robot. Gom đủ số lượng thì bộ phận bay lên lắp vào khung.</li>
        <li>Ô <b>thường</b> ghép xong tạo một <b>viên pin</b> nạp năng lượng cho robot.</li>
        <li><b>Dọn sạch bàn</b> để robot khởi động và qua màn. Khay đầy <b>7 ô</b> là thua.</li>
      </ol>`,
      [{ label: 'Chơi ngay', run: hidePanel }],
    );
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
    // Để hở khu robot phía trên.
    const decor = rectIn(el.decor);
    el.panel.style.top = `${decor.top + decor.height}px`;
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
    const ids = round.pull();
    if (!ids) return;
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
    updateBoosters();
    ids.forEach((id) => {
      const node = tileEls[id];
      node.classList.remove('flip');
      void node.offsetWidth;
      node.classList.add('flip');
    });
    later(() => ids.forEach((id) => setFace(tileEls[id], round.tiles[id].type)), 160);
    later(() => {
      ids.forEach((id) => tileEls[id].classList.remove('flip'));
      inputLocked = false;
      refreshAll();
    }, 340);
  }

  function nudgeButton(fn) {
    return () => {
      sound.unlock();
      if (inputLocked || round.status !== 'playing') return;
      fn();
    };
  }

  /* ---------- Khởi động ---------- */
  function init() {
    $('workshop').innerHTML = workshopSVG();
    el.tray.innerHTML = '<div class="tray-slot"></div>'.repeat(TRAY_SIZE);
    el.undo.querySelector('i').innerHTML = ICONS.undo;
    el.shuffle.querySelector('i').innerHTML = ICONS.shuffle;
    el.pull.querySelector('i').innerHTML = ICONS.pull;
    el.restart.innerHTML = ICONS.restart;
    $('energyIcon').innerHTML = ICONS.energy;
    renderSoundIcon();

    el.tiles.addEventListener('pointerdown', onTilePointer);
    // Trình duyệt di động chỉ cho bật âm thanh khi nhấc ngón tay, không phải lúc vừa chạm xuống.
    document.addEventListener('pointerup', () => sound.unlock());
    el.undo.addEventListener('click', nudgeButton(doUndo));
    el.shuffle.addEventListener('click', nudgeButton(doShuffle));
    el.pull.addEventListener('click', nudgeButton(doPull));
    el.restart.addEventListener('click', () => { sound.unlock(); startLevel(levelIndex); });
    el.levelChip.addEventListener('click', () => {
      sound.unlock();
      startLevel((levelIndex + 1) % LEVELS.length);
    });
    el.sound.addEventListener('click', () => {
      sound.on = !sound.on;
      storeSet(STORE_SOUND, sound.on ? 'on' : 'off');
      renderSoundIcon();
      sound.unlock();
      sound.tap();
    });

    // Bàn tự co giãn theo kích thước màn hình.
    let resizeFrame = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (!round) return;
        layoutAll(false);
        if (!el.panel.hidden) {
          const decor = rectIn(el.decor);
          el.panel.style.top = `${decor.top + decor.height}px`;
        }
      });
    }).observe(el.stage);

    const saved = Number(storeGet(STORE_LEVEL));
    const start = Number.isInteger(saved) && saved >= 0 && saved < LEVELS.length ? saved : 0;
    startLevel(start);
    if (start === 0) showHelp();
  }

  // Cho phép test tự động đọc trạng thái màn hiện tại.
  window.XuongRobot = { get round() { return round; } };

  init();
})();
