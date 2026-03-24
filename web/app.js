const EPSILON = 1e-9;
const ADVANCE_EPSILON = 1e-7;

const primitiveTemplates = {
  line: { to: [250, -300] },
  arc: { center: [250, 0], radius: 300, end_angle: 90, segments: 32 },
  parabola: { control: [0, 360], to: [-250, 300], segments: 32 },
  polynomial: { to: [-250, -300], coefficients: [280, -220], segments: 48 },
};

const presetShapes = {
  rectangular: {
    vertices: [
      [-480, -300],
      [480, -300],
      [480, 300],
      [-480, 300],
    ],
  },
  chaos: {
    start: [-250, -300],
    closed: true,
    segments: [
      { type: "line", to: [250, -300] },
      { type: "arc", center: [250, 0], radius: 300, end_angle: 90, segments: 48 },
      { type: "line", to: [-250, 300] },
      { type: "arc", center: [-250, 0], radius: 300, end_angle: 270, segments: 48 },
    ],
  },
  irregular: {
    vertices: [
      [-420, -220],
      [360, -260],
      [520, 40],
      [180, 300],
      [-120, 260],
      [-500, 60],
    ],
  },
  trace: {
    start: [-260, -280],
    closed: true,
    segments: [
      { type: "line", to: [180, -300] },
      { type: "parabola", control: [420, -40], to: [220, 280], segments: 28 },
      { type: "line", to: [-120, 280] },
      { type: "polynomial", to: [-360, -60], coefficients: [180, -120], segments: 40 },
      { type: "arc", center: [-280, -120], radius: 160, end_angle: 258, segments: 24 },
    ],
  },
};

