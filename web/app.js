const EPSILON = 1e-9;
const ADVANCE_EPSILON = 1e-7;

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
      { type: "line", to: [220, -280] },
      { type: "arc", center: [220, 0], radius: 280, end_angle: 90, segments: 32 },
      { type: "line", to: [-180, 280] },
      { type: "parabola", control: [-420, 40], to: [-260, -280], segments: 36 },
    ],
  },
};

const state = {
  shapeSpec: clone(presetShapes.chaos),
  boundary: null,
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
  dragHandle: null,
  dragOrigin: null,
  dragAxisLock: null,
  handles: [],
  hoverHandle: null,
  selectedHandle: null,
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const presetSelect = document.getElementById("preset");
const shapeJson = document.getElementById("shapeJson");
const summary = document.getElementById("summary");
const canvasTool = document.getElementById("canvasTool");
const snapMode = document.getElementById("snapMode");
const snapSize = document.getElementById("snapSize");

presetSelect.addEventListener("change", () => {
  stopAnimation();
  loadPreset(presetSelect.value);
});

document.getElementById("applyShape").addEventListener("click", () => {
  try {
    stopAnimation();
    state.shapeSpec = parseShape(shapeJson.value);
    state.canvasStartArmed = hasTraceSegments(state.shapeSpec);
    applyShapeSpec("Shape applied.");
  } catch (error) {
    setSummary(error.message);
  }
});

document.getElementById("undoPrimitive").addEventListener("click", () => {
  ensureBuilderShape();
  state.shapeSpec.segments.pop();
  refreshBuilderPreview("Removed the last segment.");
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
  state.pendingCanvasPoints = [];
  state.canvasStartArmed = false;
  applyShapeSpec("Builder cleared.");
});

document.getElementById("downloadShape").addEventListener("click", () => {
  downloadText("echo_shape.json", JSON.stringify(state.shapeSpec, null, 2));
});

document.getElementById("run").addEventListener("click", () => {
  try {
    state.shapeSpec = parseShape(shapeJson.value);
    state.canvasStartArmed = hasTraceSegments(state.shapeSpec);
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
    state.canvasStartArmed = hasTraceSegments(state.shapeSpec);
    applyShapeSpec("Simulation reset.");
  } catch (error) {
    setSummary(error.message);
  }
});

document.getElementById("finish").addEventListener("click", () => {
  try {
    state.shapeSpec = parseShape(shapeJson.value);
    state.canvasStartArmed = hasTraceSegments(state.shapeSpec);
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
  window.localStorage.setItem(
    "echo-chart-data",
    JSON.stringify({
      trace: state.trace,
      vertices: state.vertices,
      theta: state.engine ? state.engine.theta : Number(document.getElementById("theta").value),
    })
  );
  window.open("charts.html", "_blank", "noopener");
});

document.getElementById("closeCanvasShape").addEventListener("click", () => {
  ensureBuilderShape();
  state.shapeSpec.closed = true;
  refreshBuilderPreview("Canvas-built chamber closed.");
});

document.getElementById("cancelCanvasTool").addEventListener("click", () => {
  state.pendingCanvasPoints = [];
  drawScene();
  setSummary("Pending canvas tool points cleared.");
});

canvas.addEventListener("click", (event) => {
  if (canvasTool.value === "edit" || state.dragHandle) {
    return;
  }
  try {
    handleCanvasClick(event);
  } catch (error) {
    setSummary(error.message);
  }
});
canvas.addEventListener("mousedown", (event) => {
  if (canvasTool.value !== "edit") {
    return;
  }
  try {
    handlePointerDown(event);
  } catch (error) {
    setSummary(error.message);
  }
});
window.addEventListener("mousemove", (event) => {
  if (canvasTool.value === "edit" && !state.dragHandle) {
    updateHoverHandle(event);
  }
  if (!state.dragHandle) {
    return;
  }
  try {
    handlePointerMove(event);
  } catch (error) {
    state.dragHandle = null;
    state.dragOrigin = null;
    state.dragAxisLock = null;
    setSummary(error.message);
  }
});
window.addEventListener("mouseup", () => {
  if (!state.dragHandle) {
    return;
  }
  state.selectedHandle = cloneHandleRef(state.dragHandle);
  state.dragHandle = null;
  state.dragOrigin = null;
  state.dragAxisLock = null;
  drawScene();
  setSummary("Point updated.");
});
window.addEventListener("keydown", (event) => {
  if (canvasTool.value !== "edit" || !state.selectedHandle) {
    return;
  }
  const step = event.shiftKey ? 10 : 1;
  let delta = null;
  if (event.key === "ArrowUp") {
    delta = [0, step];
  } else if (event.key === "ArrowDown") {
    delta = [0, -step];
  } else if (event.key === "ArrowLeft") {
    delta = [-step, 0];
  } else if (event.key === "ArrowRight") {
    delta = [step, 0];
  }
  if (!delta) {
    return;
  }
  event.preventDefault();
  const point = maybeSnap([
    state.selectedHandle.point[0] + delta[0],
    state.selectedHandle.point[1] + delta[1],
  ]);
  applyHandleMove(state.selectedHandle, point);
  state.selectedHandle.point = point;
  refreshBuilderPreview("Point nudged.");
});

window.addEventListener("resize", drawScene);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasTraceSegments(shape) {
  return !!(shape && Array.isArray(shape.segments));
}

function loadPreset(name) {
  state.shapeSpec = clone(presetShapes[name]);
  state.canvasStartArmed = hasTraceSegments(state.shapeSpec);
  applyShapeSpec(`${name} preset loaded.`);
}

function parseShape(source) {
  return JSON.parse(source);
}

function ensureBuilderShape() {
  if (!hasTraceSegments(state.shapeSpec)) {
    state.shapeSpec = {
      start: [
        Number(document.getElementById("builderStartX").value),
        Number(document.getElementById("builderStartY").value),
      ],
      closed: true,
      segments: [],
    };
    state.canvasStartArmed = false;
  }
}

function applyShapeSpec(prefix) {
  state.boundary = compileBoundary(state.shapeSpec);
  state.vertices = state.boundary.vertices;
  state.boundaryClosed = isValidChamber(state.vertices);
  state.trace = [];
  state.engine = null;
  state.pendingCanvasPoints = [];
  state.dragHandle = null;
  state.dragOrigin = null;
  state.dragAxisLock = null;
  state.hoverHandle = null;
  state.selectedHandle = null;
  syncBuilderFields();
  drawScene();
  setSummary([
    prefix,
    `Boundary vertices: ${state.vertices.length}`,
    `Closed chamber: ${state.boundaryClosed ? "yes" : "no"}`,
  ].join("\n"));
}

function refreshBuilderPreview(prefix) {
  state.canvasStartArmed = hasTraceSegments(state.shapeSpec) && state.shapeSpec.segments.length > 0;
  applyShapeSpec(prefix);
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

function signedArea(vertices) {
  let area = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function unwrapAngle(angle, startAngle) {
  while (angle - startAngle > 180) {
    angle -= 360;
  }
  while (angle - startAngle < -180) {
    angle += 360;
  }
  return angle;
}

function angleOnArc(angle, startAngle, endAngle) {
  const adjusted = unwrapAngle(angle, startAngle);
  const delta = endAngle - startAngle;
  if (delta >= 0) {
    return adjusted >= startAngle - 1e-7 && adjusted <= endAngle + 1e-7;
  }
  return adjusted >= endAngle - 1e-7 && adjusted <= startAngle + 1e-7;
}

function sampleArcPoints(current, segment) {
  const center = asPoint(segment.center);
  const radius = Number(segment.radius ?? Math.hypot(current[0] - center[0], current[1] - center[1]));
  const startAngle = Number(
    segment.start_angle ?? (Math.atan2(current[1] - center[1], current[0] - center[0]) * 180 / Math.PI)
  );
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

function sampleParabolaPoints(current, segment) {
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

function samplePolynomialPoints(current, segment) {
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

function buildLineEntity(start, end, orientation) {
  const edge = subtract(end, start);
  const normal = normalize(orientation > 0 ? [-edge[1], edge[0]] : [edge[1], -edge[0]]);
  return { type: "line", start, end, edge, normal };
}

function buildLineEntities(vertices, orientation) {
  const entities = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    entities.push(buildLineEntity(start, end, orientation));
  }
  return entities;
}

function compileBoundary(shape) {
  if (Array.isArray(shape)) {
    const vertices = dedupeVertices(shape);
    const orientation = signedArea(vertices);
    return { vertices, entities: buildLineEntities(vertices, orientation), orientation };
  }
  if (shape.vertices) {
    const vertices = dedupeVertices(shape.vertices);
    const orientation = signedArea(vertices);
    return { vertices, entities: buildLineEntities(vertices, orientation), orientation };
  }
  if (!shape.start || !Array.isArray(shape.segments)) {
    throw new Error("Shape JSON must contain either 'vertices' or trace-based 'start' and 'segments'.");
  }

  let current = asPoint(shape.start);
  const vertices = [current];
  const deferredEntities = [];
  for (const segment of shape.segments) {
    if (segment.type === "line") {
      const end = asPoint(segment.to);
      vertices.push(end);
      deferredEntities.push({ type: "line", start: current, end });
      current = end;
      continue;
    }
    if (segment.type === "arc") {
      const center = asPoint(segment.center);
      const radius = Number(segment.radius ?? Math.hypot(current[0] - center[0], current[1] - center[1]));
      const startAngle = Number(
        segment.start_angle ?? (Math.atan2(current[1] - center[1], current[0] - center[0]) * 180 / Math.PI)
      );
      const endAngle = Number(segment.end_angle);
      deferredEntities.push({
        type: "arc",
        center,
        radius,
        start_angle: startAngle,
        end_angle: endAngle,
        ccw: endAngle >= startAngle,
      });
      const points = sampleArcPoints(current, segment);
      vertices.push(...points);
      current = points[points.length - 1];
      continue;
    }
    if (segment.type === "parabola") {
      const points = sampleParabolaPoints(current, segment);
      for (const point of points) {
        deferredEntities.push({ type: "line", start: current, end: point });
        vertices.push(point);
        current = point;
      }
      continue;
    }
    if (segment.type === "polynomial") {
      const points = samplePolynomialPoints(current, segment);
      for (const point of points) {
        deferredEntities.push({ type: "line", start: current, end: point });
        vertices.push(point);
        current = point;
      }
      continue;
    }
    throw new Error(`Unsupported segment type: ${segment.type}`);
  }

  if (shape.closed !== false) {
    vertices.push(vertices[0]);
  }
  const dedupedVertices = dedupeVertices(vertices);
  const orientation = signedArea(dedupedVertices);
  if (
    shape.closed !== false &&
    Math.hypot(current[0] - dedupedVertices[0][0], current[1] - dedupedVertices[0][1]) > EPSILON
  ) {
    deferredEntities.push({ type: "line", start: current, end: dedupedVertices[0] });
  }
  const entities = deferredEntities.map((entity) => {
    if (entity.type === "line") {
      return buildLineEntity(entity.start, entity.end, orientation);
    }
    return entity;
  });
  return { vertices: dedupedVertices, entities, orientation };
}

function prepareSimulation() {
  stopAnimation();
  state.boundary = compileBoundary(state.shapeSpec);
  state.vertices = state.boundary.vertices;
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
  state.engine = createEngine(state.boundary, start, theta);
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

function createEngine(boundary, start, theta) {
  if (!pointInPolygon(start, boundary.vertices)) {
    throw new Error("The ray start point must be inside the chamber.");
  }
  return {
    boundary,
    position: start.slice(),
    direction: normalize(thetaToVector(theta)),
    theta,
  };
}

function rayLineIntersection(position, direction, entity) {
  const denominator = cross(direction, entity.edge);
  if (Math.abs(denominator) < EPSILON) {
    return null;
  }
  const offset = subtract(entity.start, position);
  const distance = cross(offset, entity.edge) / denominator;
  const portion = cross(offset, direction) / denominator;
  if (distance <= ADVANCE_EPSILON) {
    return null;
  }
  if (portion < -ADVANCE_EPSILON || portion > 1 + ADVANCE_EPSILON) {
    return null;
  }
  return {
    distance,
    point: add(position, scale(direction, distance)),
    normal: entity.normal,
  };
}

function rayArcIntersection(position, direction, entity) {
  const offset = subtract(position, entity.center);
  const b = 2 * dot(direction, offset);
  const c = dot(offset, offset) - entity.radius * entity.radius;
  const delta = b * b - 4 * c;
  if (delta < 0) {
    return null;
  }
  const root = Math.sqrt(Math.max(delta, 0));
  const candidates = [(-b - root) / 2, (-b + root) / 2];
  let best = null;
  for (const distance of candidates) {
    if (distance <= ADVANCE_EPSILON) {
      continue;
    }
    const point = add(position, scale(direction, distance));
    const angle = Math.atan2(point[1] - entity.center[1], point[0] - entity.center[0]) * 180 / Math.PI;
    if (!angleOnArc(angle, entity.start_angle, entity.end_angle)) {
      continue;
    }
    const radial = normalize(subtract(point, entity.center));
    const normal = scale(radial, entity.ccw ? -1 : 1);
    const candidate = { distance, point, normal };
    if (!best || distance < best.distance) {
      best = candidate;
    }
  }
  return best;
}

function nextCollision(position, direction, boundary) {
  let best = null;
  for (const entity of boundary.entities) {
    const candidate = entity.type === "line"
      ? rayLineIntersection(position, direction, entity)
      : rayArcIntersection(position, direction, entity);
    if (!candidate) {
      continue;
    }
    if (!best || candidate.distance < best.distance) {
      best = candidate;
    }
  }
  return best;
}

function stepSimulation() {
  if (!state.engine || state.completedSteps >= state.totalSteps) {
    return false;
  }
  const collision = nextCollision(state.engine.position, state.engine.direction, state.engine.boundary);
  if (!collision) {
    throw new Error("No boundary collision was found. Check the chamber shape.");
  }
  state.trace.push(collision.point);
  state.engine.direction = reflect(state.engine.direction, collision.normal);
  state.engine.theta = vectorToTheta(state.engine.direction);
  state.engine.position = add(collision.point, scale(collision.normal, ADVANCE_EPSILON));
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
  drawHandles(view);
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

function buildHandles() {
  const handles = [
    { kind: "ray-start", point: [Number(document.getElementById("startX").value), Number(document.getElementById("startY").value)] },
  ];

  if (state.shapeSpec.vertices) {
    state.shapeSpec.vertices.forEach((vertex, index) => {
      handles.push({ kind: "vertex", index, point: asPoint(vertex) });
    });
    return handles;
  }

  if (!hasTraceSegments(state.shapeSpec) || !state.shapeSpec.start) {
    return handles;
  }

  handles.push({ kind: "start", point: asPoint(state.shapeSpec.start) });
  let current = asPoint(state.shapeSpec.start);
  state.shapeSpec.segments.forEach((segment, index) => {
    if (segment.type === "line") {
      handles.push({ kind: "line-end", index, point: asPoint(segment.to) });
      current = asPoint(segment.to);
    } else if (segment.type === "arc") {
      handles.push({ kind: "arc-center", index, point: asPoint(segment.center) });
      const arcPoints = sampleArcPoints(current, segment);
      handles.push({ kind: "arc-end", index, point: arcPoints[arcPoints.length - 1] });
      current = arcPoints[arcPoints.length - 1];
    } else if (segment.type === "parabola") {
      handles.push({ kind: "parabola-control", index, point: asPoint(segment.control) });
      handles.push({ kind: "parabola-end", index, point: asPoint(segment.to) });
      current = asPoint(segment.to);
    } else if (segment.type === "polynomial") {
      handles.push({ kind: "poly-end", index, point: asPoint(segment.to) });
      current = asPoint(segment.to);
    }
  });
  return handles;
}

function drawHandles(view) {
  state.handles = buildHandles();
  if (canvasTool.value !== "edit") {
    return;
  }
  ctx.save();
  ctx.font = "12px SFMono-Regular, Consolas, monospace";
  for (const handle of state.handles) {
    const [x, y] = worldToCanvas(handle.point, view);
    const active = sameHandle(handle, state.dragHandle) || sameHandle(handle, state.selectedHandle);
    const hover = sameHandle(handle, state.hoverHandle);
    ctx.fillStyle = active
      ? "#0f7a5d"
      : hover
        ? "#7a3213"
        : handle.kind === "ray-start"
          ? "#1f1b18"
          : "#b24d22";
    ctx.strokeStyle = "white";
    ctx.lineWidth = active ? 3 : 2;
    ctx.beginPath();
    ctx.arc(x, y, active ? 7 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(31, 27, 24, 0.82)";
    ctx.fillText(handleLabel(handle), x + 10, y - 10);
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

function getCanvasWorldPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return maybeSnap(canvasToWorld(event.clientX - rect.left, event.clientY - rect.top, state.view));
}

function syncCanvasResolution() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function syncBuilderFields() {
  if (state.shapeSpec.start) {
    document.getElementById("builderStartX").value = state.shapeSpec.start[0];
    document.getElementById("builderStartY").value = state.shapeSpec.start[1];
  }
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

function setSummary(message) {
  summary.textContent = message;
}

function handleLabel(handle) {
  switch (handle.kind) {
    case "ray-start":
      return "ray";
    case "vertex":
      return `v${handle.index}`;
    case "start":
      return "start";
    case "line-end":
      return `line ${handle.index + 1}`;
    case "arc-center":
      return `arc ${handle.index + 1} c`;
    case "arc-end":
      return `arc ${handle.index + 1} end`;
    case "parabola-control":
      return `par ${handle.index + 1} c`;
    case "parabola-end":
      return `par ${handle.index + 1} end`;
    case "poly-end":
      return `poly ${handle.index + 1}`;
    default:
      return handle.kind;
  }
}

function isValidChamber(vertices) {
  return vertices.length >= 3 && Math.abs(signedArea(vertices)) > EPSILON;
}

function getBuilderCursor() {
  ensureBuilderShape();
  const preview = compileBoundary({
    start: state.shapeSpec.start,
    closed: false,
    segments: state.shapeSpec.segments,
  });
  return preview.vertices[preview.vertices.length - 1] ?? asPoint(state.shapeSpec.start);
}

function handleCanvasClick(event) {
  if (!state.view) {
    return;
  }
  const worldPoint = getCanvasWorldPoint(event);
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
    refreshBuilderPreview("Canvas start point placed. Click again to add the first segment.");
    return;
  }

  if (tool === "line") {
    state.shapeSpec.segments.push({ type: "line", to: [worldPoint[0], worldPoint[1]] });
    refreshBuilderPreview(`Line segment added to (${worldPoint[0].toFixed(2)}, ${worldPoint[1].toFixed(2)}).`);
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
    refreshBuilderPreview("Arc segment added.");
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
    refreshBuilderPreview("Parabola segment added.");
    return;
  }

  drawScene();
  if (tool === "arc") {
    setSummary("Arc tool: click once for the center, then once for the arc endpoint.");
  } else if (tool === "parabola") {
    setSummary("Parabola tool: click once for the control point, then once for the endpoint.");
  }
}

function nearestHandle(worldPoint) {
  let best = null;
  for (const handle of buildHandles()) {
    const distance = Math.hypot(worldPoint[0] - handle.point[0], worldPoint[1] - handle.point[1]);
    if (!best || distance < best.distance) {
      best = { ...handle, distance };
    }
  }
  if (!best || best.distance > 18 / Math.max(state.view?.scale ?? 1, 1e-9)) {
    return null;
  }
  return best;
}

function handlePointerDown(event) {
  const worldPoint = getCanvasWorldPoint(event);
  state.dragHandle = nearestHandle(worldPoint);
  if (!state.dragHandle) {
    state.selectedHandle = null;
    setSummary("Edit mode: drag a visible handle.");
    drawScene();
    return;
  }
  state.selectedHandle = cloneHandleRef(state.dragHandle);
  state.dragOrigin = [...state.dragHandle.point];
  state.dragAxisLock = null;
  drawScene();
}

function handlePointerMove(event) {
  let worldPoint = getCanvasWorldPoint(event);
  if (event.shiftKey && state.dragOrigin) {
    if (!state.dragAxisLock) {
      const dx = Math.abs(worldPoint[0] - state.dragOrigin[0]);
      const dy = Math.abs(worldPoint[1] - state.dragOrigin[1]);
      state.dragAxisLock = dx >= dy ? "x" : "y";
    }
    if (state.dragAxisLock === "x") {
      worldPoint = [worldPoint[0], state.dragOrigin[1]];
    } else if (state.dragAxisLock === "y") {
      worldPoint = [state.dragOrigin[0], worldPoint[1]];
    }
    worldPoint = maybeSnap(worldPoint);
  } else {
    state.dragAxisLock = null;
  }
  applyHandleMove(state.dragHandle, worldPoint);
  state.dragHandle.point = worldPoint;
  refreshBuilderPreview(
    state.dragAxisLock
      ? `Point dragging with ${state.dragAxisLock === "x" ? "horizontal" : "vertical"} lock...`
      : "Point dragging..."
  );
}

function maybeSnap(point) {
  if (snapMode.value !== "grid") {
    return point;
  }
  const size = Math.max(Number(snapSize.value), 1);
  return [
    Math.round(point[0] / size) * size,
    Math.round(point[1] / size) * size,
  ];
}

function updateHoverHandle(event) {
  const handle = nearestHandle(getCanvasWorldPoint(event));
  if (!sameHandle(handle, state.hoverHandle)) {
    state.hoverHandle = handle ? cloneHandleRef(handle) : null;
    drawScene();
  }
}

function sameHandle(a, b) {
  if (!a || !b) {
    return false;
  }
  return a.kind === b.kind && a.index === b.index;
}

function cloneHandleRef(handle) {
  if (!handle) {
    return null;
  }
  return {
    kind: handle.kind,
    index: handle.index,
    point: [...handle.point],
  };
}

function applyHandleMove(handle, worldPoint) {
  if (handle.kind === "ray-start") {
    document.getElementById("startX").value = worldPoint[0].toFixed(2);
    document.getElementById("startY").value = worldPoint[1].toFixed(2);
    return;
  }
  if (state.shapeSpec.vertices) {
    state.shapeSpec.vertices[handle.index] = [worldPoint[0], worldPoint[1]];
    return;
  }
  if (handle.kind === "start") {
    state.shapeSpec.start = [worldPoint[0], worldPoint[1]];
    return;
  }
  const segment = state.shapeSpec.segments[handle.index];
  if (handle.kind === "line-end" || handle.kind === "poly-end" || handle.kind === "parabola-end") {
    segment.to = [worldPoint[0], worldPoint[1]];
    return;
  }
  if (handle.kind === "parabola-control") {
    segment.control = [worldPoint[0], worldPoint[1]];
    return;
  }
  if (handle.kind === "arc-center") {
    const startPoint = arcStartPoint(handle.index);
    segment.center = [worldPoint[0], worldPoint[1]];
    segment.radius = Math.hypot(startPoint[0] - worldPoint[0], startPoint[1] - worldPoint[1]);
    return;
  }
  if (handle.kind === "arc-end") {
    const center = asPoint(segment.center);
    segment.end_angle = Math.atan2(worldPoint[1] - center[1], worldPoint[0] - center[0]) * 180 / Math.PI;
  }
}

function arcStartPoint(segmentIndex) {
  let current = asPoint(state.shapeSpec.start);
  for (let index = 0; index < segmentIndex; index += 1) {
    const segment = state.shapeSpec.segments[index];
    if (segment.type === "line" || segment.type === "parabola" || segment.type === "polynomial") {
      current = asPoint(segment.to);
    } else if (segment.type === "arc") {
      const points = sampleArcPoints(current, segment);
      current = points[points.length - 1];
    }
  }
  return current;
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
  if (length < EPSILON) {
    throw new Error("Zero-length vector is not valid.");
  }
  return [vector[0] / length, vector[1] / length];
}

loadPreset("chaos");
