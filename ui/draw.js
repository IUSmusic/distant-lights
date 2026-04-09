/**
 * @module ui/draw
 *
 * Functions for rendering simple time‑series plots on an HTML canvas.  These
 * functions are kept deliberately low level to avoid pulling in charting
 * libraries.  The caller is responsible for pre‑computing the arrays of
 * coordinates.
 */

/**
 * Draw a series of points on a canvas.  The canvas is first cleared and
 * overlaid with horizontal grid lines for context.  If `center` is true the
 * vertical midpoint is emphasised and the series is centred about zero.
 *
 * @param {HTMLCanvasElement} canvas  Target canvas element.
 * @param {Array<{x: number, y: number}>} series Data points to plot.  The x
 *  values should range from 0 to series.length – 1 and y should be in the
 *  range [0, 1] for uncentred data or [−1, 1] for centred data.
 * @param {string} color Colour of the waveform trace (any CSS colour).
 * @param {boolean} [center=false] If true interpret y values as centred about
 *  zero (−1 to 1) and draw a midline.
 */
export function drawSeries(canvas, series, color, center = false) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  // Clear and fill background
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  // Draw grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  if (center) {
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
  // Draw series
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((p, i) => {
    const x = (p.x / Math.max(1, series.length - 1)) * width;
    const yVal = center ? (0.5 - p.y * 0.45) : (1 - p.y);
    const y = yVal * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}