const state = {
  shapeSpec: clone(presetShapes.chaos),
  vertices: [],
  boundaryClosed: true,
  trace: [],
  engine: null,
  running: false,
  animationFrame: null,
  completedSteps: 0,
  totalSteps: 0,
  view: null,
  pendingCanvasPoints: [],
  canvasStartArmed: false,
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const presetSelect = document.getElementById("preset");
const primitiveType = document.getElementById("primitiveType");
const primitiveParams = document.getElementById("primitiveParams");
const shapeJson = document.getElementById("shapeJson");
const summary = document.getElementById("summary");
const canvasTool = document.getElementById("canvasTool");

presetSelect.addEventListener("change", () => {
  stopAnimation();
  loadPreset(presetSelect.value);
});

document.getElementById("applyShape").addEventListener("click", () => {
  try {
    stopAnimation();
    state.shapeSpec = parseShape(shapeJson.value);
    state.canvasStartArmed = !!state.shapeSpec.segments;
    state.vertices = compileShape(state.shapeSpec);
    state.boundaryClosed = isValidChamber(state.vertices);
    state.trace = [];
    state.engine = null;
    syncBuilderFields();
    drawScene();
    setSummary([
      "Shape applied.",
      `Boundary vertices: ${state.vertices.length}`,
      `Closed chamber: ${state.boundaryClosed ? "yes" : "no"}`,
      "Start the simulation to animate the ray.",
    ].join("\n"));
  } catch (error) {
    setSummary(error.message);
  }
});

document.getElementById("addPrimitive").addEventListener("click", () => {
  try {
    ensureBuilderShape();
    const params = JSON.parse(primitiveParams.value);
    state.shapeSpec.segments.push({ type: primitiveType.value, ...params });
    syncShapeJson();
    state.vertices = compileShape(state.shapeSpec);
    state.boundaryClosed = isValidChamber(state.vertices);
    drawScene();
    setSummary(`${primitiveType.value} primitive added.`);
  } catch (error) {
    setSummary(error.message);
  }
});

document.getElementById("undoPrimitive").addEventListener("click", () => {
  ensureBuilderShape();
  state.shapeSpec.segments.pop();
  syncShapeJson();
  state.vertices = compileShape(state.shapeSpec);
  state.boundaryClosed = isValidChamber(state.vertices);
  drawScene();
  setSummary("Removed the last primitive.");
});

document.getElementById("clearBuilder").addEventListener("click", () => {
  stopAnimation();
  state.shapeSpec = {
    start: [
      Number(document.getElementById("builderStartX").value),
      Number(document.getElementById("builderStartY").value),
    ],
    closed: true,
    segments: [],
  };
  state.vertices = compileShape(state.shapeSpec);
  state.boundaryClosed = false;
  state.trace = [];
  state.canvasStartArmed = false;
  syncShapeJson();
  drawScene();
  setSummary("Builder cleared.");
});

document.getElementById("downloadShape").addEventListener("click", () => {
  downloadText("echo_shape.json", JSON.stringify(state.shapeSpec, null, 2));
});

document.getElementById("run").addEventListener("click", () => {
  try {
    state.shapeSpec = parseShape(shapeJson.value);
    state.canvasStartArmed = !!state.shapeSpec.segments;
    prepareSimulation();
    state.running = true;
    setSummary("Simulation running in real time.");
    animate();
  } catch (error) {
    setSummary(error.message);
  }
});

document.getElementById("pause").addEventListener("click", () => {
  stopAnimation();
  setSummary("Simulation paused.");
});

document.getElementById("reset").addEventListener("click", () => {
  stopAnimation();
  try {
    state.shapeSpec = parseShape(shapeJson.value);
    state.canvasStartArmed = !!state.shapeSpec.segments;
    state.vertices = compileShape(state.shapeSpec);
    state.boundaryClosed = isValidChamber(state.vertices);
    resetSimulationState();
    drawScene();
    setSummary("Simulation reset.");
  } catch (error) {
    setSummary(error.message);
  }
});

document.getElementById("finish").addEventListener("click", () => {
  try {
    state.shapeSpec = parseShape(shapeJson.value);
    state.canvasStartArmed = !!state.shapeSpec.segments;
    prepareSimulation();
    while (state.completedSteps < state.totalSteps) {
      stepSimulation();
    }
    stopAnimation();
    drawScene();
    updateSummary("Simulation finished.");
  } catch (error) {
    setSummary(error.message);
  }
});

document.getElementById("downloadTrace").addEventListener("click", () => {
  if (state.trace.length === 0) {
    setSummary("Run the simulation before downloading the trace.");
    return;
  }
  const lines = [
    "## type:polygon",
    `## vertices:${JSON.stringify(state.vertices)}`,
  ];
  for (const point of state.trace) {
    lines.push(`${point[0]}\t${point[1]}`);
  }
  downloadText("echo_trace.txt", lines.join("\n"));
});

document.getElementById("openCharts").addEventListener("click", () => {
  if (state.trace.length < 2) {
    setSummary("Run the simulation before opening charts.");
    return;
  }
  window.localStorage.setItem("echo-chart-data", JSON.stringify({
    trace: state.trace,
    vertices: state.vertices,
    theta: state.engine ? state.engine.theta : Number(document.getElementById("theta").value),
  }));
  window.open("charts.html", "_blank", "noopener");
});

document.getElementById("closeCanvasShape").addEventListener("click", () => {
  ensureBuilderShape();
  state.shapeSpec.closed = true;
  refreshBuilderPreview();
  setSummary("Canvas-built chamber closed.");
});

document.getElementById("cancelCanvasTool").addEventListener("click", () => {
  state.pendingCanvasPoints = [];
  setSummary("Pending canvas tool points cleared.");
});

canvas.addEventListener("click", (event) => {
  try {
    handleCanvasClick(event);
  } catch (error) {
    setSummary(error.message);
  }
});

primitiveType.addEventListener("change", syncPrimitiveTemplate);
window.addEventListener("resize", drawScene);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadPreset(name) {
  state.shapeSpec = clone(presetShapes[name]);
  state.vertices = compileShape(state.shapeSpec);
  state.boundaryClosed = isValidChamber(state.vertices);
  state.trace = [];
  state.engine = null;
  state.canvasStartArmed = !!state.shapeSpec.segments;
  syncBuilderFields();
  syncShapeJson();
  resetSimulationState();
  drawScene();
  setSummary(`${name} preset loaded.`);
}

function ensureBuilderShape() {
  if (!state.shapeSpec || !state.shapeSpec.segments) {
    state.shapeSpec = {
      start: [
        Number(document.getElementById("builderStartX").value),
        Number(document.getElementById("builderStartY").value),
      ],
      closed: true,
      segments: [],
    };
  }
}

function refreshBuilderPreview() {
  state.canvasStartArmed = !!state.shapeSpec.segments?.length;
  state.vertices = compileShape(state.shapeSpec);
  state.boundaryClosed = isValidChamber(state.vertices);
  state.trace = [];
  state.engine = null;
  syncBuilderFields();
  drawScene();
}

function parseShape(source) {
  const parsed = JSON.parse(source);
  return parsed;
}

function asPoint(pair) {
  return [Number(pair[0]), Number(pair[1])];
}

function dedupeVertices(vertices) {
  const cleaned = [];
  for (const vertex of vertices) {
    const point = asPoint(vertex);
    const lastPoint = cleaned[cleaned.length - 1];
    if (!cleaned.length || Math.hypot(point[0] - lastPoint[0], point[1] - lastPoint[1]) > EPSILON) {
      cleaned.push(point);
    }
  }
  const lastPoint = cleaned[cleaned.length - 1];
  if (cleaned.length > 1 && Math.hypot(cleaned[0][0] - lastPoint[0], cleaned[0][1] - lastPoint[1]) <= EPSILON) {
    cleaned.pop();
  }
  return cleaned;
}

function compileShape(shape) {
  if (Array.isArray(shape)) {
    return dedupeVertices(shape);
  }
  if (shape.vertices) {
    return dedupeVertices(shape.vertices);
  }
  if (!shape.start || !Array.isArray(shape.segments)) {
    throw new Error("Shape JSON must contain either 'vertices' or trace-based 'start' and 'segments'.");
  }

  let current = asPoint(shape.start);
  const vertices = [current];
  for (const segment of shape.segments) {
    let points = [];
    if (segment.type === "line") {
      points = [asPoint(segment.to)];
    } else if (segment.type === "arc") {
      points = sampleArc(current, segment);
    } else if (segment.type === "parabola") {
      points = sampleParabola(current, segment);
    } else if (segment.type === "polynomial") {
      points = samplePolynomial(current, segment);
    } else {
      throw new Error(`Unsupported segment type: ${segment.type}`);
    }
    vertices.push(...points);
    current = vertices[vertices.length - 1];
  }
  if (shape.closed !== false) {
    vertices.push(vertices[0]);
  }
  return dedupeVertices(vertices);
}

function sampleArc(current, segment) {
  const center = asPoint(segment.center);
  const radius = Number(segment.radius ?? Math.hypot(current[0] - center[0], current[1] - center[1]));
  const startAngle = Number(segment.start_angle ?? (Math.atan2(current[1] - center[1], current[0] - center[0]) * 180 / Math.PI));
  const endAngle = Number(segment.end_angle);
  const steps = Math.max(2, Number(segment.segments ?? 32));
  const points = [];
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const angle = (startAngle + (endAngle - startAngle) * t) * Math.PI / 180;
    points.push([
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    ]);
  }
  return points;
}

