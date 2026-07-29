import {
  createDefaultControls,
  createSimulation,
  extendPathToBounds,
  getVehiclePoint,
  isSignalGreen,
  stepSimulation,
} from "./engine.js";
import { STAGES } from "./stages.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const TICK_MS = 520;
const VEHICLE_COLORS = ["#ed6a5a", "#4f7cac", "#f4d35e", "#76c9a4", "#9b6dcc"];
const LABELS = {
  straight: "直進",
  turn: "曲がる",
  left: "左折",
  right: "右折",
  "north-south": "南北を青",
  "east-west": "東西を青",
  "turn-phase": "右左折を青",
  "run-phase": "直進を青",
  "phase-1": "第1方向",
  "phase-2": "第2方向",
  "phase-3": "第3方向",
};

const elements = {
  board: document.querySelector("#game-board"),
  stageList: document.querySelector("#stage-list"),
  stageKicker: document.querySelector("#stage-kicker"),
  stageTitle: document.querySelector("#stage-title"),
  instruction: document.querySelector("#stage-instruction"),
  tip: document.querySelector("#stage-tip"),
  turn: document.querySelector("#turn-value"),
  editor: document.querySelector("#control-editor"),
  play: document.querySelector("#play-button"),
  pause: document.querySelector("#pause-button"),
  reset: document.querySelector("#reset-button"),
  next: document.querySelector("#next-button"),
  status: document.querySelector("#status-message"),
  overlay: document.querySelector("#result-overlay"),
  resultIcon: document.querySelector("#result-icon"),
  resultLabel: document.querySelector("#result-label"),
  resultTitle: document.querySelector("#result-title"),
  resultDetail: document.querySelector("#result-detail"),
};

let activeStageIndex = 0;
let controls;
let simulation;
let timerId = null;
const clearedStageIds = new Set(
  JSON.parse(localStorage.getItem("junction-flow-cleared") ?? "[]"),
);

function stage() {
  return STAGES[activeStageIndex];
}

function svgElement(name, attributes = {}, text = "") {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  if (text) node.textContent = text;
  return node;
}

function allPaths(currentStage) {
  return currentStage.vehicles.flatMap((vehicle) =>
    vehicle.branches
      ? Object.values(vehicle.branches)
      : [vehicle.path],
  );
}

function projectionFor(currentStage) {
  const points = allPaths(currentStage).flat();
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = Math.max(maxX - minX, 1);
  const yRange = Math.max(maxY - minY, 1);

  return ([x, y]) => [
    13 + ((x - minX) / xRange) * 74,
    13 + ((y - minY) / yRange) * 74,
  ];
}

function projectedRoute(path, project, portals) {
  const projected = path.map((point) => project(point));
  return portals
    ? [[...portals.entry], ...projected, [...portals.exit]]
    : extendPathToBounds(projected);
}

function polylinePoints(path, project, portals) {
  return projectedRoute(path, project, portals)
    .map((point) => point.join(","))
    .join(" ");
}

function markerLabelPoint([x, y]) {
  if (x <= 6.5) return [x + 5.5, y + 1];
  if (x >= 93.5) return [x - 5.5, y + 1];
  if (y <= 6.5) return [x, y + 6];
  return [x, y - 4.5];
}

function appendBoardBackdrop() {
  const pattern = svgElement("pattern", {
    id: "grass-grid",
    width: 5,
    height: 5,
    patternUnits: "userSpaceOnUse",
  });
  pattern.append(
    svgElement("path", {
      d: "M 5 0 L 0 0 0 5",
      fill: "none",
      stroke: "#8fa87b",
      "stroke-width": 0.35,
      opacity: 0.55,
    }),
  );
  const defs = svgElement("defs");
  defs.append(pattern);
  elements.board.append(
    defs,
    svgElement("rect", {
      width: 100,
      height: 100,
      fill: "#a8bc94",
    }),
    svgElement("rect", {
      width: 100,
      height: 100,
      fill: "url(#grass-grid)",
    }),
  );

  const blocks = [
    [5, 5, 15, 10, "#ded7c7"],
    [77, 6, 17, 12, "#d4ccbb"],
    [5, 80, 13, 14, "#ded7c7"],
    [80, 81, 14, 12, "#d4ccbb"],
  ];
  for (const [x, y, width, height, fill] of blocks) {
    elements.board.append(
      svgElement("rect", {
        x,
        y,
        width,
        height,
        rx: 1.5,
        fill,
        stroke: "#7f897c",
        "stroke-width": 0.6,
      }),
    );
  }
}

