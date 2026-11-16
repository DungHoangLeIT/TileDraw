// Chạy: node tests/core.test.js
const assert = require('node:assert');
const {
  LEVELS, TRAY_SIZE, CELLS, VISIBLE, ICE_HITS, Round, botPlay, makeRng, dealSize,
} = require('../js/core.js');
const Art = require('../js/art.js');

const countsOf = (i) => Art.regionCounts(LEVELS[i].picture);
const newRound = (i) => new Round(i, countsOf(i));
const topOf = (r, c) => r.cells[c][r.cells[c].length - 1];
const colorCounts = (round, zones) => {
  const counts = {};
  round.tiles.filter((t) => zones.includes(t.zone)).forEach((t) => {
    counts[t.color] = (counts[t.color] || 0) + 1;
  });
  return counts;
};
const botRate = (i, runs = 300) => {
  const rng = makeRng(42 + i);
  const base = newRound(i);
  let wins = 0;
  for (let r = 0; r < runs; r++) if (botPlay(base.clone(), rng)) wins++;
  return wins / runs;
};

assert.strictEqual(LEVELS.length, 13, 'phải có 13 level');
assert.strictEqual(Art.PICTURES.length, LEVELS.length, 'mỗi level một tranh');
assert.strictEqual(CELLS, 16, 'board 4x4');

// Không còn hộp màu: mọi thẻ nằm sẵn trên các móc, mỗi móc chỉ hiện 3 lớp ngoài cùng.
assert.strictEqual(VISIBLE, 3);
assert.strictEqual(dealSize(93), 93);

const rates = [];
LEVELS.forEach((config, i) => {
  const counts = countsOf(i);
  const regions = Object.values(counts).reduce((a, b) => a + b, 0);
  const colorsUsed = Object.keys(counts).length;
  Object.keys(counts).forEach((c) => assert.ok(Art.COLORS[c], `level ${i + 1}: màu lạ ${c}`));

  const round = newRound(i);
  const total = regions * 3;
  assert.strictEqual(round.tiles.length, total, `level ${i + 1}: 3 thẻ cho mỗi vùng`);
  Object.entries(colorCounts(round, ['board', 'box'])).forEach(([c, n]) => {
    assert.strictEqual(n, counts[c] * 3, `level ${i + 1}: màu ${c}`);
  });

  // Vào màn: đã có sẵn một đợt 30 thẻ; ô không móc thì trống, mọi móc khác đều có thẻ.
  const holes = config.holes || [];
  assert.strictEqual(round.boardCount(), total, `level ${i + 1}: mọi thẻ phải nằm sẵn trên móc`);
  assert.strictEqual(round.box.length, 0);
  assert.strictEqual(round.canDeal(), false);
  round.cells.forEach((stack, c) => {
    if (holes.includes(c)) assert.strictEqual(stack.length, 0, `level ${i + 1}: ô ${c} không có móc`);
    else assert.ok(stack.length >= 1, `level ${i + 1}: móc ${c} có ${stack.length} thẻ`);
  });
  assert.ok(round.freeIds().length > 0, `level ${i + 1}: phải có thẻ lấy được`);
  const heights = round.cells.filter((_, c) => !holes.includes(c)).map((s) => s.length);
  const gap = Math.max(...heights) - Math.min(...heights);
  if (config.spread) assert.ok(gap >= 2, `level ${i + 1}: các móc phải lệch nhau (chênh ${gap})`);
  else assert.ok(gap <= 1, `level ${i + 1}: rải đều`);

  // Số thẻ khóa, băng, úp đúng cấu hình.
  assert.strictEqual(round.lock.filter((n) => n > 0).length, config.lock || 0);
  assert.strictEqual(round.ice.filter((n) => n > 0).length, config.ice || 0);
  assert.strictEqual(round.hidden.filter(Boolean).length, config.mystery || 0);

  // Phải có cách thắng. Đi lại đúng các nước đó: chỉ thắng ở thẻ cuối, khay không bao giờ đầy.
  const solution = round.solution;
  const replay = newRound(i);
  let maxTray = 0;
  let deals = 0;
  solution.forEach((step, n) => {
    if (step === -1) {
      const boxBefore = replay.box.length;
      const placed = replay.deal();
      assert.strictEqual(placed.length, Math.min(DEAL_SIZE, boxBefore), `level ${i + 1}: mỗi đợt 30 thẻ hoặc phần còn lại`);
      holes.forEach((c) => assert.strictEqual(replay.cells[c].length, 0, `level ${i + 1}: phát thẻ vào ô không móc`));
      deals += 1;
      return;
    }
    const res = replay.tap(step);
    assert.ok(res, `level ${i + 1}: nước đi không hợp lệ ở bước ${n}`);
    maxTray = Math.max(maxTray, replay.tray.length);
    assert.strictEqual(res.status, n === solution.length - 1 ? 'won' : 'playing');
  });
  assert.ok(maxTray < TRAY_SIZE);
  assert.strictEqual(deals, 0, `level ${i + 1}: lượt mẫu không được bấm hộp`);
  assert.deepStrictEqual(replay.painted, counts, `level ${i + 1}: mọi vùng phải được tô`);

  const rate = botRate(i);
  rates.push(rate);
  const extras = ['holes', 'gates'].filter((k) => config[k]).map((k) => `${k} ${config[k].length}`)
    .concat(['lock', 'ice', 'mystery'].filter((k) => config[k]).map((k) => `${k} ${config[k]}`));
  console.log(
    `Level ${i + 1} (${Art.PICTURES[i].name}): ${regions} vùng, ${colorsUsed} màu, ${total} thẻ = sẵn ${round.boardCount()} + ${deals} đợt, `
    + `móc ${heights.join('')}, rải ${config.surface}${extras.length ? `, ${extras.join(', ')}` : ''}, bot thắng ${Math.round(rate * 100)}%`,
  );
});

