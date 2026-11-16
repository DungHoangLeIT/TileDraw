// Chạy: node tests/core.test.js
const assert = require('node:assert');
const { LEVELS, TRAY_SIZE, PART_TYPES, Round, botPlay, makeRng } = require('../js/core.js');

function typeCounts(round, zones) {
  const counts = {};
  round.tiles.filter((t) => zones.includes(t.zone)).forEach((t) => {
    counts[t.type] = (counts[t.type] || 0) + 1;
  });
  return counts;
}

function botRate(levelIndex, runs = 400) {
  const rng = makeRng(42 + levelIndex);
  let wins = 0;
  for (let r = 0; r < runs; r++) if (botPlay(new Round(levelIndex), rng)) wins++;
  return wins / runs;
}

assert.strictEqual(LEVELS.length, 15, 'phải có 15 màn');

let previousRate = 1.01;
LEVELS.forEach((config, i) => {
  const round = new Round(i);
  const n = round.tiles.length;
  assert.strictEqual(n % 3, 0, `màn ${i + 1}: số ô phải chia hết cho 3`);

  // Mỗi loại ô phải xuất hiện theo bộ 3, đủ các loại ô thường.
  const counts = typeCounts(round, ['board']);
  Object.entries(counts).forEach(([type, c]) => assert.strictEqual(c % 3, 0, `màn ${i + 1}: ${type} = ${c}`));
  assert.strictEqual(Object.keys(counts).length, 4 + config.fillers, `màn ${i + 1}: thiếu loại ô`);

  // Số ô bộ phận khớp yêu cầu lắp; phần còn lại là ô thường, mỗi bộ ra một viên pin.
  let partTiles = 0;
  PART_TYPES.forEach((type) => {
    assert.strictEqual(counts[type], round.typeNeed(type), `màn ${i + 1}: ${type}`);
    partTiles += counts[type];
  });
  assert.strictEqual(round.energyNeed, (n - partTiles) / 3, `màn ${i + 1}: số pin`);

  // Đi hết lời giải: chỉ thắng ở đúng ô cuối cùng, không thắng sớm khi robot vừa lắp xong.
  const replay = new Round(i);
  let maxTray = 0;
  replay.solution.forEach((id, step) => {
    const res = replay.tap(id);
    assert.ok(res, `màn ${i + 1}: lời giải chạm ô không hợp lệ ${id}`);
    maxTray = Math.max(maxTray, replay.tray.length);
    const isLast = step === replay.solution.length - 1;
    assert.strictEqual(res.status, isLast ? 'won' : 'playing', `màn ${i + 1}: bước ${step}`);
  });
  assert.ok(maxTray < TRAY_SIZE, `màn ${i + 1}: khay vượt giới hạn`);
  assert.strictEqual(replay.slotsDone(), 6, `màn ${i + 1}: robot phải đủ 6 bộ phận`);
  assert.strictEqual(replay.energy, replay.energyNeed, `màn ${i + 1}: pin phải đầy`);

  // Độ khó phải tăng dần theo tỉ lệ thắng của bot (cho phép sai số đo nhỏ).
  const rate = botRate(i);
  assert.ok(rate <= previousRate + 0.03, `màn ${i + 1}: dễ hơn màn trước (${rate} so với ${previousRate})`);
  previousRate = rate;
  console.log(
    `Màn ${String(i + 1).padStart(2)}: ${String(n).padStart(2)} ô, ${String(Object.keys(counts).length).padStart(2)} loại, `
    + `${config.layers.length} lớp, ${String(round.energyNeed).padStart(2)} pin, `
    + `mở đầu ${String(round.freeIds().length).padStart(2)} ô chạm được, khay tối đa ${maxTray}, `
    + `bot thắng ${Math.round(rate * 100)}%`,
  );
});

// Ô bị đè không chạm được.
{
  const r = new Round(0);
  const blocked = r.tiles.find((t) => !r.isFree(t.id));
  assert.strictEqual(r.tap(blocked.id), null);
  assert.strictEqual(r.tray.length, 0);
}

// Bộ đầu tiên là bộ phận: đủ 3 ô thì biến mất, ghi tiến độ lắp, không tạo pin.
{
  const r = new Round(0);
  const first = r.tiles[r.solution[0]].type;
  assert.ok(PART_TYPES.includes(first), 'bộ đầu tiên phải là bộ phận');
  let last;
  for (let i = 0; i < 3; i++) last = r.tap(r.solution[i]);
  assert.strictEqual(last.matched.length, 3);
  assert.strictEqual(r.tray.length, 0);
  assert.strictEqual(last.slotEvents.length, 1);
  assert.strictEqual(last.slotEvents[0].done, true);
  assert.strictEqual(last.energyEvent, null);
  assert.strictEqual(r.energy, 0);
}