function appendRoads(currentStage, project) {
  const seen = new Set();
  for (const vehicle of currentStage.vehicles) {
    const paths = vehicle.branches
      ? Object.values(vehicle.branches)
      : [vehicle.path];
    for (const path of paths) {
      const points = polylinePoints(path, project, vehicle.portals);
      if (seen.has(points)) continue;
      seen.add(points);
      elements.board.append(
        svgElement("polyline", {
          points,
          fill: "none",
          stroke: "#29312f",
          "stroke-width": 13,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        }),
        svgElement("polyline", {
          points,
          fill: "none",
          stroke: "#f4d35e",
          "stroke-width": 0.8,
          "stroke-dasharray": "3 3",
          "stroke-linecap": "round",
          opacity: 0.78,
        }),
      );
    }
  }
}

function appendSelectedRoutes(currentStage, project) {
  simulation.vehicles.forEach((vehicle, index) => {
    const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];
    elements.board.append(
      svgElement("polyline", {
        points: polylinePoints(vehicle.path, project, vehicle.portals),
        fill: "none",
        stroke: color,
        "stroke-width": 1.8,
        "stroke-dasharray": "1.5 2.5",
        "stroke-linecap": "round",
        opacity: 0.72,
      }),
    );
  });
}

function appendEntryAndExitMarkers(project) {
  simulation.vehicles.forEach((vehicle, index) => {
    const route = projectedRoute(vehicle.path, project, vehicle.portals);
    const start = route[0];
    const end = route.at(-1);
    const entryLabel = markerLabelPoint(start);
    const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];

    elements.board.append(
      svgElement("circle", {
        cx: start[0],
        cy: start[1],
        r: 3.2,
        fill: color,
        stroke: "#17201d",
        "stroke-width": 0.8,
      }),
      svgElement("text", {
        x: entryLabel[0],
        y: entryLabel[1],
        fill: "#17201d",
        "font-size": 2.7,
        "font-weight": 900,
        "text-anchor": "middle",
      }, "IN"),
      svgElement("rect", {
        x: end[0] - 3.8,
        y: end[1] - 2.3,
        width: 7.6,
        height: 4.6,
        rx: 0.7,
        fill: "#f4d35e",
        stroke: "#17201d",
        "stroke-width": 0.55,
      }),
      svgElement("text", {
        x: end[0],
        y: end[1] + 1.05,
        fill: "#17201d",
        "font-size": 2.5,
        "font-weight": 900,
        "text-anchor": "middle",
      }, "EXIT"),
    );
  });
}

function appendSignals(currentStage, project) {
  currentStage.signals.forEach((signal, index) => {
    const vehicle = simulation.vehicles.find(({ id }) =>
      signal.vehicleIds.includes(id),
    );
    if (!vehicle) return;
    const point = project(
      vehicle.path[Math.min(signal.stopIndex, vehicle.path.length - 1)],
    );
    const green = isSignalGreen(signal, simulation);
    const xOffset = index % 2 === 0 ? -5 : 3;
    const group = svgElement("g", {
      transform: `translate(${point[0] + xOffset} ${point[1] - 5})`,
    });
    group.append(
      svgElement("rect", {
        x: 0,
        y: 0,
        width: 4.6,
        height: 8.5,
        rx: 1.3,
        fill: "#17201d",
        stroke: "#fffdf7",
        "stroke-width": 0.55,
      }),
      svgElement("circle", {
        cx: 2.3,
        cy: 2.4,
        r: 1.2,
        fill: green ? "#614944" : "#ed6a5a",
      }),
      svgElement("circle", {
        cx: 2.3,
        cy: 6.1,
        r: 1.2,
        fill: green ? "#76c9a4" : "#43514c",
      }),
    );
    elements.board.append(group);
  });
}

function vehicleAngle(vehicle) {
  const index = Math.min(vehicle.pathIndex, vehicle.path.length - 1);
  const from = vehicle.path[Math.max(0, index - 1)];
  const to = vehicle.path[Math.min(vehicle.path.length - 1, index + 1)];
  return Math.atan2(to[1] - from[1], to[0] - from[0]) * (180 / Math.PI);
}

