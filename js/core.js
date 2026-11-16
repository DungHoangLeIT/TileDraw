/* Xưởng Robot: luật chơi thuần, không đụng tới DOM. Chạy được trong trình duyệt và Node (để test). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoboCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const TRAY_SIZE = 7;
  const PULL_COUNT = 3;
  const TILE_UNITS = 2; // một ô chiếm 2x2 đơn vị lưới, cho phép đặt lệch nửa ô giữa các lớp

  const PART_TYPES = ['head', 'torso', 'arm', 'leg'];
  // Không có ô "pin" ở đây: viên pin là thứ được tạo ra khi ghép ô thường, tránh nhầm với ô trên bàn.
  const FILLER_TYPES = ['bolt', 'gear', 'magnet', 'wrench', 'chip', 'spring', 'oil', 'bulb'];

  // R(cột, hàng, x gốc, y gốc): một khối ô trong một lớp, đơn vị là ô lưới.
  const R = (cols, rows, ox, oy) => ({ cols, rows, ox, oy });

  // Hình bàn dùng lại nhiều lần: lớp đáy 6x5 và lớp 5x4 đặt lệch nửa ô.
  const BASE = [[R(6, 5, 0, 1)], [R(5, 4, 1, 2)]];
  const TOWERS = [R(2, 4, 1, 2), R(2, 4, 7, 2)];

  // triples: số bộ 3 cần cho MỖI vị trí lắp. Tay và chân có 2 vị trí nên tổng gấp đôi.
  // fillers: số loại ô thường. maxOpen: số bộ đang gom dở trong lời giải (tối đa 3).
  // seed: chọn bằng bot để độ khó tăng đều, xem tests/core.test.js.
  const lv = (fillers, maxOpen, head, torso, arm, leg, seed, layers) => ({
    fillers, maxOpen, seed, layers, triples: { head, torso, arm, leg },
  });

  const LEVELS = [
    lv(2, 1, 1, 1, 1, 1, 135, [[R(5, 4, 1, 2)], [R(4, 3, 2, 3)]]),
    lv(2, 1, 1, 1, 1, 1, 42, [[R(5, 5, 1, 1)], [R(4, 2, 2, 2)]]),
    lv(3, 1, 1, 1, 1, 1, 149, [[R(6, 4, 0, 2)], [R(5, 3, 1, 3)]]),
    lv(3, 2, 1, 2, 1, 1, 145, [[R(5, 5, 1, 1)], [R(4, 4, 2, 2)], [R(2, 2, 4, 4)]]),
    lv(3, 2, 1, 2, 1, 1, 60, [[R(6, 5, 0, 1)], [...TOWERS, R(1, 1, 5, 3), R(1, 1, 5, 7)]]),
    lv(4, 2, 2, 2, 1, 1, 74, [[R(5, 5, 1, 1)], [R(4, 4, 2, 2)], [R(5, 1, 1, 3), R(5, 1, 1, 7)]]),
    lv(4, 2, 2, 2, 1, 1, 95, [...BASE, [R(2, 2, 4, 4)]]),
    lv(4, 2, 2, 2, 1, 2, 51, [...BASE, [R(1, 3, 1, 3), R(1, 3, 9, 3), R(1, 1, 5, 5)]]),
    lv(5, 2, 1, 2, 1, 2, 1, [...BASE, [R(2, 3, 1, 3), R(2, 3, 7, 3)], [R(2, 2, 4, 4)]]),
    lv(5, 2, 2, 2, 1, 2, 83, [...BASE, [R(4, 3, 2, 3)], [R(3, 2, 3, 4)], [R(1, 1, 5, 5)]]),
    lv(5, 3, 2, 2, 2, 2, 64, [...BASE, TOWERS, [R(3, 2, 3, 4)]]),
    lv(6, 3, 2, 3, 2, 2, 1, [...BASE, TOWERS, [R(3, 2, 3, 4)], [R(3, 1, 3, 5)]]),
    lv(6, 3, 2, 3, 2, 2, 5, [...BASE, TOWERS, [R(3, 4, 3, 2)]]),
    lv(7, 3, 2, 3, 2, 2, 56, [...BASE, TOWERS, [R(3, 4, 3, 2)], [R(3, 1, 3, 5)]]),
    lv(8, 3, 3, 3, 2, 2, 11, [...BASE, TOWERS, [R(1, 4, 1, 2), R(3, 4, 3, 2), R(1, 4, 9, 2)], [R(2, 2, 4, 4)]]),
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

  function buildLayout(config) {
    const tiles = [];
    config.layers.forEach((blocks, layer) => {
      blocks.forEach((b) => {
        for (let r = 0; r < b.rows; r++) {
          for (let c = 0; c < b.cols; c++) {
            tiles.push({ x: b.ox + c * TILE_UNITS, y: b.oy + r * TILE_UNITS, layer });
          }
        }
      });
    });
    // Số ô phải chia hết cho 3; bớt ở lớp trên cùng vì đó là phần ít ảnh hưởng nhất.
    tiles.length -= tiles.length % 3;
    tiles.forEach((t, id) => { t.id = id; });
    return tiles;
  }

  function computeBlockers(tiles) {
    return tiles.map((a) =>
      tiles
        .filter((b) => b.layer > a.layer
          && Math.abs(b.x - a.x) < TILE_UNITS
          && Math.abs(b.y - a.y) < TILE_UNITS)
        .map((b) => b.id));
  }

  function buildSlots(config) {
    const slot = (name, type) => ({
      slot: name, type, need: config.triples[type] * 3, got: 0, done: false,
    });
    return [
      slot('legL', 'leg'), slot('legR', 'leg'), slot('torso', 'torso'),
      slot('armL', 'arm'), slot('armR', 'arm'), slot('head', 'head'),
    ];
  }

  /**
   * Gán loại ô bằng cách mô phỏng một lượt chơi thắng: chọn ô đang mở, gán vào bộ đang gom dở.
   * Giữ tối đa maxOpen (<= 3) bộ dở, mỗi bộ giữ tối đa 2 ô trong khay, nên lời giải không bao giờ
   * có quá 6 ô trong khay. Vì vậy mọi màn đều chắc chắn thắng được với khay 7 ô.
   */
  function generateLevel(levelIndex, seed) {
    const config = LEVELS[levelIndex];
    const rng = makeRng(seed);
    const tiles = buildLayout(config);
    const blockers = computeBlockers(tiles);
    const slots = buildSlots(config);

    const totalTriples = tiles.length / 3;
    const partPool = [];
    slots.forEach((s) => { for (let i = 0; i < s.need / 3; i++) partPool.push(s.type); });
    const fillerTriples = totalTriples - partPool.length;
    const fillerNames = FILLER_TYPES.slice(0, config.fillers);
    const fillerPool = [];
    for (let i = 0; i < fillerTriples; i++) fillerPool.push(fillerNames[i % fillerNames.length]);

    const pool = shuffleInPlace(partPool.concat(fillerPool), rng);
    // Bộ đầu tiên luôn là bộ phận, để người chơi sớm thấy robot được lắp.
    const firstPart = pool.findIndex((t) => PART_TYPES.includes(t));
    [pool[0], pool[firstPart]] = [pool[firstPart], pool[0]];

    const removed = new Array(tiles.length).fill(false);
    const solution = [];
    const open = [];
    let remaining = tiles.length;
    while (remaining > 0) {
      const free = tiles.filter((t) => !removed[t.id] && blockers[t.id].every((b) => removed[b]));
      const tile = pick(free, rng);
      const canOpen = pool.length > 0 && open.length < config.maxOpen;
      let entry;
      if (open.length === 0 || (canOpen && rng() < 0.45)) {
        entry = { type: pool.shift(), need: 3 };
        open.push(entry);
      } else {
        entry = pick(open, rng);
      }
      tile.type = entry.type;
      entry.need -= 1;
      if (entry.need === 0) open.splice(open.indexOf(entry), 1);
      removed[tile.id] = true;
      solution.push(tile.id);
      remaining -= 1;
    }
    return { config, tiles, blockers, slots, solution };
  }


  class Round {
    constructor(levelIndex) {
      const gen = generateLevel(levelIndex, LEVELS[levelIndex].seed);
      this.levelIndex = levelIndex;
      this.config = gen.config;
      this.tiles = gen.tiles.map((t) => ({ ...t, zone: 'board' }));
      this.blockers = gen.blockers;
      this.slots = gen.slots;
      this.solution = gen.solution;
      this.tray = [];
      this.shelf = [];
      this.history = [];
      this.boosters = { undo: 2, shuffle: 1, pull: 1 };
      this.status = 'playing';
      this.energy = 0;
      this.energyNeed = this.tiles.filter((t) => !PART_TYPES.includes(t.type)).length / 3;
      this.rng = makeRng(LEVELS[levelIndex].seed * 7 + 1);
    }

    clone() {
      const c = Object.create(Round.prototype);
      Object.assign(c, this);
      c.tiles = this.tiles.map((t) => ({ ...t }));
      c.slots = this.slots.map((s) => ({ ...s }));
      c.tray = this.tray.slice();
      c.shelf = this.shelf.slice();
      c.history = this.history.slice();
      c.boosters = { ...this.boosters };
      return c;
    }

    isFree(id) {
      const t = this.tiles[id];
      if (t.zone === 'shelf') return true;
      if (t.zone !== 'board') return false;
      return this.blockers[id].every((b) => this.tiles[b].zone !== 'board');
    }

    freeIds() {
      return this.tiles.filter((t) => this.isFree(t.id)).map((t) => t.id);
    }

    boardCount() {
      return this.tiles.filter((t) => t.zone === 'board').length;
    }

    slotsDone() {
      return this.slots.filter((s) => s.done).length;
    }

    typeNeed(type) {
      return this.slots.filter((s) => s.type === type).reduce((sum, s) => sum + s.need, 0);
    }

    /** Chạm một ô. Trả về null nếu không hợp lệ; ngược lại mô tả những gì đã xảy ra để UI diễn hoạt. */
    tap(id) {
      if (this.status !== 'playing' || !this.isFree(id) || this.tray.length >= TRAY_SIZE) return null;
      const tile = this.tiles[id];
      const from = tile.zone;
      if (from === 'shelf') this.shelf.splice(this.shelf.indexOf(id), 1);
      tile.zone = 'tray';
      this.history.push({ id, from });

      // Xếp cạnh ô cùng loại để 3 ô giống nhau luôn liền nhau trong khay.
      let at = this.tray.length;
      for (let i = this.tray.length - 1; i >= 0; i--) {
        if (this.tiles[this.tray[i]].type === tile.type) { at = i + 1; break; }
      }
      this.tray.splice(at, 0, id);
      const trayBefore = this.tray.slice();

      const same = this.tray.filter((t) => this.tiles[t].type === tile.type);
      let matched = null;
      const slotEvents = [];
      let energyEvent = null;
      if (same.length >= 3) {
        matched = same.slice(0, 3);
        matched.forEach((m) => {
          this.tiles[m].zone = 'gone';
          this.tray.splice(this.tray.indexOf(m), 1);
        });
        if (PART_TYPES.includes(tile.type)) {
          const target = this.slots.find((s) => s.type === tile.type && !s.done);
          target.got += 3;
          target.done = target.got >= target.need;
          slotEvents.push({ ...target });
        } else {
          // Ghép ô thường tạo ra một viên pin nạp cho robot.
          this.energy += 1;
          energyEvent = { got: this.energy, need: this.energyNeed };
        }
      }

      // Chỉ thắng khi không còn ô nào: bàn, khay và kệ tạm đều trống.
      if (this.tiles.every((t) => t.zone === 'gone')) this.status = 'won';
      else if (this.tray.length >= TRAY_SIZE) this.status = 'lost';
      return { id, from, type: tile.type, trayBefore, matched, slotEvents, energyEvent, status: this.status };
    }

    canUndo() {
      return this.boosters.undo > 0 && this.history.some((h) => this.tiles[h.id].zone === 'tray');
    }

    /** Trả ô vừa chạm (còn trong khay) về chỗ cũ. */
    undo() {
      if (!this.canUndo() || this.status === 'won') return null;
      let i = this.history.length - 1;
      while (this.tiles[this.history[i].id].zone !== 'tray') i--;
      const [entry] = this.history.splice(i, 1);
      this.tray.splice(this.tray.indexOf(entry.id), 1);
      this.tiles[entry.id].zone = entry.from;
      if (entry.from === 'shelf') this.shelf.push(entry.id);
      this.boosters.undo -= 1;
      this.status = 'playing';
      return entry;
    }

    canPull() {
      return this.boosters.pull > 0 && this.shelf.length === 0 && this.tray.length > 0;
    }

    /** Đưa tối đa 3 ô cuối khay lên kệ tạm; ô trên kệ luôn chạm được. */
    pull() {
      if (!this.canPull() || this.status === 'won') return null;
      const ids = this.tray.splice(-PULL_COUNT);
      ids.forEach((id) => { this.tiles[id].zone = 'shelf'; });
      this.shelf = ids.slice();
      this.boosters.pull -= 1;
      this.status = 'playing';
      return ids;
    }

    canShuffle() {
      return this.boosters.shuffle > 0 && this.boardCount() >= 2;
    }

    /** Hoán đổi loại các ô trên bàn. Thử nhiều lần để chọn cách xáo mà bot vẫn thắng được. */
    shuffle() {
      if (!this.canShuffle() || this.status !== 'playing') return null;
      const ids = this.tiles.filter((t) => t.zone === 'board').map((t) => t.id);
      const types = ids.map((id) => this.tiles[id].type);
      let best = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        const perm = shuffleInPlace(types.slice(), this.rng);
        const trial = this.clone();
        ids.forEach((id, i) => { trial.tiles[id].type = perm[i]; });
        best = perm;
        if (botPlay(trial, this.rng)) break;
      }
      ids.forEach((id, i) => { this.tiles[id].type = best[i]; });
      this.boosters.shuffle -= 1;
      return ids;
    }
  }

  /** Bot tham lam: ưu tiên ô hoàn thành bộ, rồi ô tạo cặp, rồi mới mở loại mới. Dùng cho xáo bàn và test. */
  function botPlay(round, rng) {
    while (round.status === 'playing') {
      const free = round.freeIds();
      if (free.length === 0) return false;
      const held = {};
      round.tray.forEach((id) => {
        const type = round.tiles[id].type;
        held[type] = (held[type] || 0) + 1;
      });
      let bestScore = -1;
      let choices = [];
      free.forEach((id) => {
        const score = held[round.tiles[id].type] || 0;
        if (score > bestScore) { bestScore = score; choices = [id]; }
        else if (score === bestScore) choices.push(id);
      });
      round.tap(pick(choices, rng));
    }
    return round.status === 'won';
  }

  return {
    TRAY_SIZE, TILE_UNITS, PART_TYPES, FILLER_TYPES, LEVELS,
    Round, generateLevel, botPlay, makeRng,
  };
});