// Ghép ô thường tạo đúng một viên pin, không tính vào tiến độ lắp.
{
  const r = new Round(0);
  let charged = null;
  for (const id of r.solution) {
    const res = r.tap(id);
    if (res.energyEvent) { charged = res; break; }
  }
  assert.ok(charged, 'phải có lượt tạo pin');
  assert.strictEqual(charged.energyEvent.got, 1);
  assert.strictEqual(charged.energyEvent.need, r.energyNeed);
  assert.strictEqual(charged.slotEvents.length, 0);
  assert.ok(!PART_TYPES.includes(charged.type));
}

// Robot lắp xong nhưng còn ô trên bàn thì chưa thắng.
{
  const r = new Round(0);
  let robotDoneAt = -1;
  r.solution.forEach((id, step) => {
    r.tap(id);
    if (robotDoneAt < 0 && r.slotsDone() === 6) robotDoneAt = step;
  });
  assert.ok(robotDoneAt >= 0);
  // Dựng lại đúng thời điểm robot vừa xong: nếu còn ô thì trạng thái vẫn phải là đang chơi.
  const again = new Round(0);
  for (let i = 0; i <= robotDoneAt; i++) again.tap(again.solution[i]);
  assert.strictEqual(again.slotsDone(), 6);
  const stillHasTiles = again.tiles.some((t) => t.zone !== 'gone');
  assert.strictEqual(again.status, stillHasTiles ? 'playing' : 'won');
}

// Hoàn tác trả ô về bàn, kể cả khi đã làm lộ ô bên dưới.
{
  const r = new Round(1);
  const id = r.solution[0];
  r.tap(id);
  assert.strictEqual(r.tiles[id].zone, 'tray');
  const entry = r.undo();
  assert.strictEqual(entry.id, id);
  assert.strictEqual(r.tiles[id].zone, 'board');
  assert.strictEqual(r.boosters.undo, 1);
  assert.strictEqual(r.tray.length, 0);
}

// Rút ô: đưa 3 ô cuối lên kệ, chạm lại được, cứu được thế thua.
{
  const r = new Round(14);
  while (r.status === 'playing') {
    const held = {};
    r.tray.forEach((i) => { held[r.tiles[i].type] = (held[r.tiles[i].type] || 0) + 1; });
    const next = r.freeIds().find((id) => (held[r.tiles[id].type] || 0) < 2);
    assert.notStrictEqual(next, undefined, 'phải dựng được khay đầy');
    r.tap(next);
  }
  assert.strictEqual(r.status, 'lost');
  assert.strictEqual(r.tray.length, TRAY_SIZE);
  const ids = r.pull();
  assert.strictEqual(ids.length, 3);
  assert.strictEqual(r.status, 'playing');
  assert.strictEqual(r.tray.length, TRAY_SIZE - 3);
  assert.strictEqual(r.canPull(), false, 'không rút tiếp khi kệ còn ô');
  assert.ok(r.isFree(ids[0]), 'ô trên kệ phải chạm được');
  assert.ok(r.tap(ids[0]));
  assert.strictEqual(r.shelf.length, 2);
}

// Xáo bàn giữ nguyên số lượng mỗi loại và không đụng tới khay.
{
  const r = new Round(8);
  for (let i = 0; i < 4; i++) r.tap(r.solution[i]);
  const trayTypes = r.tray.map((id) => r.tiles[id].type);
  const before = typeCounts(r, ['board']);
  const ids = r.shuffle();
  assert.ok(ids.length > 0);
  assert.deepStrictEqual(typeCounts(r, ['board']), before);
  assert.deepStrictEqual(r.tray.map((id) => r.tiles[id].type), trayTypes);
  assert.strictEqual(r.boosters.shuffle, 0);
  assert.strictEqual(r.canShuffle(), false);
}

// Tay có 2 vị trí: bộ thứ nhất lắp tay trái, bộ thứ hai lắp tay phải.
{
  const r = new Round(0);
  const arms = r.slots.filter((s) => s.type === 'arm');
  assert.deepStrictEqual(arms.map((s) => s.slot), ['armL', 'armR']);
  const events = [];
  for (const id of r.solution) {
    r.tap(id).slotEvents.filter((e) => e.type === 'arm').forEach((e) => events.push(e.slot));
  }
  assert.deepStrictEqual(events, ['armL', 'armR']);
}

console.log('Tất cả test đều đạt.');
