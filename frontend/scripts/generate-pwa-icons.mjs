import sharp from 'sharp';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'public', 'connexy_favicon.svg'));

await Promise.all([
  sharp(svg).resize(180, 180).png().toFile(path.join(root, 'public', 'apple-touch-icon.png')),
  sharp(svg).resize(192, 192).png().toFile(path.join(root, 'public', 'icon-192.png')),
  sharp(svg).resize(512, 512).png().toFile(path.join(root, 'public', 'icon-512.png')),
]);
console.log('Icons created!');
