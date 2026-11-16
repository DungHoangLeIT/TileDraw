/* Tô Tranh: tranh nét vẽ dạng SVG tự vẽ. Mỗi vùng tô là một mục riêng, vẽ theo thứ tự từ sau ra trước. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PaintArt = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const W = 360;
  const H = 240;
  const INK = '#5a3214';

  // Màu của thẻ. Vùng tranh có thể dùng sắc độ riêng (fill) nhưng vẫn thuộc một màu thẻ.
  const COLORS = {
    red: { hex: '#e5484d', label: 'Đỏ' },
    orange: { hex: '#f08a24', label: 'Cam' },
    yellow: { hex: '#f2c230', label: 'Vàng' },
    green: { hex: '#3fae5a', label: 'Xanh lá' },
    teal: { hex: '#1fb5a6', label: 'Xanh ngọc' },
    blue: { hex: '#3b8fe8', label: 'Xanh dương' },
    purple: { hex: '#8e5bd9', label: 'Tím' },
    pink: { hex: '#f277a8', label: 'Hồng' },
    brown: { hex: '#a06a3c', label: 'Nâu' },
    gray: { hex: '#8b97a3', label: 'Xám' },
    sky: { hex: '#9fd6ff', label: 'Xanh da trời' },
    cream: { hex: '#ffe6a3', label: 'Kem' },
    mint: { hex: '#a6e3a1', label: 'Xanh bạc hà' },
    lavender: { hex: '#cdb8f7', label: 'Tím nhạt' },
    lime: { hex: '#a8d62c', label: 'Xanh chanh' },
    olive: { hex: '#7c8a2c', label: 'Xanh ô liu' },
    navy: { hex: '#2f4aa0', label: 'Xanh đậm' },
    maroon: { hex: '#8f2740', label: 'Đỏ đậm' },
    magenta: { hex: '#d240b6', label: 'Hồng tím' },
    charcoal: { hex: '#4a4a55', label: 'Than chì' },
  };

  /* ---------- Hình cơ bản ---------- */
  const at = (x, y, rot, sx, sy) => {
    let t = `translate(${x} ${y})`;
    if (rot) t += ` rotate(${rot})`;
    if (sx !== undefined && sx !== 1) t += ` scale(${sx}${sy === undefined ? '' : ` ${sy}`})`;
    else if (sy !== undefined) t += ` scale(1 ${sy})`;
    return t;
  };
  const ci = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  const el = (cx, cy, rx, ry, rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`;
  const rr = (x, y, w, h, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r || 0}"/>`;
  const pa = (d, transform) => `<path d="${d}"${transform ? ` transform="${transform}"` : ''}/>`;

  const cloud = (x, y, s) => pa('M-22 8a10 10 0 0 1 4-16 14 14 0 0 1 24-6 10 10 0 0 1 16 8 8 8 0 0 1-2 14z', at(x, y, 0, s));
  const leaf = (x, y, rot, len) => {
    const w = len * 0.3;
    return pa(`M0 0C${-w} ${-len * 0.3} ${-w} ${-len * 0.75} 0 ${-len}C${w} ${-len * 0.75} ${w} ${-len * 0.3} 0 0z`, at(x, y, rot));
  };
  const petals = (x, y, r) => {
    let s = '';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      s += ci((x + Math.cos(a) * r).toFixed(1), (y + Math.sin(a) * r).toFixed(1), (r * 0.72).toFixed(1));
    }
    return s;
  };
  const star = (x, y, r) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * rad).toFixed(1)} ${(y + Math.sin(a) * rad).toFixed(1)}`;
    }
    return pa(`${d}z`);
  };

  // R: vùng tô (màu thẻ, hình, sắc độ riêng, điểm giọt màu rơi). D: nét trang trí không tô.
  const R = (c, s, fill, pt) => ({ c, s, fill: fill || COLORS[c].hex, at: pt });
  const D = (s) => ({ d: s });
  const eye = (x, y, r) => D(`<g stroke="none"><circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff"/></g>`);
  const line = (d) => D(`<path d="${d}" fill="none"/>`);

  /* ---------- Tranh 1: voi con trên đồi ---------- */
  function elephant() {
    const items = [
      R('blue', rr(0, 0, W, H), '#cdeeff', [40, 110]),
      R('yellow', ci(318, 36, 20), '#ffd84d'),
      R('blue', cloud(70, 44, 1.25), '#8fd0ff'),
      R('blue', cloud(258, 46, 1.05), '#8fd0ff'),
      R('pink', petals(128, 28, 9), '#ff9dbf'),
      R('yellow', ci(128, 28, 5.5), '#ffd84d'),
      R('pink', petals(200, 24, 8), '#ff9dbf'),
      R('yellow', ci(200, 24, 5), '#ffd84d'),
      R('green', pa('M0 240V192Q90 164 180 180T360 188V240z'), '#9ad873', [330, 222]),
    ];
    [[-44, 50], [-14, 74], [14, 70], [42, 52]].forEach(([rot, len], i) => {
      items.push(R('green', leaf(56, 208, rot, len), i % 2 ? '#3fae5a' : '#63c46b'));
      items.push(R('green', leaf(304, 208, -rot, len), i % 2 ? '#63c46b' : '#3fae5a'));
    });
    const tuft = 'M-13 0L-9-14-4-3 0-19 4-3 9-13 13 0z';
    items.push(
      R('green', pa(tuft, at(112, 196)), '#2f9a4c'),
      R('green', pa(tuft, at(252, 199)), '#2f9a4c'),
    );
    const bud = 'M-9 0c-4-10 2-14 5-8 1-8 7-8 8 0 3-6 9-2 5 8z';
    [[96, 226], [176, 231], [262, 227]].forEach(([x, y]) => items.push(R('orange', pa(bud, at(x, y)), '#ff9a3c')));

    items.push(
      line('M148 166q-20 2-22-14'),
      D(`<circle cx="125" cy="150" r="4" fill="#fff"/>`),
      R('gray', rr(196, 162, 26, 52, 11), '#98a2ad'),
      R('gray', el(180, 160, 42, 37), '#b9c2cb', [205, 150]),
      R('gray', rr(150, 172, 27, 48, 11), '#c6ced6'),
      R('gray', rr(184, 172, 27, 48, 11), '#c6ced6'),
      line('M156 218q7-6 14 0M190 218q7-6 14 0'),
      R('gray', el(126, 92, 34, 41), '#aab4be'),
      R('gray', el(234, 92, 34, 41), '#aab4be'),
      R('pink', el(130, 94, 20, 27), '#ffb9cd'),
      R('pink', el(230, 94, 20, 27), '#ffb9cd'),
      R('gray', el(180, 96, 47, 43), '#c6ced6', [180, 70]),
      R('pink', ci(147, 112, 7.5), '#ffa3bd'),
      R('pink', ci(213, 112, 7.5), '#ffa3bd'),
      R('gray', pa('M166 104c-3 18-6 36 4 46 9 9 26 6 28-8 1-9-9-13-12-6-2 5-6 3-6-3 0-10 3-19 4-29z'), '#b3bcc6', [171, 128]),
      line('M168 118h10M167 128h10'),
      eye(159, 90, 6.5),
      eye(201, 90, 6.5),
      line('M152 78q6-5 12-2M196 76q6-3 12 2M197 121q8 5 13-3'),
    );
    return { name: 'Voi con', items };
  }

  /* ---------- Tranh 2: mèo trong vườn ---------- */
  function cat() {
    const items = [
      R('blue', rr(0, 0, W, H), '#cdeeff', [30, 60]),
      R('yellow', ci(42, 36, 19), '#ffd84d'),
      R('blue', cloud(150, 30, 1.0), '#8fd0ff'),
      R('blue', cloud(258, 44, 1.2), '#8fd0ff'),
    ];
    for (let i = 0; i < 8; i++) {
      const x = 5 + i * 44;
      items.push(R('brown', pa(`M${x} 184V104l19-15 19 15V184z`), i % 2 ? '#c98d55' : '#dba56b'));
    }
    items.push(
      R('green', pa('M0 240V176Q180 160 360 176V240z'), '#9ad873', [128, 226]),
      R('green', cloud(36, 178, 1.7), '#3f9f55'),
      R('green', cloud(326, 180, 1.6), '#3f9f55'),
    );
    const stem = 'M-2 0V-36h4V0z M2-10q14-3 17-18-15 1-17 12z';
    const bloom = 'M-11-34c-3-15 4-19 7-10 1-11 7-11 8 0 3-9 10-5 7 10q-11 9-22 0z';
    [[82, 226, '#e5484d'], [112, 232, '#f0605f'], [286, 228, '#e5484d']].forEach(([x, y, fill]) => {
      items.push(R('green', pa(stem, at(x, y)), '#3fae5a'));
      items.push(R('red', pa(bloom, at(x, y)), fill));
    });
    items.push(
      R('purple', ci(248, 216, 14), '#a77be6'),
      line('M237 210q11 4 21-3M236 219q12 5 25-1M244 204q6 12 3 25'),
      R('orange', pa('M210 198c34 6 50-18 40-42-4-9-15-6-12 3 5 15-7 26-30 21z'), '#f39a3d', [247, 178]),
      R('orange', el(180, 184, 39, 35), '#f7a94b', [150, 182]),
      R('yellow', el(180, 192, 20, 23), '#ffe9a8'),
      R('orange', el(163, 216, 12, 8), '#f9bb6a'),
      R('orange', el(197, 216, 12, 8), '#f9bb6a'),
      R('orange', pa('M144 100l5-40 30 22z'), '#f39a3d'),
      R('orange', pa('M216 100l-5-40-30 22z'), '#f39a3d'),
      R('pink', pa('M151 90l3-19 15 11z'), '#ffa3bd'),
      R('pink', pa('M209 90l-3-19-15 11z'), '#ffa3bd'),
      R('orange', el(180, 114, 43, 37), '#f7a94b', [180, 92]),
      R('pink', pa('M174 117h12l-6 7z'), '#ff8fb1'),
      R('red', pa('M149 142q31 17 62 0l-2 10q-29 15-58 0z'), '#e5484d'),
      R('yellow', ci(180, 157, 6.5), '#ffd84d'),
      eye(162, 108, 6),
      eye(198, 108, 6),
      line('M180 124v5q-6 6-11 1M180 129q6 6 11 1M136 112l-20-4M137 120l-19 4M224 112l20-4M223 120l19 4'),
      R('purple', el(291, 86, 9, 13, -24), '#a77be6'),
      R('purple', el(309, 86, 9, 13, 24), '#a77be6'),
      line('M300 78v20M300 78l-4-8M300 78l4-8'),
    );
    return { name: 'Mèo trong vườn', items };
  }

  /* ---------- Tranh 3: dưới đáy biển ---------- */
  function sea() {
    const items = [
      R('blue', rr(0, 0, W, H), '#a9dcff', [20, 20]),
      R('yellow', pa('M0 240V202Q90 188 180 199T360 195V240z'), '#ffe08a', [150, 228]),
    ];
    const blade = 'M-6 0c-9-19 9-32-2-56 15 15 3 35 11 56z';
    [[20, 1.3], [40, 1.0], [152, 1.1], [170, 1.45], [328, 1.25], [346, 0.95]].forEach(([x, s], i) => {
      items.push(R('green', pa(blade, at(x, 208, 0, i % 2 ? -s : s, s)), i % 2 ? '#3fae5a' : '#63c46b'));
    });
    const rock = 'M-22 0q2-22 22-20t22 20z';
    items.push(
      R('gray', pa(rock, at(92, 210, 0, 1.25)), '#9aa5b0'),
      R('gray', pa(rock, at(120, 214, 0, 0.8)), '#b3bcc6'),
      R('gray', pa(rock, at(300, 211, 0, 1.2)), '#9aa5b0'),
    );
    const coral = 'M-4 0V-20l-12-12 5-5 7 8V-46h8v19l8-9 5 5-13 13V0z';
    items.push(
      R('pink', pa(coral, at(64, 208)), '#ff8fb1'),
      R('pink', pa(coral, at(226, 210, 0, 0.9)), '#ffa3bd'),
      R('pink', pa('M-11 4q-4-17 11-17t11 17z', at(136, 226)), '#ffb9cd'),
      line('M131 229l3-11M136 230v-13M141 229l-3-11'),
      R('orange', star(196, 219, 13), '#ff9a3c'),
      R('brown', rr(244, 190, 40, 20, 2), '#b47a45'),
      R('brown', pa('M244 190q0-17 20-17t20 17z'), '#8f5c2e'),
      R('yellow', ci(264, 191, 4.5), '#ffd84d'),
    );

    // Cá lớn màu cam bơi sang phải.
    items.push(
      R('orange', pa('M96 92l-24-17v34z'), '#f08a24'),
      R('orange', pa('M112 73q10-16 24-6l-7 8z'), '#f08a24'),
      R('orange', el(126, 92, 35, 21), '#f9a23f', [150, 97]),
      R('yellow', pa('M113 73q9 19 0 38h9q9-19 0-38z'), '#ffe27a'),
      R('yellow', pa('M131 72q9 20 0 40h9q9-20 0-40z'), '#ffe27a'),
      eye(148, 87, 4),
      line('M152 98q4 3 8 0'),
    );
    // Cá tím bơi sang trái.
    items.push(
      R('purple', pa('M282 58l19-13v26z'), '#8e5bd9'),
      R('purple', pa('M266 43q-8-12-19-5l6 6z'), '#8e5bd9'),
      R('purple', el(258, 58, 27, 16), '#a77be6'),
      eye(241, 54, 3.2),
    );
    // Hai cá đỏ nhỏ.
    items.push(
      R('red', pa('M316 132l13-9v18z'), '#e5484d'),
      R('red', el(302, 132, 17, 10), '#f0605f'),
      eye(292, 130, 2.4),
      R('red', pa('M48 152l-13-9v18z'), '#e5484d'),
      R('red', el(62, 152, 17, 10), '#f0605f'),
      eye(72, 150, 2.4),
    );
    // Bạch tuộc xanh ngọc.
    const arm = 'M-5 0q-7 16 3 29 5 5 7 0-8-13-1-29z';
    [[-16, 22], [-6, 8], [6, -8], [16, -22]].forEach(([dx, rot]) => {
      items.push(R('teal', pa(arm, at(204 + dx, 150, rot)), '#1fb5a6'));
    });
    items.push(
      R('teal', el(204, 138, 23, 21), '#3fcfc0'),
      eye(196, 136, 3.4),
      eye(212, 136, 3.4),
      line('M199 146q5 4 10 0'),
    );
    [[166, 52, 7], [176, 32, 5], [224, 96, 5], [332, 72, 7], [322, 50, 4.5], [30, 64, 6.5]].forEach(([x, y, r]) => {
      items.push(R('blue', ci(x, y, r), '#e6f6ff'));
      items.push(D(`<path d="M${x - r * 0.45} ${y - r * 0.2}a${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.4}-${r * 0.4}" fill="none" stroke-width="1"/>`));
    });
    return { name: 'Đáy biển', items };
  }

  /* ---------- Bông hoa: tranh mở đầu, ít vùng ---------- */
  function flower() {
    const items = [
      R('blue', rr(0, 0, W, H), '#cdeeff', [40, 40]),
      R('green', pa('M0 240V196Q180 176 360 196V240z'), '#9ad873', [60, 226]),
      D('<path d="M180 214V120" fill="none" stroke-width="5"/>'),
      R('green', leaf(180, 200, -62, 58), '#3fae5a'),
      R('green', leaf(180, 188, 62, 58), '#63c46b'),
    ];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      items.push(R('pink', ci((180 + Math.cos(a) * 32).toFixed(1), (96 + Math.sin(a) * 32).toFixed(1), 24), i % 2 ? '#ff9dbf' : '#ff86b0'));
    }
    items.push(
      R('yellow', ci(180, 96, 21), '#ffd84d'),
      eye(172, 92, 3.2),
      eye(188, 92, 3.2),
      line('M171 102q9 8 18 0'),
    );
    return { name: 'Bông hoa', items };
  }

  /* ---------- Ngôi nhà ---------- */
  function house() {
    const items = [
      R('blue', rr(0, 0, W, H), '#cdeeff', [20, 90]),
      R('yellow', ci(44, 40, 20), '#ffd84d'),
      R('blue', cloud(150, 34, 1.1), '#8fd0ff'),
      R('blue', cloud(296, 48, 1.2), '#8fd0ff'),
      R('green', pa('M0 240V182Q180 168 360 182V240z'), '#9ad873', [30, 230]),
      R('yellow', pa('M166 240l12-44h26l16 44z'), '#ffe9a8'),
      R('brown', rr(291, 150, 14, 46, 3), '#a06a3c'),
      R('green', ci(282, 134, 22), '#3fae5a'),
      R('green', ci(314, 136, 22), '#63c46b'),
      R('green', ci(298, 112, 24), '#3fae5a'),
      R('gray', ci(232, 46, 8), '#c6ced6'),
      R('gray', ci(246, 28, 11), '#c6ced6'),
      R('red', rr(222, 60, 17, 40, 2), '#c9483f'),
      R('orange', rr(128, 112, 126, 84, 3), '#ffcf8a', [150, 172]),
      R('red', pa('M114 114L191 54l77 60z'), '#e5484d', [150, 104]),
      R('yellow', ci(191, 92, 9.5), '#ffd84d'),
      R('brown', rr(178, 150, 26, 46, 3), '#a06a3c'),
      D(`<circle cx="198" cy="175" r="2.2" fill="${INK}" stroke="none"/>`),
      R('blue', rr(140, 128, 27, 25, 3), '#8fd0ff'),
      R('blue', rr(215, 128, 27, 25, 3), '#8fd0ff'),
      line('M153.5 128v25M140 140.5h27M228.5 128v25M215 140.5h27'),
    ];
    for (let i = 0; i < 5; i++) {
      const x = 14 + i * 21;
      items.push(R('brown', pa(`M${x} 206V172l8-9 8 9V206z`), i % 2 ? '#c98d55' : '#dba56b'));
    }
    items.push(
      R('green', cloud(128, 204, 0.8), '#3f9f55'),
      R('green', cloud(262, 204, 0.8), '#3f9f55'),
    );
    [[58, 224], [98, 230], [334, 222]].forEach(([x, y]) => {
      items.push(R('pink', petals(x, y, 6), '#ff9dbf'));
      items.push(D(`<circle cx="${x}" cy="${y}" r="3.2" fill="#ffd84d" stroke-width="1.4"/>`));
    });
    return { name: 'Ngôi nhà', items };
  }

  /* ---------- Khinh khí cầu ---------- */
  function balloons() {
    const items = [
      R('blue', rr(0, 0, W, H), '#cdeeff', [16, 130]),
      R('yellow', ci(322, 38, 19), '#ffd84d'),
      R('blue', cloud(52, 40, 1.1), '#8fd0ff'),
      R('blue', cloud(180, 26, 0.9), '#8fd0ff'),
      R('blue', cloud(238, 134, 1.0), '#8fd0ff'),
      R('green', pa('M0 240V200Q70 168 150 198T360 190V240z'), '#9ad873', [334, 204]),
      R('green', pa('M0 240V216Q100 198 200 218T360 212V240z'), '#63c46b', [40, 234]),
      R('blue', el(254, 226, 44, 8), '#8fd0ff'),
    ];
    [[26, 208], [48, 214], [128, 206]].forEach(([x, y]) => {
      items.push(R('green', pa('M-12 0L0-34 12 0z', at(x, y)), '#2f9a4c'));
    });
    const n = (v) => Number(v.toFixed(1));
    const balloon = (cx, cy, r, c1, c2, c3) => {
      const by = n(cy + r * 1.5);
      items.push(
        line(`M${n(cx - r * 0.55)} ${n(cy + r * 0.9)}L${n(cx - r * 0.22)} ${by}M${n(cx + r * 0.55)} ${n(cy + r * 0.9)}L${n(cx + r * 0.22)} ${by}`),
        R(c1, el(cx, cy, r, n(r * 1.1))),
        R(c2, el(cx, cy, n(r * 0.62), n(r * 1.1))),
        R(c3, el(cx, cy, n(r * 0.24), n(r * 1.1))),
        R('brown', rr(n(cx - r * 0.26), by, n(r * 0.52), n(r * 0.38), 2), '#b47a45'),
      );
    };
    balloon(108, 84, 38, 'red', 'yellow', 'orange');
    balloon(222, 62, 27, 'purple', 'pink', 'teal');
    balloon(306, 118, 21, 'teal', 'yellow', 'red');
    [[168, 228], [86, 232], [330, 230]].forEach(([x, y]) => {
      items.push(R('pink', petals(x, y, 5.5), '#ff9dbf'));
      items.push(D(`<circle cx="${x}" cy="${y}" r="3" fill="#ffd84d" stroke-width="1.4"/>`));
    });
    return { name: 'Khinh khí cầu', items };
  }

  // Họ màu gần nhau: vùng thứ k của một màu gốc lấy sắc thứ k trong họ, nên tranh nhiều màu hơn
  // và các thẻ gần màu dễ bị nhầm (xanh lá / xanh chanh / ô liu, đỏ / đỏ đậm...).
  const FAMILY = {
    blue: ['blue', 'sky', 'navy', 'teal'],
    green: ['green', 'lime', 'olive', 'mint'],
    yellow: ['yellow', 'cream', 'orange'],
    orange: ['orange', 'brown', 'cream'],
    red: ['red', 'maroon', 'magenta'],
    pink: ['pink', 'magenta', 'lavender'],
    purple: ['purple', 'lavender', 'navy'],
    gray: ['gray', 'charcoal', 'lavender'],
    brown: ['brown', 'maroon', 'cream'],
    teal: ['teal', 'mint', 'sky'],
  };

  /** Tách mỗi màu gốc của tranh thành tối đa `rich` sắc trong họ màu của nó. */
  function variant(pic, rich) {
    const seen = {};
    pic.items.filter((it) => it.c).forEach((it) => {
      const family = FAMILY[it.c];
      const k = seen[it.c] || 0;
      seen[it.c] = k + 1;
      const c = family[k % Math.min(rich, family.length)];
      if (c !== it.c) { it.c = c; it.fill = COLORS[c].hex; }
    });
    return pic;
  }

  /** Gán lại màu thẻ cho từng vùng theo thứ tự vẽ; vùng được tô đúng màu của thẻ. */
  function recolor(pic, list) {
    const regions = pic.items.filter((it) => it.c);
    if (regions.length !== list.length) throw new Error(`${pic.name}: cần ${regions.length} màu, có ${list.length}`);
    regions.forEach((it, i) => { it.c = list[i]; it.fill = COLORS[list[i]].hex; });
    return pic;
  }

  // Tranh 2 dùng 16 màu, tranh 3 dùng 20 màu: nhiều màu, ít bộ mỗi màu nên khó hơn hẳn tranh 1.
  const CAT_COLORS = [
    'sky', 'yellow', 'lavender', 'lavender',
    'brown', 'cream', 'brown', 'cream', 'brown', 'cream', 'brown', 'cream',
    'mint', 'green', 'olive',
    'lime', 'red', 'lime', 'magenta', 'lime', 'red',
    'purple', 'orange', 'orange', 'cream', 'orange', 'orange',
    'brown', 'brown', 'pink', 'pink', 'orange', 'pink', 'teal', 'yellow',
    'blue', 'blue',
  ];
  const SEA_COLORS = [
    'sky', 'cream',
    'green', 'lime', 'green', 'lime', 'olive', 'olive',
    'gray', 'gray', 'charcoal',
    'pink', 'magenta', 'lavender', 'yellow',
    'brown', 'maroon', 'yellow',
    'orange', 'orange', 'orange', 'cream', 'cream',
    'navy', 'navy', 'purple',
    'maroon', 'red', 'maroon', 'red',
    'teal', 'teal', 'teal', 'teal', 'mint',
    'blue', 'lavender', 'blue', 'lavender', 'blue', 'lavender',
  ];

  // 13 tranh theo thứ tự level: số màu tăng dần nhờ tách sắc trong cùng họ màu.
  const PICTURES = [
    flower(),
    variant(elephant(), 2),
    variant(house(), 2),
    recolor(cat(), CAT_COLORS),
    variant(balloons(), 3),
    variant(sea(), 2),
    variant(elephant(), 3),
    variant(house(), 3),
    variant(cat(), 3),
    variant(balloons(), 4),
    recolor(sea(), SEA_COLORS),
    variant(elephant(), 4),
    variant(sea(), 4),
  ];

  /** Số vùng theo từng màu thẻ: quyết định số bộ 3 của màn. */
  function regionCounts(index) {
    const counts = {};
    PICTURES[index].items.forEach((it) => { if (it.c) counts[it.c] = (counts[it.c] || 0) + 1; });
    return counts;
  }

  /**
   * Mỗi vùng gồm lớp nền trắng và lớp màu bị cắt bởi một hình tròn bán kính 0.
   * Khi tô, game cho hình tròn nở ra từ điểm giọt màu rơi.
   */
  function pictureSVG(index) {
    const pic = PICTURES[index];
    let clips = '';
    let body = '';
    let k = 0;
    pic.items.forEach((it) => {
      if (it.d) { body += it.d; return; }
      clips += `<clipPath id="rc-${k}"><circle cx="0" cy="0" r="0"/></clipPath>`;
      const pt = it.at ? ` data-at="${it.at.join(',')}"` : '';
      body += `<g class="region" data-region="${k}" data-color="${it.c}"${pt}>`
        + `<g class="base" fill="#fff6e0">${it.s}</g>`
        + `<g class="paint" fill="${it.fill}" clip-path="url(#rc-${k})">${it.s}</g></g>`;
      k += 1;
    });
    return `<svg class="pic" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tranh ${pic.name}">`
      + `<defs>${clips}<clipPath id="pic-frame"><rect width="${W}" height="${H}" rx="10"/></clipPath></defs>`
      + `<g clip-path="url(#pic-frame)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${body}</g>`
      + `<rect x="1.2" y="1.2" width="${W - 2.4}" height="${H - 2.4}" rx="9" fill="none" stroke="${INK}" stroke-width="2.4"/></svg>`;
  }


  /**
   * Item trên thẻ: mỗi màu là một sự vật có màu đặc trưng (hoa hồng, lá xanh, mặt trời vàng, giọt nước xanh...).
   * Lớp ga = tông sáng của màu thẻ, gb = trắng, gc = tông đậm, gn = chỉ có nét; màu lấy từ biến --c của thẻ.
   */
  const G = (body) => `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
  const ring = (n, r, fn, start) => Array.from({ length: n }, (_, i) => {
    const a = (start || 0) + (i * 2 * Math.PI) / n;
    return fn((16 + r * Math.sin(a)).toFixed(1), (16 - r * Math.cos(a)).toFixed(1), ((a * 180) / Math.PI).toFixed(0));
  }).join('');
  const LEAFLET = '<path d="M16.500 6.500c2-3.300 5-3.600 7.500-2.500-1 3.300-4.200 4.500-7.500 2.500z" fill="#8ee07a"/>';
  const GLYPHS = {
    red: G(`<path class="ga" d="M16 10.500c-3-3.200-10.500-2-10.500 6 0 6 4 11 7.200 11 1.500 0 2.200-.8 3.300-.8s1.800.8 3.300.8c3.200 0 7.200-5 7.200-11 0-8-7.500-9.200-10.500-6z"/><path class="gn" d="M16 10.500c0-2.500.6-4.500 1.500-6"/>${LEAFLET}<path class="gw" d="M9.500 15c.3-1.800 1.300-2.800 2.800-3.200"/>`),
    orange: G(`<path d="M16 11c-3.500-3.500-2.500-7 0-8.500 2.500 1.500 3.500 5 0 8.500zM15 11c-5-.5-7.500-3.500-6.500-6 3.200-.3 5.800 2 6.500 6zM17 11c5-.5 7.500-3.500 6.500-6-3.200-.3-5.800 2-6.500 6z" fill="#8ee07a"/><path class="ga" d="M10.200 10.500h11.600c1.200 0 2 1.200 1.500 2.300L18 27.500c-.8 1.900-3.200 1.900-4 0L8.700 12.800c-.5-1.100.3-2.300 1.500-2.300z"/><path class="gn" d="M12 15.500h4M15.500 20.500h3.500"/>`),
    yellow: G(`${ring(8, 11.500, (x, y, a) => `<path class="ga" d="M-2.300 2.600L0-3 2.300 2.600z" transform="translate(${x} ${y}) rotate(${a})"/>`)}<circle class="ga" cx="16" cy="16" r="7"/><path class="gw" d="M12 15a4.200 4.200 0 0 1 3-3"/>`),
    green: G('<path class="ga" d="M5.500 26.500C4.500 14 13 5 27 5c0 14-8.500 22.500-21.500 21.500z"/><path class="gn" d="M7.500 24.500L21 11M12 20v-6M12 20h6M16.500 15.500v-4.500M16.500 15.500H21"/>'),
    teal: G('<path class="ga" d="M9 5.500h14l6 8.500-13 13.500L3 14z"/><path class="gw" d="M3 14h26M9 5.500l3.500 8.500L16 27.500 19.500 14 23 5.500M12.500 14L16 5.500l3.500 8.500"/>'),
    blue: G('<path class="ga" d="M16 3.500c5 7 9.500 11.500 9.500 16.500a9.500 9.500 0 0 1-19 0c0-5 4.500-9.500 9.500-16.500z"/><path class="gw" d="M11.500 20a4.800 4.800 0 0 0 3.500 4.500"/>'),
    purple: G(`<path class="gn" d="M16 9V4"/>${LEAFLET}${[[10, 12], [16, 12], [22, 12], [13, 17.500], [19, 17.500], [16, 23]].map(([x, y]) => `<circle class="ga" cx="${x}" cy="${y}" r="3.700"/>`).join('')}`),
    pink: G(`${ring(5, 7, (x, y) => `<circle class="ga" cx="${x}" cy="${y}" r="5.200"/>`)}<circle cx="16" cy="16" r="4" fill="#ffd84d"/>`),
    brown: G('<path class="gn" d="M16 6V2.500"/><path class="ga" d="M8 14h16c0 8-4 12.500-8 14-4-1.500-8-6-8-14z"/><path class="gc" d="M5.500 14.500c0-6 4.500-9 10.500-9s10.500 3 10.500 9z"/>'),
    gray: G(`${ring(8, 10.500, (x, y, a) => `<rect class="ga" x="-2.400" y="-3" width="4.800" height="6" rx="1.200" transform="translate(${x} ${y}) rotate(${a})"/>`)}<circle class="ga" cx="16" cy="16" r="9"/><circle class="gc" cx="16" cy="16" r="3.500"/>`),
    sky: G('<path class="gb" d="M9 25a6.500 6.500 0 0 1-.5-13 8.500 8.500 0 0 1 16 2.200A5.500 5.500 0 0 1 23.500 25z"/>'),
    cream: G('<path d="M9.500 16h13L16 29.500z" fill="#e3a55c"/><path class="gn" d="M12.500 19.500l5 5M19.500 19.500l-5 5"/><path class="gb" d="M8 16a8 8 0 0 1 16 0c0 1.800-1.500 2.500-2.700 1.500-1 1.500-2.600 1.500-3.600 0-1 1.500-2.600 1.500-3.600 0-1 1.500-2.600 1.500-3.600 0C9.500 18.500 8 17.800 8 16z"/><circle cx="16" cy="7" r="2.600" fill="#ff6b7a"/>'),
    mint: G(`<path class="gn" d="M16 16c1 5 3 9 6.500 12"/>${[[10.500, 10.500], [21.500, 10.500], [10.500, 21.500], [21.500, 21.500]].map(([x, y]) => `<circle class="ga" cx="${x}" cy="${y}" r="5.600"/>`).join('')}<circle class="gc" cx="16" cy="16" r="2.200"/>`),
    lavender: G('<path class="gn" d="M15 8l-3-4M17 8l3-4"/><ellipse class="ga" cx="9.500" cy="12.500" rx="6.500" ry="7"/><ellipse class="ga" cx="22.500" cy="12.500" rx="6.500" ry="7"/><ellipse class="ga" cx="10.500" cy="22.500" rx="5" ry="5.200"/><ellipse class="ga" cx="21.500" cy="22.500" rx="5" ry="5.200"/><rect class="gc" x="14.700" y="7.500" width="2.600" height="19" rx="1.300"/>'),
    lime: G(`<circle class="ga" cx="16" cy="16" r="12"/><circle class="gb" cx="16" cy="16" r="9"/>${ring(6, 8.500, (x, y) => `<path class="gn" d="M16 16L${x} ${y}"/>`)}`),
    olive: G('<path class="ga" d="M12 21H8.500A3.500 3.500 0 0 1 5 17.500V12a2 2 0 0 1 4 0v5h3zM20 17h3v-5a2 2 0 0 1 4 0v5.500a3.500 3.500 0 0 1-3.500 3.500H20z"/><rect class="ga" x="11.500" y="4" width="9" height="24" rx="4.500"/><path class="gn" d="M16 8v3M16 15v3M16 22v2"/>'),
    navy: G('<path d="M21 3.500a12.500 12.500 0 1 0 8 20.500A10.500 10.500 0 0 1 21 3.500z" fill="#ffe58a"/><path d="M24.500 8l1 2.500 2.500 1-2.500 1-1 2.500-1-2.500-2.500-1 2.500-1z" fill="#fff"/>'),
    maroon: G(`<path class="gn" d="M10 17C11 10.500 14.500 6.500 19 5M22 17c.3-5-.8-9-3-12"/>${LEAFLET.replace('16.500 6.500', '19 5')}<circle class="ga" cx="10" cy="22" r="5.600"/><circle class="ga" cx="22" cy="22" r="5.600"/>`),
    magenta: G('<path class="ga" d="M16 27.500C6 20.500 3 15.500 3 10.800A6.600 6.600 0 0 1 16 8.500a6.600 6.600 0 0 1 13 2.300c0 4.700-3 9.700-13 16.700z"/><path class="gw" d="M7 11.500a3 3 0 0 1 2.800-3"/>'),
    charcoal: G('<path class="ga" d="M11 7.500l15-3.500v5L11 12.500z"/><path class="gn" d="M12 9v14M25 6v14" stroke-width="2.400"/><ellipse class="ga" cx="8.500" cy="23.500" rx="4.500" ry="3.500"/><ellipse class="ga" cx="21.500" cy="20.500" rx="4.500" ry="3.500"/>'),
  };

  const DROP = (hex) => `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 4C22 20 12 30 12 42a20 20 0 0 0 40 0C52 30 42 20 32 4z" fill="${hex}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 42a10 10 0 0 0 7 9" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/></svg>`;

  const ICONS = {
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4L4 9l5 5M4 9h10a6 6 0 0 1 0 12h-2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h4c5 0 6 10 11 10h3M3 17h4c1.7 0 3-1.1 4-2.6M14 8.8C15 7.700 16.3 7 18 7h3M18 4l3 3-3 3M18 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.5-5.8M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h4l5 4v-13l-5 4z" fill="currentColor"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h4l5 4v-13l-5 4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    box: `<svg viewBox="0 0 64 56" aria-hidden="true">
      <path d="M6 22h52v26a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z" fill="#e0a45c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M3 12h58v10H3z" fill="#f3c483" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="20" cy="38" r="6" fill="#e5484d" stroke="${INK}" stroke-width="2"/>
      <circle cx="32" cy="38" r="6" fill="#f2c230" stroke="${INK}" stroke-width="2"/>
      <circle cx="44" cy="38" r="6" fill="#3b8fe8" stroke="${INK}" stroke-width="2"/></svg>`,
  };

  return { COLORS, PICTURES, ICONS, GLYPHS, DROP, W, H, regionCounts, pictureSVG };
});
