import { createNoise2D } from 'simplex-noise';
import { createRandom } from './random.js';

// Flow field generator using simplex noise
export function createFlowField(width, height, cellSize, options = {}) {
  const {
    frequency = 0.004,
    octave2Freq = 0.012,
    octave2Weight = 0.3,
    seed = 12345,
    biasAngle = 0,      // directional bias (radians)
    biasStrength = 0,    // how much to pull toward bias direction
  } = options;

  const rng = createRandom(seed);
  const noise = createNoise2D(() => rng());

  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const field = new Float32Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize;
      const y = r * cellSize;

      // Two octaves of noise for richer detail
      let angle = noise(x * frequency, y * frequency) * Math.PI * 2;
      angle += noise(x * octave2Freq, y * octave2Freq) * Math.PI * octave2Weight;

      // Directional bias (toward river)
      if (biasStrength > 0) {
        angle = angle * (1 - biasStrength) + biasAngle * biasStrength;
      }

      field[r * cols + c] = angle;
    }
  }

  return {
    getAngle(px, py) {
      const c = Math.floor(px / cellSize);
      const r = Math.floor(py / cellSize);
      if (c < 0 || c >= cols || r < 0 || r >= rows) return 0;
      return field[r * cols + c];
    },
    cols,
    rows,
  };
}
