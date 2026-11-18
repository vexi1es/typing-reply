/**
 * App icons: a chat bubble with typing dots on a blue→violet gradient.
 *   npm run icons → public/apple-touch-icon.png, public/icon-192.png, public/icon-512.png
 */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

function icon(size: number): Buffer {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const k = size / 512;

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#2f7cf6');
  g.addColorStop(1, '#7b5cff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Bubble with a tail at the bottom left
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(96 * k, 128 * k, 320 * k, 220 * k, 110 * k);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(140 * k, 310 * k);
  ctx.quadraticCurveTo(130 * k, 370 * k, 92 * k, 396 * k);
  ctx.quadraticCurveTo(170 * k, 392 * k, 206 * k, 336 * k);
  ctx.closePath();
  ctx.fill();

  // Typing dots
  ctx.fillStyle = '#4b6cf8';
  for (const x of [186, 256, 326]) {
    ctx.beginPath();
    ctx.arc(x * k, 238 * k, 25 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  return c.toBuffer('image/png');
}

writeFileSync('public/apple-touch-icon.png', icon(180));
writeFileSync('public/icon-192.png', icon(192));
writeFileSync('public/icon-512.png', icon(512));
console.log('icons written');