// Level 1 ngắn và dễ; từ level 2 nhiều màu hơn hẳn và khó dần.
assert.ok(newRound(0).tiles.length <= 36 && newRound(0).box.length === 0, 'level 1 phải ngắn');
assert.ok(rates[0] >= 0.95, 'level 1 phải dễ');
assert.ok(rates[LEVELS.length - 1] < 0.15 && rates[1] < 0.8, "level 2 đã phải khó, level cuối khó nhất");
for (let i = 1; i < LEVELS.length; i++) {
  assert.ok(Object.keys(countsOf(i)).length >= 12, `level ${i + 1}: phải nhiều màu`);
  // Độ khó tăng đều: tỉ lệ bot thắng phải giảm hẳn từ level này sang level sau.
  assert.ok(rates[i] < rates[i - 1], `level ${i + 1} phải khó hơn level trước (bot thắng ${rates[i]} so với ${rates[i - 1]})`);
}

// Độ khó rải: cùng một tranh, rải khó thì lúc lấy một thẻ, ít khi có thẻ cùng màu khác đang lộ trên bề mặt.
{
  const counts = countsOf(1);
  const pairedShare = (surface) => {
    let paired = 0;
    let taps = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = new Round(1, counts, seed, surface);
      r.solution.forEach((step) => {
        if (step === -1) { r.deal(); return; }
        const color = r.tiles[step].color;
        if (r.freeIds().some((id) => id !== step && r.tiles[id].color === color)) paired += 1;
        taps += 1;
        r.tap(step);
      });
      assert.strictEqual(r.status, 'won');
    }
    return paired / taps;
  };
  const easy = pairedShare(0);
  const hard = pairedShare(1);
  console.log(`Tỉ lệ lần lấy thẻ mà bề mặt có thẻ trùng màu: rải dễ ${Math.round(easy * 100)}%, rải khó ${Math.round(hard * 100)}%`);
  assert.ok(hard < easy - 0.1, 'rải khó phải để lộ ít thẻ trùng màu hơn rải dễ');
}

// Chỉ thẻ ngoài cùng của móc chạm được; lấy đi thì thẻ phía sau lộ ra.
{
  const r = newRound(0);
  const stack = r.cells.find((s) => s.length >= 2);
  assert.ok(stack, 'phải có móc từ 2 thẻ');
  const [below, top] = stack.slice(-2);
  assert.strictEqual(r.isFree(below), false);
  assert.strictEqual(r.tap(below), null);
  assert.ok(r.tap(top));
  assert.strictEqual(r.isFree(below), true);
}

// Thẻ khóa nằm dưới lớp thứ 3 (chưa hiện) không bớt nấc khi ghép bộ.
{
  // Các thẻ mà lời giải cần lấy trước khi có bộ đầu tiên: không được gắn khóa thử lên chúng.
  const probe = newRound(4);
  const needed = new Set();
  for (let k = 0; probe.matched < 1; k++) { needed.add(probe.solution[k]); assert.ok(probe.tap(probe.solution[k])); }
  const r = newRound(4);
  const stack = r.cells.find((st) => st.length > VISIBLE && !needed.has(st[0]) && !needed.has(st[st.length - 2]));
  const deep = stack[0];
  r.lock[deep] = 3;
  const shown = stack[stack.length - 2];
  r.lock[shown] = 3;
  let i = 0;
  while (r.matched < 1) assert.ok(r.tap(r.solution[i++]));
  if (r.tiles[deep].zone === 'board' && stack.indexOf(deep) < stack.length - VISIBLE) assert.strictEqual(r.lock[deep], 3);
  if (r.tiles[shown].zone === 'board' && stack.indexOf(shown) >= stack.length - VISIBLE) assert.strictEqual(r.lock[shown], 2);
}

