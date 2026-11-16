/* Tô Tranh: luật chơi thuần, không đụng tới DOM. Chạy được trong trình duyệt và Node (để test). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PaintCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const TRAY_SIZE = 7;
  const PULL_COUNT = 3;
  const GRID = 4;
  const CELLS = GRID * GRID;
  const VISIBLE = 3; // mỗi móc chỉ hiện 3 lớp ngoài cùng; thẻ bên dưới đùn lên khi lớp trên được lấy đi
  const ICE_HITS = 2; // băng cần 2 lần nứt mới tan

  // Mỗi level là một tranh (picture = thứ tự trong PaintArt.PICTURES).
  // surface: 0..1, càng cao thì bề mặt càng ít thẻ trùng màu (xem generateLevel).
  // spread:  0 = rải đều; càng cao thì các móc càng lệch nhau (móc 1-2 thẻ cạnh móc 4-6 thẻ).
  // maxOpen: số bộ gom dở trong lượt chơi mẫu (tối đa 3 nên lượt mẫu không quá 6 thẻ trong khay).
  // holes:   các ô không có móc. gates: móc bị chặn, mở khi đã tô đủ `need` vùng.
  // lock / ice / mystery: số thẻ khóa, thẻ băng, thẻ úp trong màn.
  // chests:   móc bị rương úp lên; lấy một thẻ chìa khóa thì rương (chưa mở, số ô nhỏ nhất) mở ra.
  // curtains: móc có rèm, cứ 2 lần lấy thẻ trên board thì đóng/mở một lần; phase 1 = đầu màn đang mở.
  // timer:    số thẻ hẹn giờ; thẻ nằm ngoài cùng mà đếm về 0 trước khi được lấy thì thua.
  // seed: chọn bằng bot để độ khó đúng mức mong muốn (scratchpad paint_tune.js).
  const LEVELS = [
    { picture: 0, maxOpen: 2, surface: 0, spread: 0, seed: 1 },
    { picture: 1, maxOpen: 3, surface: 0, spread: 0.6, seed: 26 },
    { picture: 2, maxOpen: 3, surface: 0.15, spread: 0.8, seed: 4 },
    { picture: 3, maxOpen: 3, surface: 0.1, spread: 0.8, ice: 8, seed: 68 },
    { picture: 4, maxOpen: 3, surface: 0.15, spread: 0.9, lock: 6, chests: [15], seed: 29 },
    { picture: 5, maxOpen: 3, surface: 0.2, spread: 0.8, mystery: 6, curtains: [{ cell: 5, phase: 1 }], seed: 98 },
    { picture: 6, maxOpen: 3, surface: 0, spread: 0.9, gates: [{ cell: 5, need: 3 }, { cell: 10, need: 7 }], ice: 6, timer: 3, seed: 72 },
    { picture: 7, maxOpen: 3, surface: 0.2, spread: 1, lock: 6, mystery: 5, chests: [5, 10], seed: 83 },
    { picture: 8, maxOpen: 3, surface: 0, spread: 1, ice: 8, lock: 5, curtains: [{ cell: 3, phase: 1 }, { cell: 12, phase: 0 }], timer: 3, seed: 57 },
    { picture: 9, maxOpen: 3, surface: 0, spread: 1, gates: [{ cell: 0, need: 3 }, { cell: 6, need: 6 }, { cell: 15, need: 10 }], mystery: 6, chests: [9], timer: 4, seed: 8 },
    { picture: 10, maxOpen: 3, surface: 0.25, spread: 1, ice: 8, lock: 5, chests: [0], curtains: [{ cell: 5, phase: 1 }, { cell: 10, phase: 0 }, { cell: 15, phase: 1 }], seed: 31 },
    { picture: 11, maxOpen: 3, surface: 0.25, spread: 1, gates: [{ cell: 5, need: 4 }, { cell: 10, need: 9 }], ice: 6, lock: 5, mystery: 5, timer: 4, seed: 52 },
    { picture: 12, maxOpen: 3, surface: 0.1, spread: 1, gates: [{ cell: 6, need: 5 }, { cell: 9, need: 12 }], ice: 7, lock: 5, mystery: 4, chests: [3], curtains: [{ cell: 12, phase: 1 }], timer: 5, seed: 71 },
  ];

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleInPlace(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  const pick = (list, rng) => list[Math.floor(rng() * list.length)];
  // Không còn hộp màu: toàn bộ thẻ được xếp sẵn vào các móc ngay từ đầu màn.
  const dealSize = (boxLength) => boxLength;
  // Cách rải của đợt thứ n chỉ phụ thuộc seed, n và trạng thái board, nên chơi lại cùng nước đi sẽ ra y hệt.
  const dealRng = (seed, dealIndex) => makeRng(seed * 977 + dealIndex * 131 + 7);

  /* ---------- Trạng thái board dùng chung cho màn chơi thật và lượt chơi mẫu ----------
   * s.cells[c]   : chồng id thẻ trên móc c, phần tử cuối là thẻ ngoài cùng
   * s.holes[c]   : ô không có móc
   * s.gateNeed[c]: số vùng phải tô để mở móc bị chặn (0 = không chặn); s.gateOpen[c]: đã mở
   * s.lock[id]   : thẻ khóa, còn bao nhiêu bộ 3 nữa thì mở (0 = không khóa)
   * s.ice[id]    : thẻ băng, còn bao nhiêu lần nứt (0 = không băng)
   * s.hidden[id] : thẻ úp, chưa biết màu cho tới khi lấy vào khay
   * s.matched    : số bộ 3 đã ghép
   */
  function newBoard(config, total, rng) {
    const s = {
      cells: Array.from({ length: CELLS }, () => []),
      holes: new Array(CELLS).fill(false),
      gateNeed: new Array(CELLS).fill(0),
      gateOpen: new Array(CELLS).fill(false),
      lock: new Array(total).fill(0),
      ice: new Array(total).fill(0),
      hidden: new Array(total).fill(false),
      chest: new Array(CELLS).fill(false),
      chestOpen: new Array(CELLS).fill(false),
      blink: new Array(CELLS).fill(-1),
      key: new Array(total).fill(false),
      timer: new Array(total).fill(0),
      moves: 0,
      boom: -1,
      matched: 0,
    };
    (config.chests || []).forEach((c) => { s.chest[c] = true; });
    (config.curtains || []).forEach((k) => { s.blink[k.cell] = k.phase; });
    (config.holes || []).forEach((c) => { s.holes[c] = true; });
    (config.gates || []).forEach((g) => { s.gateNeed[g.cell] = g.need; });
    // Rải khóa, băng, thẻ úp lên các thẻ theo thứ tự phát; mỗi thẻ chỉ mang một loại.
    const ids = shuffleInPlace([...Array(total).keys()], rng);
    let k = 0;
    for (let i = 0; i < (config.lock || 0) && k < total; i++) s.lock[ids[k++]] = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < (config.ice || 0) && k < total; i++) s.ice[ids[k++]] = ICE_HITS;
    for (let i = 0; i < (config.mystery || 0) && k < total; i++) s.hidden[ids[k++]] = true;
    return s;
  }

  const curtainShut = (s, c) => s.blink[c] >= 0 && Math.floor(s.moves / 2) % 2 === s.blink[c];
  const cellOpen = (s, c) => !s.holes[c] && (s.gateNeed[c] === 0 || s.gateOpen[c])
    && (!s.chest[c] || s.chestOpen[c]) && !curtainShut(s, c);
  const topOf = (s, c) => (s.cells[c].length ? s.cells[c][s.cells[c].length - 1] : -1);

  /** Thẻ lấy được: ngoài cùng của một móc đang mở, không khóa, không băng. */
  function freeTops(s) {
    const out = [];
    for (let c = 0; c < CELLS; c++) {
      const id = topOf(s, c);
      if (id >= 0 && cellOpen(s, c) && s.lock[id] === 0 && s.ice[id] === 0) out.push(id);
    }
    return out;
  }

  /** Lấy một thẻ khỏi móc c: thẻ băng ngoài cùng ở các móc kề cạnh nứt một lần. */
  function onPick(s, c, pickedId) {
    s.moves += 1;
    if (s.key[pickedId]) {
      const ch = s.chest.findIndex((v, i) => v && !s.chestOpen[i]);
      if (ch >= 0) s.chestOpen[ch] = true;
    }
    // Thẻ hẹn giờ nằm ngoài cùng của móc bớt một nhịp sau mỗi lần lấy thẻ trên board.
    s.cells.forEach((stack) => stack.slice(-1).forEach((t) => {
      if (s.timer[t] > 0) { s.timer[t] -= 1; if (s.timer[t] === 0 && s.boom < 0) s.boom = t; }
    }));
    const col = c % GRID;
    const near = [];
    if (col > 0) near.push(c - 1);
    if (col < GRID - 1) near.push(c + 1);
    if (c >= GRID) near.push(c - GRID);
    if (c < CELLS - GRID) near.push(c + GRID);
    near.forEach((n) => {
      const id = topOf(s, n);
      if (id >= 0 && s.ice[id] > 0) s.ice[id] -= 1;
    });
  }

  /** Ghép xong một bộ 3: mọi thẻ khóa trên board bớt một nấc, móc bị chặn đủ điều kiện thì mở. */
  function onMatch(s) {
    s.matched += 1;
    s.cells.forEach((stack, c) => {
      // Chỉ thẻ khóa đang hiện (3 lớp ngoài cùng) mới bớt nấc; thẻ còn nằm dưới giữ nguyên khóa.
      stack.slice(-VISIBLE).forEach((id) => { if (s.lock[id] > 0) s.lock[id] -= 1; });
      if (s.gateNeed[c] && s.matched >= s.gateNeed[c]) s.gateOpen[c] = true;
    });
  }

  /**
   * Chống kẹt: board còn thẻ mà không thẻ nào lấy được (và hộp đã hết, hoặc vừa phát xong)
   * thì mở mọi móc bị chặn, phá khóa và băng của các thẻ ngoài cùng.
   */
  function settle(s, boxLength, afterDeal) {
    if (!s.cells.some((stack) => stack.length)) return false;
    if (freeTops(s).length) return false;
    if (boxLength > 0 && !afterDeal) return false;
    for (let c = 0; c < CELLS; c++) {
      if (s.holes[c]) continue;
      s.gateOpen[c] = true;
      s.chestOpen[c] = true;
      s.blink[c] = -1;
      const id = topOf(s, c);
      if (id >= 0) { s.lock[id] = 0; s.ice[id] = 0; }
    }
    return true;
  }

  /**
   * Rải một đợt thẻ lên các móc đang mở. Móc trống luôn được lấp trước.
   * spread = 0: đặt vào chồng thấp nhất (rải đều). spread > 0: mỗi móc có một trọng số ngẫu nhiên,
   * nên có móc ít thẻ và có móc nhiều thẻ chờ bên dưới.
   */
  function placeBatch(s, ids, rng, spread, initial) {
    const usable = [];
    for (let c = 0; c < CELLS; c++) if (!s.holes[c] && (initial || cellOpen(s, c))) usable.push(c);
    if (!usable.length) for (let c = 0; c < CELLS; c++) if (!s.holes[c]) usable.push(c);
    shuffleInPlace(usable, rng);
    const weight = {};
    usable.forEach((c) => { weight[c] = Math.pow(3, (rng() * 2 - 1) * spread); });
    const lowest = () => usable.reduce((best, c) => (s.cells[c].length < s.cells[best].length ? c : best), usable[0]);
    return ids.map((id) => {
      let cell = lowest();
      if (spread > 0 && s.cells[cell].length > 0) {
        const room = usable;
        {
          let r = rng() * room.reduce((sum, c) => sum + weight[c], 0);
          cell = room[room.length - 1];
          for (const c of room) { r -= weight[c]; if (r <= 0) { cell = c; break; } }
        }
      }
      s.cells[cell].push(id);
      return { id, cell };
    });
  }

  /**
   * Gán màu cho thẻ bằng cách mô phỏng một lượt chơi thắng, gồm cả lúc bấm hộp, khóa, băng và móc bị chặn.
   * Giữ tối đa maxOpen (<= 3) bộ dở nên lượt mẫu không bao giờ có quá 6 thẻ trong khay: màn luôn thắng được.
   * surface quyết định thẻ tiếp theo của một bộ đang dở: với xác suất surface, chọn thẻ chỉ mới lấy được
   * sau lần lấy trước của bộ đó, tức là lúc lấy thẻ trước thì thẻ này chưa có trên bề mặt.
   * counts: { màu: số vùng của tranh }, mỗi vùng cần đúng một bộ 3.
   */
  function generateLevel(levelIndex, counts, seed, surface) {
    const config = LEVELS[levelIndex];
    const rng = makeRng(seed);
    const pool = [];
    Object.keys(counts).forEach((color) => { for (let i = 0; i < counts[color]; i++) pool.push(color); });
    const total = pool.length * 3;
    shuffleInPlace(pool, rng);

    const s = newBoard(config, total, rng);
    const start = { lock: s.lock.slice(), ice: s.ice.slice(), hidden: s.hidden.slice() };
    const box = [...Array(total).keys()];
    const freeAt = new Array(total).fill(-1); // bước mà thẻ bắt đầu lấy được
    let dealCount = 0;
    let step = 0;
    const mark = () => freeTops(s).forEach((id) => { if (freeAt[id] < 0) freeAt[id] = step; });
    const deal = () => {
      placeBatch(s, box.splice(0, dealSize(box.length)), dealRng(seed, dealCount), config.spread || 0, dealCount === 0);
      dealCount += 1;
      settle(s, box.length, true);
      step += 1;
      // Thẻ bị đè lên thì không còn lấy được; khi lộ ra lại sẽ tính là thẻ mới.
      const free = new Set(freeTops(s));
      freeAt.forEach((at, id) => { if (at >= 0 && !free.has(id)) freeAt[id] = -1; });
      mark();
    };
    deal();

    // Chìa khóa: mỗi rương một chìa, gắn vào thẻ thường nằm trong 5 lớp ngoài của móc không bị chặn.
    const startCell = new Array(total).fill(-1);
    s.cells.forEach((stack, c) => stack.forEach((id) => { startCell[id] = c; }));
    const plain = (id) => !start.lock[id] && !start.ice[id] && !start.hidden[id];
    const nChest = (config.chests || []).length;
    if (nChest) {
      const cand = [];
      s.cells.forEach((stack, c) => {
        if (s.chest[c] || s.gateNeed[c]) return;
        stack.slice(-5).forEach((id) => { if (plain(id)) cand.push(id); });
      });
      shuffleInPlace(cand, rng).slice(0, nChest).forEach((id) => { s.key[id] = true; });
    }
    start.key = s.key.slice();
    const seenAt = new Array(total).fill(-1);
    const pickAt = new Array(total).fill(0);
    s.cells.forEach((stack) => stack.slice(-1).forEach((id) => { seenAt[id] = 0; }));

    const colors = new Array(total);
    const solution = []; // id thẻ, hoặc -1 nghĩa là bấm hộp
    const open = [];
    let threshold = Math.floor(rng() * 8);
    let remaining = total;
    while (remaining > 0) {
      const tops = freeTops(s);
      if (box.length && tops.length <= threshold) {
        deal();
        solution.push(-1);
        threshold = Math.floor(rng() * 8);
        continue;
      }
      // Không mở hai bộ cùng màu một lúc: khay ghép theo màu, nên hai bộ trùng màu sẽ làm lượt mẫu
      // và màn chơi thật ghép lệch thời điểm (khóa và móc bị chặn mở sai lúc).
      const nextColor = pool.findIndex((color) => !open.some((e) => e.color === color));
      const takeColor = () => pool.splice(nextColor, 1)[0];
      const canOpen = nextColor >= 0 && open.length < config.maxOpen;
      let entry;
      let id;
      if (open.length === 0 || (canOpen && rng() < 0.45)) {
        entry = { color: takeColor(), need: 3, last: step };
        open.push(entry);
        id = pick(tops, rng);
      } else {
        const freshOf = (e) => tops.filter((t) => freeAt[t] > e.last);
        entry = pick(open, rng);
        let fresh = freshOf(entry);
        if (!fresh.length && rng() < surface) {
          // Bộ này chưa có thẻ mới lộ: chuyển sang bộ khác có thẻ mới lộ, hoặc mở bộ mới, để không
          // phải ghép bằng một thẻ vốn đã nằm sẵn trên bề mặt.
          const others = open.filter((e) => freshOf(e).length);
          if (others.length) {
            entry = pick(others, rng);
            fresh = freshOf(entry);
          } else if (canOpen) {
            entry = { color: takeColor(), need: 3, last: step };
            open.push(entry);
          }
        }
        id = fresh.length && rng() < surface ? pick(fresh, rng) : pick(tops, rng);
      }
      step += 1;
      colors[id] = entry.color;
      entry.need -= 1;
      entry.last = step;
      const cell = s.cells.findIndex((st) => st[st.length - 1] === id);
      const cur = s.moves;
      pickAt[id] = cur;
      s.cells[cell].pop();
      onPick(s, cell, id);
      s.cells[cell].slice(-1).forEach((t) => { if (seenAt[t] < 0) seenAt[t] = cur; });
      if (entry.need === 0) {
        open.splice(open.indexOf(entry), 1);
        onMatch(s);
      }
      settle(s, box.length, false);
      mark();
      solution.push(id);
      remaining -= 1;
    }
    // Thẻ hẹn giờ: đặt số nhịp theo lượt mẫu (số lần lấy thẻ trong lúc nó nằm ngoài cùng) cộng thêm vài nhịp dư,
    // nên lượt mẫu luôn lấy kịp.
    start.timer = new Array(total).fill(0);
    if (config.timer) {
      const cand = [];
      for (let id = 0; id < total; id++) {
        const c = startCell[id];
        const wait = pickAt[id] - seenAt[id];
        if (plain(id) && !start.key[id] && !s.chest[c] && !s.gateNeed[c] && (config.curtains || []).every((k) => k.cell !== c)
          && wait >= 2 && wait <= 9) cand.push(id);
      }
      shuffleInPlace(cand, rng).slice(0, config.timer).forEach((id) => {
        start.timer[id] = pickAt[id] - seenAt[id] + 3 + Math.floor(rng() * 3);
      });
    }
    return { total, colors, solution, start };
  }

  class Round {
    /** counts: { màu: số vùng của tranh }, mỗi vùng cần đúng một bộ 3 thẻ. */
    constructor(levelIndex, counts, seedOverride, surfaceOverride) {
      const config = LEVELS[levelIndex];
      this.levelIndex = levelIndex;
      this.config = config;
      this.seed = seedOverride === undefined ? config.seed : seedOverride;
      this.surface = surfaceOverride === undefined ? config.surface : surfaceOverride;
      this.counts = { ...counts };
      const gen = generateLevel(levelIndex, counts, this.seed, this.surface);
      const colors = gen.colors;
      this.solution = gen.solution; // một cách thắng chắc chắn: id thẻ, hoặc -1 nghĩa là bấm hộp
      this.tiles = colors.map((color, id) => ({ id, color, zone: 'box', cell: -1 }));
      // Trạng thái board (cells, holes, gate*, lock, ice, hidden, matched) nằm ngay trên Round.
      Object.assign(this, newBoard({ holes: config.holes, gates: config.gates, chests: config.chests, curtains: config.curtains }, colors.length, makeRng(0)));
      this.key = gen.start.key.slice();
      this.timer = gen.start.timer.slice();
      this.lock = gen.start.lock.slice();
      this.ice = gen.start.ice.slice();
      this.hidden = gen.start.hidden.slice();
      this.box = this.tiles.map((t) => t.id);
      this.dealCount = 0;
      this.tray = [];
      this.shelf = [];
      this.history = [];
      this.gone = 0;
      this.painted = {};
      Object.keys(counts).forEach((color) => { this.painted[color] = 0; });
      this.regionsTotal = colors.length / 3;
      this.boosters = { undo: 2, shuffle: 1, pull: 1 };
      this.status = 'playing';
      this.rng = makeRng(this.seed * 7 + 1);
      this.initial = this.place(dealSize(this.box.length)); // vào màn đã có sẵn một đợt trên board
    }

    place(size) {
      const ids = this.box.splice(0, size);
      const placed = placeBatch(this, ids, dealRng(this.seed, this.dealCount), this.config.spread || 0, this.dealCount === 0);
      this.dealCount += 1;
      placed.forEach((p) => {
        this.tiles[p.id].zone = 'board';
        this.tiles[p.id].cell = p.cell;
      });
      settle(this, this.box.length, true);
      return placed;
    }

    clone() {
      const c = Object.create(Round.prototype);
      Object.assign(c, this);
      c.tiles = this.tiles.map((t) => ({ ...t }));
      c.cells = this.cells.map((stack) => stack.slice());
      c.gateOpen = this.gateOpen.slice();
      c.lock = this.lock.slice();
      c.ice = this.ice.slice();
      c.hidden = this.hidden.slice();
      c.chestOpen = this.chestOpen.slice();
      c.blink = this.blink.slice();
      c.timer = this.timer.slice();
      c.box = this.box.slice();
      c.tray = this.tray.slice();
      c.shelf = this.shelf.slice();
      c.history = this.history.slice();
      c.painted = { ...this.painted };
      c.boosters = { ...this.boosters };
      return c;
    }

    /** Số vùng còn phải tô để mở móc bị chặn c; 0 nếu móc đang mở hoặc ô không có móc. */
    gateLeft(c) {
      if (this.holes[c] || !this.gateNeed[c] || this.gateOpen[c]) return 0;
      return Math.max(1, this.gateNeed[c] - this.matched);
    }

    /** Thứ đang chặn móc c: 'gate' (thanh gỗ), 'chest' (rương), 'curtain' (rèm đang đóng) hoặc '' nếu móc mở. */
    barrier(c) {
      if (this.holes[c]) return '';
      if (this.gateLeft(c)) return 'gate';
      if (this.chest[c] && !this.chestOpen[c]) return 'chest';
      if (curtainShut(this, c)) return 'curtain';
      return '';
    }

    /** Móc có rèm: còn mấy lần lấy thẻ nữa thì rèm đổi trạng thái (0 = móc không có rèm). */
    curtainIn(c) {
      return this.blink[c] < 0 ? 0 : 2 - (this.moves % 2);
    }

    /** Gỡ thẻ hẹn giờ vừa hết giờ (khi người chơi dùng trợ giúp để cứu ván): cho nó thêm 4 nhịp. */
    defuse() {
      if (this.boom >= 0) { this.timer[this.boom] = 4; this.boom = -1; }
    }

    /** Thẻ ngoài cùng của móc (dù có lấy được hay không). */
    isTop(id) {
      const t = this.tiles[id];
      return t.zone === 'board' && topOf(this, t.cell) === id;
    }

    /** Lấy được: thẻ trên kệ tạm, hoặc thẻ ngoài cùng của móc đang mở, không khóa, không băng. */
    isFree(id) {
      const t = this.tiles[id];
      if (t.zone === 'shelf') return true;
      return this.isTop(id) && cellOpen(this, t.cell) && this.lock[id] === 0 && this.ice[id] === 0;
    }

    freeIds() {
      return freeTops(this).concat(this.shelf);
    }

    boardCount() {
      return this.cells.reduce((sum, stack) => sum + stack.length, 0);
    }

    paintedCount() {
      return this.matched;
    }

    canDeal() {
      return this.status === 'playing' && this.box.length > 0;
    }

    /** Bấm hộp màu: phát 30 thẻ, hoặc toàn bộ phần còn lại nếu hộp không đủ. */
    deal() {
      if (!this.canDeal()) return null;
      return this.place(dealSize(this.box.length));
    }

    /** Chạm một thẻ. Trả về null nếu không hợp lệ; ngược lại mô tả những gì đã xảy ra để UI diễn hoạt. */
    tap(id) {
      if (this.status !== 'playing' || !this.isFree(id) || this.tray.length >= TRAY_SIZE) return null;
      const tile = this.tiles[id];
      const from = tile.zone;
      const cell = tile.cell;
      if (from === 'shelf') this.shelf.splice(this.shelf.indexOf(id), 1);
      else {
        this.cells[cell].pop();
        onPick(this, cell, id);
      }
      tile.zone = 'tray';
      this.hidden[id] = false; // thẻ úp lật ngửa khi vào khay
      this.history.push({ id, from, cell });

      // Xếp cạnh thẻ cùng màu để 3 thẻ giống nhau luôn liền nhau trong khay.
      let at = this.tray.length;
      for (let i = this.tray.length - 1; i >= 0; i--) {
        if (this.tiles[this.tray[i]].color === tile.color) { at = i + 1; break; }
      }
      this.tray.splice(at, 0, id);
      const trayBefore = this.tray.slice();

      const same = this.tray.filter((t) => this.tiles[t].color === tile.color);
      let matched = null;
      let paintEvent = null;
      if (same.length >= 3) {
        matched = same.slice(0, 3);
        matched.forEach((m) => {
          this.tiles[m].zone = 'gone';
          this.tray.splice(this.tray.indexOf(m), 1);
        });
        this.gone += 3;
        // Mỗi bộ 3 tô đúng một vùng của tranh có màu đó.
        paintEvent = { color: tile.color, index: this.painted[tile.color] };
        this.painted[tile.color] += 1;
        onMatch(this);
      }
      const rescued = settle(this, this.box.length, false);

      if (this.gone === this.tiles.length) this.status = 'won';
      else if (this.tray.length >= TRAY_SIZE || this.boom >= 0) this.status = 'lost';
      return { id, from, cell, color: tile.color, trayBefore, matched, paintEvent, rescued, boom: this.boom, status: this.status };
    }

    canUndo() {
      return this.boosters.undo > 0 && this.history.some((h) => this.tiles[h.id].zone === 'tray');
    }

    /** Trả thẻ vừa chạm (còn trong khay) về ngoài cùng móc cũ hoặc kệ tạm. Băng đã nứt thì không liền lại. */
    undo() {
      if (!this.canUndo() || this.status === 'won') return null;
      let i = this.history.length - 1;
      while (this.tiles[this.history[i].id].zone !== 'tray') i--;
      const [entry] = this.history.splice(i, 1);
      this.tray.splice(this.tray.indexOf(entry.id), 1);
      this.tiles[entry.id].zone = entry.from;
      if (entry.from === 'shelf') this.shelf.push(entry.id);
      else this.cells[entry.cell].push(entry.id);
      this.boosters.undo -= 1;
      this.defuse();
      this.status = 'playing';
      return entry;
    }

    canPull() {
      return this.boosters.pull > 0 && this.shelf.length === 0 && this.tray.length > 0;
    }

    /** Đưa tối đa 3 thẻ cuối khay lên kệ tạm; thẻ trên kệ luôn chạm được. */
    pull() {
      if (!this.canPull() || this.status === 'won') return null;
      const ids = this.tray.splice(-PULL_COUNT);
      ids.forEach((id) => { this.tiles[id].zone = 'shelf'; });
      this.shelf = ids.slice();
      this.boosters.pull -= 1;
      this.defuse();
      this.status = 'playing';
      return ids;
    }

    canShuffle() {
      return this.boosters.shuffle > 0 && this.boardCount() >= 2;
    }

    /** Hoán đổi màu các thẻ trên board (khóa, băng, thẻ úp giữ nguyên chỗ). Chọn cách xáo mà bot vẫn thắng được. */
    shuffle() {
      if (!this.canShuffle() || this.status !== 'playing') return null;
      const ids = this.tiles.filter((t) => t.zone === 'board').map((t) => t.id);
      const colors = ids.map((id) => this.tiles[id].color);
      let best = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        const perm = shuffleInPlace(colors.slice(), this.rng);
        const trial = this.clone();
        ids.forEach((id, i) => { trial.tiles[id].color = perm[i]; });
        best = perm;
        if (botPlay(trial, this.rng)) break;
      }
      ids.forEach((id, i) => { this.tiles[id].color = best[i]; });
      this.boosters.shuffle -= 1;
      return ids;
    }
  }

  /**
   * Bot kiểu người chơi: ưu tiên bộ gom đủ ngay từ bề mặt, rồi thẻ tạo cặp; bấm hộp khi board hết thẻ lấy được hoặc khi bí.
   * Bot không biết màu thẻ úp. log (tùy chọn) ghi lại các nước đi: id thẻ, hoặc -1 khi bấm hộp.
   */
  function botPlay(round, rng, log) {
    while (round.status === 'playing') {
      const free = round.freeIds();
      if (free.length === 0) {
        if (!round.deal()) return false;
        if (log) log.push(-1);
        continue;
      }
      const held = {};
      round.tray.forEach((id) => {
        const color = round.tiles[id].color;
        held[color] = (held[color] || 0) + 1;
      });
      // Như người chơi: đếm số thẻ cùng màu đang lấy được trên bề mặt để biết bộ nào gom đủ ngay.
      const seen = {};
      free.forEach((id) => {
        if (!round.hidden[id]) seen[round.tiles[id].color] = (seen[round.tiles[id].color] || 0) + 1;
      });
      const room = TRAY_SIZE - round.tray.length;
      let bestScore = -1;
      let choices = [];
      free.forEach((id) => {
        let score = round.tray.length <= 2 ? 5 : 0.5; // thẻ úp: lật thử khi khay còn rộng, không thì để sau
        if (!round.hidden[id]) {
          const color = round.tiles[id].color;
          const have = held[color] || 0;
          const need = 3 - have;
          if (seen[color] >= need && need < room + 1) score = 1000 + have * 100; // gom đủ bộ ngay
          else score = have * 10 + seen[color];
        }
        if (round.timer[id] > 0 && round.timer[id] <= 3) score += 500; // thẻ hẹn giờ sắp hết: lấy trước
        if (round.key[id] && round.tray.length <= 3) score += 50;
        if (score > bestScore) { bestScore = score; choices = [id]; }
        else if (score === bestScore) choices.push(id);
      });
      // Khay đã khá đầy mà không thẻ nào trên board giúp được: bấm hộp để có thẻ mới.
      if (bestScore < 10 && round.tray.length >= 4 && round.deal()) {
        if (log) log.push(-1);
        continue;
      }
      const id = pick(choices, rng);
      round.tap(id);
      if (log) log.push(id);
    }
    return round.status === 'won';
  }

  return {
    TRAY_SIZE, GRID, CELLS, VISIBLE, ICE_HITS, LEVELS,
    Round, generateLevel, botPlay, makeRng, dealSize,
  };
});
