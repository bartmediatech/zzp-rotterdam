import { COLORS } from '../config.js';
import { createRandom } from '../utils/random.js';

export function renderPaper(ctx, width, height) {
  const rng = createRandom(777);

  // Base fill
  ctx.fillStyle = COLORS.paperBase;
  ctx.fillRect(0, 0, width, height);

  // Grain noise
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const noise = (rng() - 0.5) * 14;
    // Warm bias: add slightly more to red channel
    pixels[i] = Math.max(0, Math.min(255, pixels[i] + noise + 1));
    pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + noise));
    pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + noise - 1));
  }

  ctx.putImageData(imageData, 0, 0);

  // Paper fiber lines (very subtle)
  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.strokeStyle = '#B8AFA0';
  ctx.lineWidth = 0.5;

  for (let i = 0; i < 300; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const angle = rng() * Math.PI;
    const len = 10 + rng() * 30;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  // Vignette (subtle darkening at edges)
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