// Ghép 3 cùng màu tô đúng một vùng, theo thứ tự vùng của màu đó.
{
  const r = newRound(0);
  const seen = {};
  let events = 0;
  for (const step of r.solution) {
    if (step === -1) { r.deal(); continue; }
    const res = r.tap(step);
    if (!res.paintEvent) continue;
    assert.strictEqual(res.paintEvent.index, seen[res.paintEvent.color] || 0);
    seen[res.paintEvent.color] = res.paintEvent.index + 1;
    if (++events === 5) break;
  }
  assert.strictEqual(events, 5);
}

// Thẻ băng: không lấy được; mỗi lần lấy thẻ ở móc kề cạnh thì nứt một lần, nứt đủ thì tan.
{
  const r = newRound(0);
  const iced = topOf(r, 5);
  r.ice[iced] = ICE_HITS;
  assert.strictEqual(r.isFree(iced), false);
  assert.strictEqual(r.tap(iced), null);
  assert.ok(r.tap(topOf(r, 4)));
  assert.strictEqual(r.ice[iced], 1);
  assert.ok(r.tap(topOf(r, 0)), 'móc không kề cạnh');
  assert.strictEqual(r.ice[iced], 1, 'móc chéo hoặc xa không làm nứt băng');
  assert.ok(r.tap(topOf(r, 6)));
  assert.strictEqual(r.ice[iced], 0);
  assert.strictEqual(r.isFree(iced), true);
}

// Thẻ khóa: mở sau đúng số bộ 3 ghi trên khóa.
{
  const r = newRound(0);
  const locked = r.solution[r.solution.length - 1]; // thẻ mà lượt mẫu lấy sau cùng
  r.lock[locked] = 2;
  let i = 0;
  while (r.matched < 1) assert.ok(r.tap(r.solution[i++]));
  assert.strictEqual(r.lock[locked], 1);
  while (r.matched < 2) assert.ok(r.tap(r.solution[i++]));
  assert.strictEqual(r.lock[locked], 0);
}

// Móc bị chặn: thẻ sau thanh chắn không lấy được cho tới khi tô đủ số vùng.
{
  const level = LEVELS.findIndex((cfg) => cfg.gates);
  const gate = LEVELS[level].gates[0];
  const r = newRound(level);
  assert.ok(r.cells[gate.cell].length > 0, 'móc bị chặn vẫn có thẻ từ đầu');
  assert.strictEqual(r.gateLeft(gate.cell), gate.need);
  assert.strictEqual(r.isFree(topOf(r, gate.cell)), false);
  assert.strictEqual(r.tap(topOf(r, gate.cell)), null);
  for (const step of r.solution) {
    if (r.matched >= gate.need) break;
    if (step === -1) r.deal(); else r.tap(step);
  }
  assert.strictEqual(r.gateLeft(gate.cell), 0);
}

// Thẻ úp lật ngửa khi vào khay.
{
  const r = newRound(0);
  const id = r.freeIds()[0];
  r.hidden[id] = true;
  assert.ok(r.tap(id));
  assert.strictEqual(r.hidden[id], false);
}

// Chống kẹt: không còn thẻ nào lấy được và hộp đã hết thì khóa, băng của thẻ ngoài cùng tự vỡ.
{
  const r = newRound(0);
  const keep = r.freeIds()[0];
  r.tiles.forEach((t) => { if (t.id !== keep) r.ice[t.id] = ICE_HITS; });
  const res = r.tap(keep);
  assert.strictEqual(res.rescued, true);
  assert.ok(r.freeIds().length > 0);
}

// Hoàn tác trả thẻ về ngoài cùng móc cũ.
{
  const r = newRound(1);
  const id = r.freeIds()[0];
  const cell = r.tiles[id].cell;
  r.tap(id);
  const entry = r.undo();
  assert.strictEqual(entry.id, id);
  assert.strictEqual(r.tiles[id].zone, 'board');
  assert.strictEqual(topOf(r, cell), id);
  assert.strictEqual(r.boosters.undo, 1);
}