function sampleParabola(current, segment) {
  const control = asPoint(segment.control);
  const end = asPoint(segment.to);
  const steps = Math.max(2, Number(segment.segments ?? 32));
  const points = [];
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const omt = 1 - t;
    points.push([
      omt * omt * current[0] + 2 * omt * t * control[0] + t * t * end[0],
      omt * omt * current[1] + 2 * omt * t * control[1] + t * t * end[1],
    ]);
  }
  return points;
}

function samplePolynomial(current, segment) {
  const end = asPoint(segment.to);
  const coefficients = (segment.coefficients ?? []).map(Number);
  const steps = Math.max(2, Number(segment.segments ?? 48));
  const points = [];
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const baseX = current[0] + (end[0] - current[0]) * t;
    const baseY = current[1] + (end[1] - current[1]) * t;
    let offset = 0;
    coefficients.forEach((coefficient, power) => {
      offset += coefficient * (t ** (power + 1)) * (1 - t);
    });
    points.push([baseX, baseY + offset]);
  }
  return points;
}

function prepareSimulation() {
  stopAnimation();
  state.vertices = compileShape(state.shapeSpec);
  if (!isValidChamber(state.vertices)) {
    throw new Error("The current shape is not yet a valid closed chamber.");
  }
  state.boundaryClosed = true;
  resetSimulationState();
  const start = [
    Number(document.getElementById("startX").value),
    Number(document.getElementById("startY").value),
  ];
  const theta = Number(document.getElementById("theta").value);
  state.totalSteps = Number(document.getElementById("steps").value);
  state.engine = createEngine(state.vertices, start, theta);
  state.trace = [start.slice()];
  state.pendingCanvasPoints = [];
  drawScene();
}

