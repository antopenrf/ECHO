const STORAGE_KEY = "echo-chart-data";
const PADDING = { top: 32, right: 28, bottom: 52, left: 68 };

const summary = document.getElementById("chartSummary");
const histogramCanvas = document.getElementById("histogramCanvas");
const spectrumCanvas = document.getElementById("spectrumCanvas");

const payload = loadPayload();

if (!payload) {
  summary.textContent = "No chart data found. Run a simulation in the main page and click Open Charts.";
} else {
  const lengths = bounceLengths(payload.trace);
  const histogram = computeHistogram(lengths, 24);
  const spectrum = computeSpectrum(lengths);

  summary.textContent = [
    `Shape vertices: ${payload.vertices.length}`,
    `Trace points: ${payload.trace.length}`,
    `Bounce lengths: ${lengths.length}`,
    `Final theta: ${payload.theta.toFixed(6)}`,
  ].join("\n");

  drawBars(histogramCanvas, histogram.bins, histogram.values, {
    title: "Bounce Length Histogram",
    xLabel: "Intersection Length",
    yLabel: "Count",
    fill: "rgba(15, 122, 93, 0.8)",
  });

  drawLine(spectrumCanvas, spectrum.frequency, spectrum.power, {
    title: "Bounce Length Spectrum",
    xLabel: "Normalized Frequency",
    yLabel: "Power",
    stroke: "rgba(178, 77, 34, 0.9)",
  });
}

function loadPayload() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const localRaw = window.localStorage.getItem(STORAGE_KEY);
      if (!localRaw) {
        return null;
      }
      return JSON.parse(localRaw);
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function bounceLengths(trace) {
  const lengths = [];
  for (let index = 1; index < trace.length; index += 1) {
    const dx = trace[index][0] - trace[index - 1][0];
    const dy = trace[index][1] - trace[index - 1][1];
    lengths.push(Math.hypot(dx, dy));
  }
  return lengths;
}

function computeHistogram(values, binCount) {
  if (!values.length) {
    return { bins: [], values: [] };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-9);
  const step = span / binCount;
  const counts = new Array(binCount).fill(0);

  for (const value of values) {
    let index = Math.floor((value - min) / step);
    if (index >= binCount) {
      index = binCount - 1;
    }
    counts[index] += 1;
  }

  const centers = counts.map((_, index) => min + step * (index + 0.5));
  return { bins: centers, values: counts };
}

function computeSpectrum(values) {
  if (values.length < 2) {
    return { frequency: [], power: [] };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const signal = values.map((value) => value - mean);
  const half = Math.floor(signal.length / 2);
  const frequency = [];
  const power = [];

  for (let k = 1; k <= half; k += 1) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < signal.length; n += 1) {
      const angle = (2 * Math.PI * k * n) / signal.length;
      real += signal[n] * Math.cos(angle);
      imag -= signal[n] * Math.sin(angle);
    }
    frequency.push(k / signal.length);
    power.push((real * real + imag * imag) / signal.length);
  }

  const maxPower = Math.max(...power, 0);
  const normalizedPower = maxPower > 0
    ? power.map((value) => value / maxPower)
    : power;

  return { frequency, power: normalizedPower };
}

function drawBars(canvas, xs, ys, options) {
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);
  if (!xs.length) {
    drawEmpty(ctx, canvas, "Not enough data for histogram");
    return;
  }
  const area = plotArea(canvas);
  const maxY = Math.max(...ys, 1);
  drawFrame(ctx, canvas, area, options.title, options.xLabel, options.yLabel);

  const width = area.width / ys.length;
  ctx.fillStyle = options.fill;
  ys.forEach((value, index) => {
    const barHeight = (value / maxY) * area.height;
    const x = area.x + index * width + 2;
    const y = area.y + area.height - barHeight;
    ctx.fillRect(x, y, Math.max(width - 4, 1), barHeight);
  });

  drawYAxisTicks(ctx, area, maxY);
  drawXAxisLabels(ctx, area, xs[0], xs[xs.length - 1]);
}

function drawLine(canvas, xs, ys, options) {
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);
  if (!xs.length) {
    drawEmpty(ctx, canvas, "Not enough data for spectrum");
    return;
  }
  const area = plotArea(canvas);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys, 1);
  drawFrame(ctx, canvas, area, options.title, options.xLabel, options.yLabel);

  ctx.strokeStyle = options.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ys.forEach((value, index) => {
    const x = area.x + ((xs[index] - minX) / Math.max(maxX - minX, 1e-9)) * area.width;
    const y = area.y + area.height - (value / maxY) * area.height;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  drawYAxisTicks(ctx, area, maxY);
  drawXAxisLabels(ctx, area, minX, maxX);
}

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function plotArea(canvas) {
  return {
    x: PADDING.left,
    y: PADDING.top,
    width: canvas.width - PADDING.left - PADDING.right,
    height: canvas.height - PADDING.top - PADDING.bottom,
  };
}

function drawFrame(ctx, canvas, area, title, xLabel, yLabel) {
  ctx.strokeStyle = "rgba(31, 27, 24, 0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(area.x, area.y, area.width, area.height);

  ctx.fillStyle = "#1f1b18";
  ctx.font = "600 24px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(title, area.x, 24);

  ctx.font = "14px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(xLabel, area.x + area.width / 2 - 40, canvas.height - 12);

  ctx.save();
  ctx.translate(18, area.y + area.height / 2 + 30);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function drawYAxisTicks(ctx, area, maxY) {
  ctx.fillStyle = "#6c655d";
  ctx.font = "12px SFMono-Regular, Consolas, monospace";
  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = area.y + area.height - ratio * area.height;
    const value = (ratio * maxY).toFixed(2);
    ctx.fillText(value, 8, y + 4);
    ctx.strokeStyle = "rgba(31, 27, 24, 0.08)";
    ctx.beginPath();
    ctx.moveTo(area.x, y);
    ctx.lineTo(area.x + area.width, y);
    ctx.stroke();
  }
}

function drawXAxisLabels(ctx, area, minX, maxX) {
  ctx.fillStyle = "#6c655d";
  ctx.font = "12px SFMono-Regular, Consolas, monospace";
  ctx.fillText(minX.toFixed(3), area.x, area.y + area.height + 18);
  ctx.fillText(maxX.toFixed(3), area.x + area.width - 48, area.y + area.height + 18);
}

function drawEmpty(ctx, canvas, message) {
  ctx.fillStyle = "#6c655d";
  ctx.font = "16px Avenir Next, Segoe UI, sans-serif";
  ctx.fillText(message, 24, 32);
}