function appendVehicles(project) {
  simulation.vehicles.forEach((vehicle, index) => {
    if (vehicle.exited) return;
    const route = projectedRoute(vehicle.path, project, vehicle.portals);
    const atStart = vehicle.pathIndex === 0;
    const atEnd = vehicle.pathIndex === vehicle.path.length - 1;
    const [x, y] = atStart
      ? route[0]
      : atEnd
        ? route.at(-1)
        : project(getVehiclePoint(vehicle));
    const group = svgElement("g", {
      class: "vehicle",
      transform: `translate(${x} ${y}) rotate(${vehicleAngle(vehicle)})`,
    });
    group.append(
      svgElement("rect", {
        x: -3.5,
        y: -2.2,
        width: 7,
        height: 4.4,
        rx: 1.2,
        fill: VEHICLE_COLORS[index % VEHICLE_COLORS.length],
        stroke: "#17201d",
        "stroke-width": 0.8,
      }),
      svgElement("rect", {
        x: -0.8,
        y: -1.6,
        width: 2.3,
        height: 3.2,
        rx: 0.4,
        fill: "#d9edf0",
        stroke: "#17201d",
        "stroke-width": 0.35,
      }),
      svgElement("circle", { cx: -2.1, cy: -2.3, r: 0.55, fill: "#17201d" }),
      svgElement("circle", { cx: 2.1, cy: -2.3, r: 0.55, fill: "#17201d" }),
      svgElement("circle", { cx: -2.1, cy: 2.3, r: 0.55, fill: "#17201d" }),
      svgElement("circle", { cx: 2.1, cy: 2.3, r: 0.55, fill: "#17201d" }),
    );
    elements.board.append(group);
  });
}

function renderBoard() {
  const currentStage = stage();
  const project = projectionFor(currentStage);
  elements.board.replaceChildren();
  elements.board.append(
    svgElement(
      "title",
      { id: "board-title" },
      `${currentStage.title}の交通パズル`,
    ),
    svgElement(
      "desc",
      { id: "board-description" },
      "信号と矢印を設定し、すべての車を安全に出口へ導きます。",
    ),
  );
  appendBoardBackdrop();
  appendRoads(currentStage, project);
  appendSelectedRoutes(currentStage, project);
  appendEntryAndExitMarkers(project);
  appendSignals(currentStage, project);
  appendVehicles(project);
}

function renderStageList() {
  elements.stageList.replaceChildren();
  STAGES.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `stage-button${clearedStageIds.has(item.id) ? " is-cleared" : ""}`;
    button.setAttribute("aria-current", String(index === activeStageIndex));
    const cleared = clearedStageIds.has(item.id);
    button.innerHTML = `
      <span class="stage-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="stage-name">${item.title}</span>
      <span class="stage-check"${cleared ? ' aria-label="クリア済み"' : ' aria-hidden="true"'}>✓</span>
    `;
    button.addEventListener("click", () => loadStage(index));
    elements.stageList.append(button);
  });
}

function makeSelect(controlId, label, hint, values, selected, onChange) {
  const group = document.createElement("div");
  group.className = "control-group";
  const labelElement = document.createElement("label");
  labelElement.className = "control-label";
  labelElement.htmlFor = controlId;
  labelElement.textContent = label;
  const hintElement = document.createElement("span");
  hintElement.className = "control-hint";
  hintElement.textContent = hint;
  labelElement.append(hintElement);

  const select = document.createElement("select");
  select.id = controlId;
  select.className = "control-select";
  select.disabled = simulation.turn > 0;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = LABELS[value] ?? value;
    option.selected = value === selected;
    select.append(option);
  });
  select.addEventListener("change", () => onChange(select.value));
  group.append(labelElement, select);
  return group;
}

function rebuildReadySimulation() {
  stopTimer();
  simulation = createSimulation(stage(), controls);
  hideResult();
  render();
}

