// Generate background assets for the Hermes AgentOS deck.
const sharp = require('sharp');
const fs = require('fs');

const W = 2660, H = 1500;

function gridLines(step, color, opacity, w = W, h = H) {
  let s = '';
  for (let x = 0; x <= w; x += step) {
    s += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
  }
  for (let y = 0; y <= h; y += step) {
    s += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
  }
  return s;
}

// Cover / closing: deep field with a wide blue aurora and a fine wire grid.
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050914"/>
      <stop offset="55%" stop-color="#070E20"/>
      <stop offset="100%" stop-color="#04070F"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.30" r="0.62">
      <stop offset="0%" stop-color="#1E5BFF" stop-opacity="0.42"/>
      <stop offset="45%" stop-color="#1240A8" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#050914" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.12" cy="0.88" r="0.55">
      <stop offset="0%" stop-color="#0FB6C8" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#050914" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${gridLines(74, '#2C4A80', 0.16)}
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  <g stroke="#4E86FF" fill="none" opacity="0.30">
    <circle cx="1980" cy="470" r="330" stroke-width="1.1"/>
    <circle cx="1980" cy="470" r="470" stroke-width="0.9" opacity="0.6"/>
    <circle cx="1980" cy="470" r="620" stroke-width="0.8" opacity="0.35"/>
  </g>
  <g stroke="#6FA0FF" opacity="0.5">
    <line x1="1330" y1="470" x2="2630" y2="470" stroke-width="0.8" opacity="0.35"/>
    <line x1="1980" y1="0" x2="1980" y2="1150" stroke-width="0.8" opacity="0.28"/>
  </g>
  <g fill="#8FB8FF" opacity="0.75">
    <circle cx="1980" cy="140" r="4.5"/><circle cx="2310" cy="470" r="4.5"/>
    <circle cx="1980" cy="800" r="4.5"/><circle cx="1650" cy="470" r="4.5"/>
    <circle cx="2213" cy="237" r="3.2"/><circle cx="1747" cy="703" r="3.2"/>
  </g>
</svg>`;

// Content slides: quieter field, glow pushed to the top-right corner.
const content = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="#070C18"/>
      <stop offset="100%" stop-color="#04070F"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.94" cy="0.06" r="0.62">
      <stop offset="0%" stop-color="#1B52E8" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#04070F" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.04" cy="0.96" r="0.5">
      <stop offset="0%" stop-color="#0E7E93" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#04070F" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${gridLines(74, '#25406E', 0.13)}
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
</svg>`;

// Section divider: centred beam.
const section = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#04070F"/>
      <stop offset="50%" stop-color="#081226"/>
      <stop offset="100%" stop-color="#04070F"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.62">
      <stop offset="0%" stop-color="#2160FF" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#04070F" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${gridLines(74, '#2C4A80', 0.14)}
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</svg>`;

const jobs = [['bg-cover.png', cover], ['bg-content.png', content], ['bg-section.png', section]];

Promise.all(
  jobs.map(([name, svg]) =>
    sharp(Buffer.from(svg)).png({ quality: 92 }).toFile(name).then(() => console.log('wrote', name)),
  ),
).catch((e) => {
  console.error(e);
  process.exit(1);
});
