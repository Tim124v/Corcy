/**
 * Генерация PNG для iOS: apple-touch-icon (180) + apple-touch-startup-image (splash).
 * Запуск: npm run generate:splash
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const splashDir = join(publicDir, 'splash');

mkdirSync(splashDir, { recursive: true });

const svg = readFileSync(join(publicDir, 'connexy_favicon.svg'));

const BG = { r: 10, g: 15, b: 30 };

/** Логические размеры × scale → физические px; media — как в Safari для portrait standalone */
const SPLASHES = [
  {
    file: 'iphone-14-pro-max',
    w: 1290,
    h: 2796,
    media:
      '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    file: 'iphone-14-pro',
    w: 1179,
    h: 2556,
    media:
      '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    file: 'iphone-14',
    w: 1170,
    h: 2532,
    media:
      '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    file: 'iphone-14-plus',
    w: 1284,
    h: 2778,
    media:
      '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    file: 'iphone-13-mini',
    w: 1125,
    h: 2436,
    media:
      '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    file: 'iphone-xs-max',
    w: 1242,
    h: 2688,
    media:
      '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    file: 'iphone-xr',
    w: 828,
    h: 1792,
    media:
      '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
  {
    file: 'iphone-8-plus',
    w: 1242,
    h: 2208,
    media:
      '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    file: 'iphone-se',
    w: 750,
    h: 1334,
    media:
      '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  },
];

async function makeSplash(w, h, outPath) {
  const logoSize = Math.max(160, Math.round(Math.min(w, h) * 0.22));
  const logo = await sharp(svg).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer();

  await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: BG,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(outPath);
}

for (const s of SPLASHES) {
  const out = join(splashDir, `${s.file}.png`);
  await makeSplash(s.w, s.h, out);
  console.log('Wrote', out);
}

const libDir = join(root, 'lib');
mkdirSync(libDir, { recursive: true });
const links = SPLASHES.map((s) => ({
  href: `/splash/${s.file}.png`,
  media: s.media,
}));
writeFileSync(join(libDir, 'apple-splash.json'), JSON.stringify(links, null, 2) + '\n', 'utf8');
console.log('Wrote', join(libDir, 'apple-splash.json'));

await sharp(svg)
  .resize(180, 180, { fit: 'contain', background: BG })
  .png()
  .toFile(join(publicDir, 'apple-touch-icon.png'));
console.log('Wrote', join(publicDir, 'apple-touch-icon.png'));