// Khay đầy là thua; rút ô cứu được và thẻ trên kệ chạm lại được.
{
  const r = newRound(1);
  while (r.status === 'playing') {
    const held = {};
    r.tray.forEach((i) => { held[r.tiles[i].color] = (held[r.tiles[i].color] || 0) + 1; });
    const next = r.freeIds().find((id) => (held[r.tiles[id].color] || 0) < 2);
    assert.notStrictEqual(next, undefined, 'phải dựng được khay đầy');
    r.tap(next);
  }
  assert.strictEqual(r.status, 'lost');
  assert.strictEqual(r.deal(), null, 'thua rồi thì không phát thẻ');
  const ids = r.pull();
  assert.strictEqual(ids.length, 3);
  assert.strictEqual(r.status, 'playing');
  assert.strictEqual(r.canPull(), false);
  assert.ok(r.tap(ids[0]));
  assert.strictEqual(r.shelf.length, 2);
}

// Xáo bàn giữ nguyên số lượng mỗi màu trên board, không đụng tới khay và hộp.
{
  const r = newRound(1);
  r.freeIds().slice(0, 4).forEach((id) => r.tap(id));
  const trayColors = r.tray.map((id) => r.tiles[id].color);
  const boxColors = r.box.map((id) => r.tiles[id].color);
  const before = colorCounts(r, ['board']);
  assert.ok(r.shuffle().length > 0);
  assert.deepStrictEqual(colorCounts(r, ['board']), before);
  assert.deepStrictEqual(r.tray.map((id) => r.tiles[id].color), trayColors);
  assert.deepStrictEqual(r.box.map((id) => r.tiles[id].color), boxColors);
  assert.strictEqual(r.canShuffle(), false);
}

console.log('Tất cả test đều đạt.');

// ---------- Rương + chìa khóa, rèm, thẻ hẹn giờ ----------
{
  const { Round, LEVELS, VISIBLE } = require('../js/core.js');
  const Art = require('../js/art.js');
  LEVELS.forEach((config, i) => {
    const r = new Round(i, Art.regionCounts(config.picture));
    assert.strictEqual(r.key.filter(Boolean).length, (config.chests || []).length, 'mỗi rương một chìa');
    assert.ok(r.timer.filter((n) => n > 0).length <= (config.timer || 0));
    (config.chests || []).forEach((c) => {
      assert.strictEqual(r.barrier(c), 'chest');
      r.key.forEach((k, id) => { if (k) assert.notStrictEqual(r.tiles[id].cell, c, 'chìa không nằm trong rương'); });
    });
    // Lượt mẫu vẫn thắng: lấy kịp mọi thẻ hẹn giờ, mở được mọi rương.
    r.solution.forEach((id) => { assert.ok(r.tap(id), `level ${i + 1}: lượt mẫu bị chặn`); });
    assert.strictEqual(r.status, 'won');
  });
  // Lấy chìa thì rương mở.
  const li = LEVELS.findIndex((c) => (c.chests || []).length === 1 && !c.timer);
  let r = new Round(li, Art.regionCounts(LEVELS[li].picture));
  const chest = LEVELS[li].chests[0];
  for (const id of r.solution) { const wasKey = r.key[id]; r.tap(id); if (wasKey) break; }
  assert.strictEqual(r.barrier(chest) === 'chest', false);
  // Rèm đổi trạng thái sau mỗi 2 lần lấy thẻ.
  const ci = LEVELS.findIndex((c) => (c.curtains || []).length);
  r = new Round(ci, Art.regionCounts(LEVELS[ci].picture));
  const cur = LEVELS[ci].curtains[0];
  const shut0 = r.barrier(cur.cell) === 'curtain';
  assert.strictEqual(shut0, cur.phase === 0);
  assert.strictEqual(r.curtainIn(cur.cell), 2);
  const takeElsewhere = () => r.tap(r.freeIds().find((id) => r.tiles[id].cell !== cur.cell && !r.timer[id]));
  takeElsewhere();
  assert.strictEqual(r.barrier(cur.cell) === 'curtain', shut0);
  takeElsewhere();
  assert.strictEqual(r.barrier(cur.cell) === 'curtain', !shut0);
  // Thẻ hẹn giờ về 0 thì thua; hoàn tác cứu được ván.
  const ti = LEVELS.findIndex((c) => c.timer);
  r = new Round(ti, Art.regionCounts(LEVELS[ti].picture));
  const stack = r.cells.find((st) => st.length >= VISIBLE);
  const bomb = stack[stack.length - 1];
  r.timer.fill(0);
  r.timer[bomb] = 2;
  const other = () => r.freeIds().find((id) => r.tiles[id].cell !== r.tiles[bomb].cell);
  assert.strictEqual(r.tap(other()).status, 'playing');
  assert.strictEqual(r.timer[bomb], 1);
  const res = r.tap(other());
  assert.strictEqual(res.status, 'lost');
  assert.strictEqual(res.boom, bomb);
  assert.ok(r.undo());
  assert.strictEqual(r.status, 'playing');
  assert.strictEqual(r.timer[bomb], 4);
  console.log('Rương, rèm, thẻ hẹn giờ: đạt.');
}