function resetSimulationState() {
  state.engine = null;
  state.trace = [];
  state.completedSteps = 0;
  state.totalSteps = Number(document.getElementById("steps").value);
}

function createEngine(vertices, start, theta) {
  if (!pointInPolygon(start, vertices)) {
    throw new Error("The ray start point must be inside the chamber.");
  }
  return {
    vertices,
    position: start.slice(),
    direction: normalize(thetaToVector(theta)),
    theta,
  };
}

function stepSimulation() {
  if (!state.engine || state.completedSteps >= state.totalSteps) {
    return false;
  }
  const collision = nextCollision(state.engine.position, state.engine.direction, state.vertices);
  if (!collision) {
    throw new Error("No boundary collision was found. Check the chamber shape.");
  }
  state.trace.push(collision.point);
  state.engine.direction = reflect(state.engine.direction, collision.normal);
  state.engine.theta = vectorToTheta(state.engine.direction);
  state.engine.position = add(collision.point, scale(state.engine.direction, ADVANCE_EPSILON));
  state.completedSteps += 1;
  return true;
}

function animate() {
  if (!state.running) {
    return;
  }
  try {
    const stepsPerFrame = Number(document.getElementById("speed").value);
    for (let index = 0; index < stepsPerFrame; index += 1) {
      if (!stepSimulation()) {
        state.running = false;
        updateSummary("Simulation finished.");
        break;
      }
    }
    drawScene();
    if (state.running) {
      updateSummary("Simulation running in real time.");
      state.animationFrame = window.requestAnimationFrame(animate);
    }
  } catch (error) {
    stopAnimation();
    setSummary(error.message);
  }
}

function stopAnimation() {
  state.running = false;
  if (state.animationFrame !== null) {
    window.cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }
}

function nextCollision(position, direction, vertices) {
  const orientation = signedArea(vertices);
  let best = null;

  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const edge = subtract(end, start);
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) < EPSILON) {
      continue;
    }

    const offset = subtract(start, position);
    const distance = cross(offset, edge) / denominator;
    const portion = cross(offset, direction) / denominator;
    if (distance <= ADVANCE_EPSILON) {
      continue;
    }
    if (portion < -ADVANCE_EPSILON || portion > 1 + ADVANCE_EPSILON) {
      continue;
    }

    const normal = normalize(orientation > 0 ? [-edge[1], edge[0]] : [edge[1], -edge[0]]);
    const point = add(position, scale(direction, distance));
    if (!best || distance < best.distance) {
      best = { distance, point, normal };
    }
  }
  return best;
}

function thetaToVector(thetaDeg) {
  const radians = thetaDeg * Math.PI / 180;
  return [Math.sin(radians), Math.cos(radians)];
}

function vectorToTheta([x, y]) {
  return Math.atan2(x, y) * 180 / Math.PI;
}

function reflect(direction, normal) {
  return normalize(subtract(direction, scale(normal, 2 * dot(direction, normal))));
}

function pointInPolygon(point, vertices) {
  let inside = false;
  const [x, y] = point;
  for (let index = 0; index < vertices.length; index += 1) {
    const [x1, y1] = vertices[index];
    const [x2, y2] = vertices[(index + 1) % vertices.length];
    const intersects = (y1 > y) !== (y2 > y);
    if (intersects) {
      const xIntersection = ((x2 - x1) * (y - y1)) / (y2 - y1) + x1;
      if (x < xIntersection) {
        inside = !inside;
      }
    }
  }
  return inside;
}

