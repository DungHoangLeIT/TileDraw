/* Xưởng Robot: toàn bộ đồ họa là SVG tự vẽ. Robot dùng chung hệ tọa độ 240x250. */
(function (root) {
  const INK = '#1c2b36';
  const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const THIN = `stroke="${INK}" stroke-width="2" stroke-linecap="round"`;

  const mirror = (markup) => `<g transform="translate(240 0) scale(-1 1)">${markup}</g>`;

  /* ---------- 3 kiểu thân robot; mỗi kiểu trả về đầu, thân, tay trái, chân trái ---------- */
  const chassis = {
    box: (p) => ({
      head: `
        <line x1="120" y1="26" x2="120" y2="13" ${S}/>
        <circle class="beacon" cx="120" cy="12" r="4.5" fill="${p.a}" ${S}/>
        <rect x="83" y="38" width="9" height="22" rx="3" fill="${p.g}" ${S}/>
        <rect x="148" y="38" width="9" height="22" rx="3" fill="${p.g}" ${S}/>
        <rect x="90" y="25" width="60" height="52" rx="9" fill="${p.m}" ${S}/>
        <rect x="90" y="25" width="60" height="9" rx="4" fill="#fff" opacity=".22"/>
        <rect x="97" y="36" width="46" height="21" rx="6" fill="${p.n}" ${S}/>
        <circle class="eye" cx="109" cy="46" r="5.5"/>
        <circle class="eye" cx="131" cy="46" r="5.5"/>
        <rect x="105" y="62" width="30" height="9" rx="2" fill="${p.d}" ${S}/>
        <path d="M112 62v9M120 62v9M128 62v9" ${THIN}/>`,
      torso: `
        <rect x="80" y="84" width="80" height="84" rx="11" fill="${p.m}" ${S}/>
        <rect x="80" y="84" width="80" height="10" rx="5" fill="#fff" opacity=".2"/>
        <rect x="93" y="97" width="54" height="34" rx="6" fill="${p.n}" ${S}/>
        <circle class="core" cx="108" cy="114" r="8" fill="${p.a}" ${THIN}/>
        <path d="M124 106h16M124 114h16M124 122h10" stroke="${p.a}" stroke-width="3" stroke-linecap="round"/>
        <path d="M95 141h50M95 149h50M95 157h50" stroke="${p.d}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="87" cy="91" r="2" fill="${INK}"/><circle cx="153" cy="91" r="2" fill="${INK}"/>
        <circle cx="87" cy="161" r="2" fill="${INK}"/><circle cx="153" cy="161" r="2" fill="${INK}"/>`,
      arm: `
        <circle cx="72" cy="100" r="9" fill="${p.g}" ${S}/>
        <rect x="46" y="88" width="24" height="44" rx="9" fill="${p.m}" ${S}/>
        <rect x="50" y="130" width="16" height="22" rx="3" fill="${p.g}" ${S}/>
        <path d="M45 152h26v8l-5 16h-6l1-13h-6l1 13h-6l-5-16z" fill="${p.d}" ${S}/>`,
      leg: `
        <rect x="89" y="166" width="22" height="42" rx="6" fill="${p.g}" ${S}/>
        <circle cx="100" cy="187" r="6" fill="${p.a}" ${THIN}/>
        <rect x="80" y="206" width="38" height="28" rx="8" fill="${p.m}" ${S}/>
        <path d="M87 225h24" stroke="${p.d}" stroke-width="5" stroke-linecap="round"/>`,
    }),

    round: (p) => ({
      head: `
        <circle cx="86" cy="50" r="7" fill="${p.g}" ${S}/>
        <circle cx="154" cy="50" r="7" fill="${p.g}" ${S}/>
        <circle cx="120" cy="46" r="34" fill="${p.m}" ${S}/>
        <path d="M95 30a30 30 0 0 1 34-11" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
        <circle cx="120" cy="47" r="20" fill="${p.n}" ${S}/>
        <circle class="eye" cx="120" cy="47" r="11"/>
        <circle cx="124" cy="43" r="3" fill="#fff" opacity=".85"/>
        <path d="M108 72q12 6 24 0" fill="none" ${S}/>`,
      torso: `
        <ellipse cx="120" cy="126" rx="42" ry="41" fill="${p.m}" ${S}/>
        <path d="M88 110a36 36 0 0 1 22-20" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>
        <circle cx="120" cy="128" r="23" fill="${p.d}" ${S}/>
        <circle class="core" cx="120" cy="128" r="13" fill="${p.a}" ${S}/>
        <path d="M120 121v14M113 128h14" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
      arm: `
        <circle cx="72" cy="100" r="11" fill="${p.g}" ${S}/>
        <circle cx="60" cy="118" r="10" fill="${p.m}" ${S}/>
        <circle cx="53" cy="136" r="9" fill="${p.g}" ${S}/>
        <circle cx="50" cy="158" r="15" fill="${p.m}" ${S}/>
        <path d="M43 150a10 10 0 0 1 11-3" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
      leg: `
        <circle cx="100" cy="176" r="10" fill="${p.g}" ${S}/>
        <circle cx="99" cy="195" r="10" fill="${p.m}" ${S}/>
        <path d="M78 234a21 21 0 0 1 42 0z" fill="${p.d}" ${S}/>
        <path d="M85 228a14 14 0 0 1 9-11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>`,
    }),

    bolt: (p) => ({
      head: `
        <path d="M92 26L80 8l26 13zM148 26l12-18-26 13z" fill="${p.a}" ${S}/>
        <path d="M100 20h40l16 22-12 34H96L84 42z" fill="${p.m}" ${S}/>
        <path d="M100 20h40l5 7H95z" fill="#fff" opacity=".22"/>
        <path d="M92 38h56l-6 19H98z" fill="${p.n}" ${S}/>
        <path class="eye" d="M100 44h16l-3 8h-10zM140 44h-16l3 8h10z"/>
        <path d="M108 66h24" stroke="${p.d}" stroke-width="5" stroke-linecap="round"/>`,
      torso: `
        <path d="M76 86h88l-12 52-16 30h-32l-16-30z" fill="${p.m}" ${S}/>
        <path d="M76 86h88l-3 11H79z" fill="#fff" opacity=".2"/>
        <path d="M120 100l22 25-22 25-22-25z" fill="${p.n}" ${S}/>
        <path class="core" d="M120 110l13 15-13 15-13-15z" fill="${p.a}" ${THIN}/>
        <path d="M89 104l6 26M151 104l-6 26" stroke="${p.d}" stroke-width="5" stroke-linecap="round"/>`,
      arm: `
        <path d="M78 90l-26-2-14 22 26 6z" fill="${p.a}" ${S}/>
        <path d="M46 112h22l-4 36H52z" fill="${p.m}" ${S}/>
        <rect x="51" y="146" width="14" height="12" rx="2" fill="${p.g}" ${S}/>
        <path d="M44 158h28l-14 22z" fill="${p.d}" ${S}/>`,
      leg: `
        <path d="M88 166h26l-4 34H94z" fill="${p.g}" ${S}/>
        <path d="M84 196h34l4 22H80z" fill="${p.m}" ${S}/>
        <path d="M80 218h42l-6 16H86z" fill="${p.d}" ${S}/>
        <path d="M92 206h18" stroke="${p.a}" stroke-width="4" stroke-linecap="round"/>`,
    }),
  };

  // Mỗi màn một robot, theo đúng thứ tự màn.
  const ROBOTS = [
    { name: 'Bu-Bu', kind: 'box', p: { m: '#f4b73f', d: '#c9821a', a: '#2ec4b6', g: '#9fb2bd', n: '#203240' } },
    { name: 'Xoe', kind: 'round', p: { m: '#5ec5ee', d: '#2b83b8', a: '#ffd166', g: '#c4d2da', n: '#17303f' } },
    { name: 'Sấm', kind: 'bolt', p: { m: '#ef5d5d', d: '#a93342', a: '#ffd166', g: '#8d9dab', n: '#22303c' } },
    { name: 'Mầm', kind: 'round', p: { m: '#7ed67e', d: '#3b9a58', a: '#ff9f5a', g: '#c9d6c8', n: '#1b3230' } },
    { name: 'Tím', kind: 'box', p: { m: '#b18cf0', d: '#7450b8', a: '#ffd166', g: '#a9b3c9', n: '#211f3d' } },
    { name: 'Bão', kind: 'bolt', p: { m: '#4f8fe8', d: '#2a5bab', a: '#9ff0ff', g: '#a7b6c6', n: '#16263f' } },
    { name: 'Kem', kind: 'round', p: { m: '#ffc6d9', d: '#d9799e', a: '#7ad7c9', g: '#dcd3da', n: '#3a2433' } },
    { name: 'Đồng', kind: 'box', p: { m: '#d98a4e', d: '#a05a26', a: '#ffe08a', g: '#b3a596', n: '#2c2019' } },
    { name: 'Lá', kind: 'bolt', p: { m: '#57c785', d: '#2c8a57', a: '#f5e663', g: '#9fb5a8', n: '#15302a' } },
    { name: 'Biển', kind: 'round', p: { m: '#3fc1b0', d: '#1f8478', a: '#ffb86b', g: '#bcd4d0', n: '#10302d' } },
    { name: 'Hổ', kind: 'box', p: { m: '#f28b30', d: '#b9560f', a: '#2b2f38', g: '#b6a99a', n: '#26201c' } },
    { name: 'Ngọc', kind: 'bolt', p: { m: '#c56bdc', d: '#8739a0', a: '#8ff5d5', g: '#b4a8bf', n: '#27173a' } },
    { name: 'Mây', kind: 'round', p: { m: '#e4edf5', d: '#9db2c6', a: '#ff7d7d', g: '#bcc9d6', n: '#203040' } },
    { name: 'Thép', kind: 'box', p: { m: '#8da2b4', d: '#5a6f82', a: '#ff6b6b', g: '#c9d4dc', n: '#172430' } },
    { name: 'Titan', kind: 'bolt', p: { m: '#ffcf4d', d: '#c48a14', a: '#ef5d5d', g: '#8f98a5', n: '#1c1f28' } },
  ];

  // Khung nhìn của từng vị trí lắp, để cắt riêng bộ phận làm icon.
  const BBOX = {
    head: [76, 4, 88, 80],
    torso: [72, 80, 96, 92],
    armL: [30, 82, 54, 102],
    armR: [156, 82, 54, 102],
    legL: [74, 162, 52, 76],
    legR: [114, 162, 52, 76],
  };

  const SLOT_TYPE = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };
  const TYPE_SLOT = { head: 'head', torso: 'torso', arm: 'armL', leg: 'legL' };
  const TYPE_LABEL = {
    head: 'Đầu', torso: 'Thân', arm: 'Tay', leg: 'Chân',
    bolt: 'Ốc vít', gear: 'Bánh răng', magnet: 'Nam châm', wrench: 'Cờ lê', chip: 'Vi mạch', spring: 'Lò xo',
    oil: 'Bình dầu', bulb: 'Bóng đèn',
  };

  function slotMarkup(robotIndex, slot) {
    const r = ROBOTS[robotIndex];
    const parts = chassis[r.kind](r.p);
    const base = parts[SLOT_TYPE[slot]];
    return slot === 'armR' || slot === 'legR' ? mirror(base) : base;
  }

  function slotIcon(robotIndex, slot) {
    const b = BBOX[slot];
    return `<svg viewBox="${b.join(' ')}" aria-hidden="true">${slotMarkup(robotIndex, slot)}</svg>`;
  }

  /* ---------- Ô phụ tùng: khác cả màu lẫn hình dáng để dễ phân biệt ---------- */
  function gearPath(cx, cy, outer, inner, teeth) {
    let d = '';
    const step = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      const pts = [
        [inner, a - step * 0.32], [outer, a - step * 0.18], [outer, a + step * 0.18], [inner, a + step * 0.32],
      ];
      pts.forEach(([rad, ang], k) => {
        const x = (cx + rad * Math.cos(ang)).toFixed(1);
        const y = (cy + rad * Math.sin(ang)).toFixed(1);
        d += `${i === 0 && k === 0 ? 'M' : 'L'}${x} ${y}`;
      });
    }
    return `${d}z`;
  }

  const FILLERS = {
    bolt: `
      <path d="M32 8l18 10v20L32 48 14 38V18z" fill="#c3d0d9" ${S}/>
      <path d="M32 8l18 10-18 10-18-10z" fill="#e6eef3"/>
      <circle cx="32" cy="27" r="8" fill="#6f8796" ${S}/>
      <path d="M26 50h12M28 56h8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
    gear: `
      <path d="${gearPath(32, 32, 27, 20, 8)}" fill="#f08a4b" ${S}/>
      <circle cx="32" cy="32" r="9" fill="#ffe2c7" ${S}/>`,
    magnet: `
      <path d="M11 9h15v25a6 6 0 0 0 12 0V9h15v25a21 21 0 0 1-42 0z" fill="#e4524f" ${S}/>
      <path d="M11 9h15v10H11zM38 9h15v10H38z" fill="#dfe8ee" ${S}/>`,
    wrench: `
      <path d="M46 7a14 14 0 0 0-17 18L9 45a7 7 0 0 0 10 10l20-20a14 14 0 0 0 18-17l-9 9-9-3-3-9z" fill="#8c9eff" ${S}/>
      <circle cx="14" cy="50" r="2.5" fill="${INK}"/>`,
    chip: `
      <path d="M21 6v9M32 6v9M43 6v9M21 49v9M32 49v9M43 49v9M6 21h9M6 32h9M6 43h9M49 21h9M49 32h9M49 43h9" ${S}/>
      <rect x="13" y="13" width="38" height="38" rx="5" fill="#2f8f83" ${S}/>
      <rect x="23" y="23" width="18" height="18" rx="2" fill="#a6f0e0" ${S}/>`,
    spring: `
      <path d="M16 12h32L16 22h32L16 32h32L16 42h32L16 52h32" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 12h32L16 22h32L16 32h32L16 42h32L16 52h32" fill="none" stroke="#e45fa6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    oil: `
      <path d="M38 22l15-11 4 5-13 13" fill="#8a97a3" ${S}/>
      <path d="M12 56V29l9-9h15l8 9v27z" fill="#e9a33b" ${S}/>
      <rect x="23" y="11" width="10" height="9" rx="2" fill="#6f8796" ${S}/>
      <path d="M21 36h14v12H21z" fill="#fff0c9" ${S}/>`,
    bulb: `
      <path d="M32 6a19 19 0 0 0-11 34c2 2 3 4 3 7h16c0-3 1-5 3-7A19 19 0 0 0 32 6z" fill="#ffe47a" ${S}/>
      <path d="M21 22a12 12 0 0 1 8-8" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M26 33l6-6 6 6M32 27v20" fill="none" stroke="#c98a14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="24" y="47" width="16" height="11" rx="3" fill="#8a97a3" ${S}/>`,
  };

  function tileIcon(robotIndex, type) {
    if (FILLERS[type]) return `<svg viewBox="0 0 64 64" aria-hidden="true">${FILLERS[type]}</svg>`;
    return slotIcon(robotIndex, TYPE_SLOT[type]);
  }

  /* ---------- Khung người máy cố định trên bệ lắp ráp ---------- */
  function robotSVG(robotIndex) {
    const order = ['legL', 'legR', 'armL', 'armR', 'torso', 'head'];
    const clipDefs = order.map((slot) => {
      const b = BBOX[slot];
      return `<clipPath id="clip-${slot}"><rect x="${b[0]}" y="${b[1] + b[3]}" width="${b[2]}" height="0"/></clipPath>`;
    }).join('');

    const frame = `
      <g class="frame">
        <rect x="58" y="232" width="124" height="11" rx="5" fill="#3c5566" ${S}/>
        <path d="M120 74v160" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
        <path d="M120 74v160" stroke="#7d93a2" stroke-width="6" stroke-linecap="round"/>
        <path d="M70 98h100" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
        <path d="M70 98h100" stroke="#7d93a2" stroke-width="5" stroke-linecap="round"/>
        <path d="M99 170h42" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
        <path d="M99 170h42" stroke="#7d93a2" stroke-width="5" stroke-linecap="round"/>
        <path d="M70 98L54 150M170 98l16 52M99 170v50M141 170v50" stroke="#5a7180" stroke-width="4" stroke-dasharray="2 7" stroke-linecap="round"/>
        <g fill="#c3d0d9" ${S}>
          <circle cx="70" cy="98" r="6"/><circle cx="170" cy="98" r="6"/>
          <circle cx="99" cy="170" r="6"/><circle cx="141" cy="170" r="6"/>
          <circle cx="120" cy="74" r="6"/>
        </g>
      </g>`;

    const slots = order.map((slot) => {
      const art = slotMarkup(robotIndex, slot);
      return `
      <g class="slot" data-slot="${slot}">
        <g class="ghost">${art}</g>
        <g class="charge" clip-path="url(#clip-${slot})">${art}</g>
        <g class="part">${art}</g>
      </g>`;
    }).join('');

    return `<svg class="robot" viewBox="0 0 240 250" role="img" aria-label="Robot ${ROBOTS[robotIndex].name}">
      <defs>${clipDefs}</defs>${frame}${slots}</svg>`;
  }

  /* ---------- Nền xưởng ---------- */
  function workshopSVG() {
    return `<svg class="workshop" viewBox="0 0 400 270" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <pattern id="peg" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#2b4d5e"/><circle cx="8" cy="8" r="1.7" fill="#1d3847"/>
        </pattern>
        <radialGradient id="lampGlow" cx=".5" cy="0" r="1">
          <stop offset="0" stop-color="#ffe6a8" stop-opacity=".42"/>
          <stop offset="1" stop-color="#ffe6a8" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="270" fill="url(#peg)"/>

      <g>
        <rect x="16" y="26" width="72" height="60" rx="4" fill="#12303f" stroke="#172a36" stroke-width="5"/>
        <path d="M18 86V66h12V52h14v14h10V44h16v22h8V58h8v28z" fill="#1f4557"/>
        <circle cx="70" cy="40" r="7" fill="#ffe6a8"/>
        <path d="M52 26v60M16 56h72" stroke="#172a36" stroke-width="3"/>
      </g>

      <g opacity=".95">
        <rect x="308" y="30" width="78" height="7" rx="2" fill="#8a5a33"/>
        <path d="M318 37v8M376 37v8" stroke="#6b4426" stroke-width="4"/>
        <rect x="318" y="10" width="17" height="20" rx="2" fill="#e8743b"/>
        <rect x="340" y="16" width="14" height="14" rx="2" fill="#2ec4b6"/>
        <path d="M360 30l9-19 9 19z" fill="#ffd166"/>
        <rect x="308" y="84" width="78" height="7" rx="2" fill="#8a5a33"/>
        <path d="M318 91v8M376 91v8" stroke="#6b4426" stroke-width="4"/>
        <circle cx="325" cy="74" r="10" fill="#5ec5ee"/>
        <rect x="343" y="62" width="32" height="22" rx="3" fill="#b18cf0"/>
        <path d="M349 70h20" stroke="#5e3d94" stroke-width="3"/>
      </g>

      <g stroke-linecap="round" fill="none">
        <path d="M32 112v42" stroke="#c3d0d9" stroke-width="7"/>
        <path d="M21 112h22" stroke="#e8743b" stroke-width="10"/>
        <path d="M62 110v30" stroke="#ffd166" stroke-width="5"/>
        <path d="M62 140v13" stroke="#1d3847" stroke-width="9"/>
      </g>

      <path d="M200 0v18" stroke="#172a36" stroke-width="4"/>
      <path d="M180 34a20 16 0 0 1 40 0z" fill="#e8743b" stroke="#172a36" stroke-width="3"/>
      <path d="M180 34L80 270h240L220 34z" fill="url(#lampGlow)"/>

      <path d="M0 240h400v30H0z" fill="#172c38"/>
      <path d="M0 240h400" stroke="#0e2029" stroke-width="4"/>
      <g fill="#ffd166" opacity=".8">
        <path d="M0 254h26l-7 10H0zM58 254h26l-7 10H51zM116 254h26l-7 10h-26zM258 254h26l-7 10h-26zM316 254h26l-7 10h-26zM374 254h26v10h-33z"/>
      </g>
    </svg>`;
  }

  // Viên pin bay lên nạp cho robot khi ghép xong ô thường.
  const ENERGY_CELL = `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="25" y="4" width="14" height="7" rx="2" fill="#6f8796" ${S}/>
    <rect x="14" y="10" width="36" height="50" rx="7" fill="#3fdc8f" ${S}/>
    <rect x="14" y="10" width="11" height="50" rx="5" fill="#fff" opacity=".28"/>
    <path d="M37 18L23 38h9l-5 15 15-22h-9z" fill="#fff4b8" ${S}/>
  </svg>`;

  const ICONS = {
    energy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2L5 14h6l-1.5 8L19 9.5h-6.5z" fill="currentColor"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -3)" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h4c5 0 6 10 11 10h3M3 17h4c1.700 0 3-1.100 4-2.600M14 8.800C15 7.700 16.300 7 18 7h3M18 4l3 3-3 3M18 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.500-5.800M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.500v5h4l5 4v-13l-5 4z" fill="currentColor"/><path d="M16.500 9a4 4 0 0 1 0 6M19 6.500a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.500v5h4l5 4v-13l-5 4z" fill="currentColor"/><path d="M16.500 9.500l5 5M21.500 9.500l-5 5" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"/></svg>',
  };

  root.RoboArt = { ROBOTS, ENERGY_CELL, BBOX, TYPE_LABEL, TYPE_SLOT, ICONS, robotSVG, workshopSVG, tileIcon, slotIcon };
})(typeof self !== 'undefined' ? self : this);