function renderControls() {
  elements.editor.replaceChildren();
  const arrowEntries = Object.entries(stage().controls.arrows ?? {});
  arrowEntries.forEach(([id, options], index) => {
    elements.editor.append(
      makeSelect(
        `control-${stage().id}-arrow-${id}`,
        `車両 ${String.fromCharCode(65 + index)} の進路`,
        "交差点で進む向き",
        options,
        controls.arrows[id],
        (value) => {
          controls.arrows[id] = value;
          rebuildReadySimulation();
        },
      ),
    );
  });

  const phases = stage().controls.phaseOrder ?? [];
  phases.forEach((_, index) => {
    elements.editor.append(
      makeSelect(
        `control-${stage().id}-phase-${index}`,
        `信号フェーズ ${index + 1}`,
        `${index + 1}番目に青にする方向`,
        phases,
        controls.phaseOrder[index],
        (value) => {
          controls.phaseOrder[index] = value;
          rebuildReadySimulation();
        },
      ),
    );
  });

  if (!arrowEntries.length && !phases.length) {
    const empty = document.createElement("p");
    empty.className = "control-intro";
    empty.textContent = "このステージに変更できる設定はありません。";
    elements.editor.append(empty);
  }
}

function statusText() {
  if (simulation.status === "ready") return "設定を選んで、車を流してみよう。";
  if (simulation.status === "running" && timerId === null) return "一時停止中。再生すると続きから動きます。";
  if (simulation.status === "running") return "シミュレーション中…車の流れを観察しよう。";
  if (simulation.status === "crashed") return "衝突発生。進路や信号の順番を見直そう。";
  if (simulation.status === "jammed") return "時間切れ。もっと短い流れを探してみよう。";
  return `クリア！ ${simulation.turn}ターンですべての車が通過しました。`;
}

function render() {
  elements.turn.textContent = String(simulation.turn).padStart(2, "0");
  elements.status.textContent = statusText();
  elements.play.disabled =
    timerId !== null ||
    ["cleared", "crashed", "jammed"].includes(simulation.status);
  elements.pause.disabled = timerId === null;
  renderBoard();
  renderControls();
}

function showResult() {
  const cleared = simulation.status === "cleared";
  elements.overlay.hidden = false;
  elements.resultIcon.textContent = cleared ? "✓" : "!";
  elements.resultIcon.style.background = cleared ? "#76c9a4" : "#ed6a5a";
  elements.resultLabel.textContent = cleared
    ? "JUNCTION CLEAR"
    : simulation.status === "crashed"
      ? "COLLISION"
      : "TIME OVER";
  elements.resultTitle.textContent = cleared
    ? "交差点、開通！"
    : simulation.status === "crashed"
      ? "ぶつかってしまった"
      : "流れが止まった";
  elements.resultDetail.textContent = cleared
    ? `${simulation.turn}ターンですべての車が出口へ到達しました。`
    : "設定を少し変えて、もう一度試してみましょう。";
  elements.next.textContent =
    cleared && activeStageIndex < STAGES.length - 1
      ? "次のステージ"
      : cleared
        ? "最初から遊ぶ"
        : "設定に戻る";

  if (cleared) {
    clearedStageIds.add(stage().id);
    localStorage.setItem(
      "junction-flow-cleared",
      JSON.stringify([...clearedStageIds]),
    );
    renderStageList();
  }
}

function hideResult() {
  elements.overlay.hidden = true;
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function tick() {
  simulation = stepSimulation(simulation);
  render();
  if (["cleared", "crashed", "jammed"].includes(simulation.status)) {
    stopTimer();
    render();
    showResult();
  }
}

function play() {
  if (timerId !== null) return;
  tick();
  if (simulation.status === "running") {
    timerId = window.setInterval(tick, TICK_MS);
    render();
  }
}

function pause() {
  stopTimer();
  render();
}

function reset() {
  stopTimer();
  simulation = createSimulation(stage(), controls);
  hideResult();
  render();
}

function loadStage(index) {
  stopTimer();
  activeStageIndex = (index + STAGES.length) % STAGES.length;
  controls = createDefaultControls(stage());
  simulation = createSimulation(stage(), controls);
  elements.stageKicker.textContent = `STAGE ${String(activeStageIndex + 1).padStart(2, "0")}`;
  elements.stageTitle.textContent = stage().title;
  elements.instruction.textContent = stage().instruction;
  elements.tip.textContent = stage().tip;
  hideResult();
  renderStageList();
  render();
}

elements.play.addEventListener("click", play);
elements.pause.addEventListener("click", pause);
elements.reset.addEventListener("click", reset);
elements.next.addEventListener("click", () => {
  if (simulation.status === "cleared") {
    loadStage(
      activeStageIndex < STAGES.length - 1 ? activeStageIndex + 1 : 0,
    );
  } else {
    reset();
  }
});

loadStage(0);