function signedArea(vertices) {
  let area = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function drawScene() {
  syncCanvasResolution();
  const view = buildView(state.vertices.length ? state.vertices : [[0, 0]], state.trace);
  state.view = view;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  if (state.vertices.length) {
    drawPolygon(state.vertices, view, state.boundaryClosed);
  }
  if (state.trace.length > 1) {
    drawTrace(state.trace, view);
  }
  drawRayStart(view);
  drawParticle(view);
  drawPendingCanvasPoints(view);
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(31, 27, 24, 0.08)";
  ctx.lineWidth = 1;
  const spacing = 80;
  for (let x = 0; x <= canvas.width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPolygon(vertices, view, closed) {
  ctx.save();
  ctx.strokeStyle = "rgba(122, 50, 19, 0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const start = worldToCanvas(vertices[0], view);
  ctx.moveTo(start[0], start[1]);
  for (let index = 1; index < vertices.length; index += 1) {
    const point = worldToCanvas(vertices[index], view);
    ctx.lineTo(point[0], point[1]);
  }
  if (closed) {
    ctx.fillStyle = "rgba(178, 77, 34, 0.08)";
    ctx.closePath();
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

function drawTrace(trace, view) {
  ctx.save();
  ctx.strokeStyle = "rgba(15, 122, 93, 0.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const start = worldToCanvas(trace[0], view);
  ctx.moveTo(start[0], start[1]);
  for (let index = 1; index < trace.length; index += 1) {
    const point = worldToCanvas(trace[index], view);
    ctx.lineTo(point[0], point[1]);
  }
  ctx.stroke();
  ctx.restore();
}

function drawRayStart(view) {
  const start = [
    Number(document.getElementById("startX").value),
    Number(document.getElementById("startY").value),
  ];
  const point = worldToCanvas(start, view);
  ctx.save();
  ctx.fillStyle = "#1f1b18";
  ctx.beginPath();
  ctx.arc(point[0], point[1], 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticle(view) {
  if (!state.trace.length) {
    return;
  }
  const point = worldToCanvas(state.trace[state.trace.length - 1], view);
  ctx.save();
  ctx.fillStyle = "#0f7a5d";
  ctx.beginPath();
  ctx.arc(point[0], point[1], 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPendingCanvasPoints(view) {
  if (!state.pendingCanvasPoints.length) {
    return;
  }
  ctx.save();
  ctx.fillStyle = "#b24d22";
  for (const point of state.pendingCanvasPoints) {
    const canvasPoint = worldToCanvas(point, view);
    ctx.beginPath();
    ctx.arc(canvasPoint[0], canvasPoint[1], 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function buildView(vertices, trace) {
  const points = vertices.concat(trace);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  const padding = 60;
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const scaleX = (canvas.width - padding * 2) / width;
  const scaleY = (canvas.height - padding * 2) / height;
  return {
    minX,
    minY,
    padding,
    scale: Math.min(scaleX, scaleY),
  };
}

function worldToCanvas([x, y], view) {
  return [
    view.padding + (x - view.minX) * view.scale,
    canvas.height - view.padding - (y - view.minY) * view.scale,
  ];
}

function canvasToWorld(x, y, view) {
  return [
    view.minX + (x - view.padding) / view.scale,
    view.minY + (canvas.height - view.padding - y) / view.scale,
  ];
}

function syncCanvasResolution() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function syncPrimitiveTemplate() {
  primitiveParams.value = JSON.stringify(primitiveTemplates[primitiveType.value], null, 2);
}

function syncBuilderFields() {
  if (state.shapeSpec.start) {
    document.getElementById("builderStartX").value = state.shapeSpec.start[0];
    document.getElementById("builderStartY").value = state.shapeSpec.start[1];
  }
  syncShapeJson();
}

function syncShapeJson() {
  shapeJson.value = JSON.stringify(state.shapeSpec, null, 2);
}

function updateSummary(prefix) {
  const endPoint = state.trace.length ? state.trace[state.trace.length - 1] : null;
  const lines = [
    prefix,
    `Boundary vertices: ${state.vertices.length}`,
    `Completed bounces: ${state.completedSteps}/${state.totalSteps}`,
  ];
  if (endPoint) {
    lines.push(`Current point: (${endPoint[0].toFixed(6)}, ${endPoint[1].toFixed(6)})`);
  }
  if (state.engine) {
    lines.push(`Current theta: ${state.engine.theta.toFixed(6)}`);
  }
  setSummary(lines.join("\n"));
}

function isValidChamber(vertices) {
  return vertices.length >= 3 && Math.abs(signedArea(vertices)) > EPSILON;
}

function getBuilderCursor() {
  ensureBuilderShape();
  const preview = compileShape({
    start: state.shapeSpec.start,
    closed: false,
    segments: state.shapeSpec.segments,
  });
  return preview[preview.length - 1] ?? asPoint(state.shapeSpec.start);
}

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const worldPoint = canvasToWorld(event.clientX - rect.left, event.clientY - rect.top, state.view);
  const tool = canvasTool.value;

  if (tool === "ray-start") {
    document.getElementById("startX").value = worldPoint[0].toFixed(2);
    document.getElementById("startY").value = worldPoint[1].toFixed(2);
    drawScene();
    setSummary(`Ray start moved to (${worldPoint[0].toFixed(2)}, ${worldPoint[1].toFixed(2)}).`);
    return;
  }

  ensureBuilderShape();

  if (!state.shapeSpec.segments.length && !state.canvasStartArmed) {
    state.shapeSpec.start = [worldPoint[0], worldPoint[1]];
    document.getElementById("builderStartX").value = worldPoint[0].toFixed(2);
    document.getElementById("builderStartY").value = worldPoint[1].toFixed(2);
    state.canvasStartArmed = true;
    state.pendingCanvasPoints = [];
    refreshBuilderPreview();
    setSummary("Canvas start point placed. Click again to add the first segment.");
    return;
  }

  if (tool === "line") {
    state.shapeSpec.segments.push({ type: "line", to: [worldPoint[0], worldPoint[1]] });
    state.pendingCanvasPoints = [];
    refreshBuilderPreview();
    setSummary(`Line segment added to (${worldPoint[0].toFixed(2)}, ${worldPoint[1].toFixed(2)}).`);
    return;
  }

  state.pendingCanvasPoints.push(worldPoint);
  if (tool === "arc" && state.pendingCanvasPoints.length === 2) {
    const current = getBuilderCursor();
    const center = state.pendingCanvasPoints[0];
    const end = state.pendingCanvasPoints[1];
    const startAngle = Math.atan2(current[1] - center[1], current[0] - center[0]) * 180 / Math.PI;
    let endAngle = Math.atan2(end[1] - center[1], end[0] - center[0]) * 180 / Math.PI;
    let delta = endAngle - startAngle;
    while (delta > 180) {
      delta -= 360;
    }
    while (delta < -180) {
      delta += 360;
    }
    endAngle = startAngle + delta;
    state.shapeSpec.segments.push({
      type: "arc",
      center: [center[0], center[1]],
      radius: Math.hypot(current[0] - center[0], current[1] - center[1]),
      end_angle: endAngle,
      segments: 32,
    });
    state.pendingCanvasPoints = [];
    refreshBuilderPreview();
    setSummary("Arc segment added from the current endpoint.");
    return;
  }

  if (tool === "parabola" && state.pendingCanvasPoints.length === 2) {
    const control = state.pendingCanvasPoints[0];
    const end = state.pendingCanvasPoints[1];
    state.shapeSpec.segments.push({
      type: "parabola",
      control: [control[0], control[1]],
      to: [end[0], end[1]],
      segments: 32,
    });
    state.pendingCanvasPoints = [];
    refreshBuilderPreview();
    setSummary("Parabola segment added from the current endpoint.");
    return;
  }

  drawScene();
  if (tool === "arc") {
    setSummary("Arc tool: click once for the center, then once for the arc endpoint.");
  } else if (tool === "parabola") {
    setSummary("Parabola tool: click once for the control point, then once for the endpoint.");
  }
}

function setSummary(message) {
  summary.textContent = message;
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

function cross(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function scale(vector, factor) {
  return [vector[0] * factor, vector[1] * factor];
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1]);
  return [vector[0] / length, vector[1] / length];
}

syncPrimitiveTemplate();
loadPreset("chaos");
