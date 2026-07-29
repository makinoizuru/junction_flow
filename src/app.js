import {
  createDefaultControls,
  createSimulation,
  signalPhaseAt,
  stepSimulation,
} from "./engine.js";
import { STAGES } from "./stages.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CELL = 100;
const TICK_MS = 430;
const ROUTE_ORDER = ["straight", "right", "left"];
const ROUTE_GLYPHS = { straight: "↑", right: "↱", left: "↰" };
const ROUTE_LABELS = { straight: "直進", right: "右折", left: "左折" };
const PHASE_GLYPHS = { vertical: "↕", horizontal: "↔" };
const PHASE_LABELS = { vertical: "上下", horizontal: "左右" };
const COLOR_HEX = {
  blue: "#4f7cac",
  red: "#ee6a5b",
  green: "#58a878",
  amber: "#e7ad32",
  purple: "#8e6bb7",
};
const COLOR_LABELS = {
  blue: "青",
  red: "赤",
  green: "緑",
  amber: "黄",
  purple: "紫",
};

const elements = {
  board: document.querySelector("#game-board"),
  stageList: document.querySelector("#stage-list"),
  stageKicker: document.querySelector("#stage-kicker"),
  stageTitle: document.querySelector("#stage-title"),
  instruction: document.querySelector("#stage-instruction"),
  tip: document.querySelector("#stage-tip"),
  turn: document.querySelector("#turn-value"),
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
let clearedStageIds = new Set();

try {
  clearedStageIds = new Set(
    JSON.parse(localStorage.getItem("junction-flow-grid-cleared") ?? "[]"),
  );
} catch {
  clearedStageIds = new Set();
}

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

function colorFor(color) {
  return COLOR_HEX[color] ?? "#68736d";
}

function cellCenter([row, column]) {
  return [column * CELL + CELL / 2, row * CELL + CELL / 2];
}

function tileAt(currentStage, row, column) {
  if (
    row < 0 ||
    column < 0 ||
    row >= currentStage.size ||
    column >= currentStage.size
  ) {
    return ".";
  }
  return currentStage.grid[row][column];
}

function isRoad(currentStage, row, column) {
  return tileAt(currentStage, row, column) !== ".";
}

function appendBackdrop(currentStage) {
  elements.board.append(
    svgElement("rect", {
      width: currentStage.size * CELL,
      height: currentStage.size * CELL,
      fill: "#afc49c",
    }),
  );

  for (let index = 0; index <= currentStage.size; index += 1) {
    const coordinate = index * CELL;
    elements.board.append(
      svgElement("line", {
        x1: coordinate,
        y1: 0,
        x2: coordinate,
        y2: currentStage.size * CELL,
        stroke: "#809878",
        "stroke-width": 1,
        opacity: 0.42,
      }),
      svgElement("line", {
        x1: 0,
        y1: coordinate,
        x2: currentStage.size * CELL,
        y2: coordinate,
        stroke: "#809878",
        "stroke-width": 1,
        opacity: 0.42,
      }),
    );
  }
}

function appendRoads(currentStage) {
  currentStage.grid.forEach((rowText, row) => {
    [...rowText].forEach((tile, column) => {
      if (tile === ".") return;
      const x = column * CELL;
      const y = row * CELL;
      const roadParts = [
        [x + 28, y + 28, 44, 44],
        isRoad(currentStage, row - 1, column) && [x + 28, y, 44, 50],
        isRoad(currentStage, row + 1, column) && [x + 28, y + 50, 44, 50],
        isRoad(currentStage, row, column - 1) && [x, y + 28, 50, 44],
        isRoad(currentStage, row, column + 1) && [x + 50, y + 28, 50, 44],
      ].filter(Boolean);

      for (const [partX, partY, width, height] of roadParts) {
        elements.board.append(
          svgElement("rect", {
            x: partX,
            y: partY,
            width,
            height,
            fill: "#28312f",
          }),
        );
      }

      if (tile === "+" || tile === "S") {
        elements.board.append(
          svgElement("rect", {
            x: x + 23,
            y: y + 23,
            width: 54,
            height: 54,
            rx: 8,
            fill: tile === "S" ? "#1f2926" : "#35413e",
            stroke: tile === "S" ? "#f2cf4a" : "#d9dfda",
            "stroke-width": tile === "S" ? 5 : 2,
          }),
        );
      }
    });
  });

  currentStage.grid.forEach((rowText, row) => {
    [...rowText].forEach((tile, column) => {
      if (tile === ".") return;
      const [x, y] = cellCenter([row, column]);
      if (isRoad(currentStage, row, column + 1)) {
        elements.board.append(
          svgElement("line", {
            x1: x,
            y1: y,
            x2: x + CELL,
            y2: y,
            stroke: "#f2cf4a",
            "stroke-width": 3,
            "stroke-dasharray": "13 13",
            opacity: 0.72,
          }),
        );
      }
      if (isRoad(currentStage, row + 1, column)) {
        elements.board.append(
          svgElement("line", {
            x1: x,
            y1: y,
            x2: x,
            y2: y + CELL,
            stroke: "#f2cf4a",
            "stroke-width": 3,
            "stroke-dasharray": "13 13",
            opacity: 0.72,
          }),
        );
      }
    });
  });
}

function boundaryRotation([row, column], size) {
  if (row === 0) return 0;
  if (column === size - 1) return 90;
  if (row === size - 1) return 180;
  return 270;
}

function appendPortals(currentStage) {
  for (const exit of currentStage.exits) {
    const [x, y] = cellCenter(exit.cell);
    const group = svgElement("g", {
      transform: `translate(${x} ${y}) rotate(${boundaryRotation(exit.cell, currentStage.size)})`,
    });
    group.append(
      svgElement("rect", {
        x: -29,
        y: -20,
        width: 58,
        height: 40,
        rx: 8,
        fill: colorFor(exit.color),
        stroke: "#17201d",
        "stroke-width": 5,
      }),
      svgElement("text", {
        x: 0,
        y: 5,
        fill: "#fff",
        "font-size": 14,
        "font-weight": 1000,
        "text-anchor": "middle",
      }, "EXIT"),
    );
    elements.board.append(group);
  }

  for (const vehicle of currentStage.vehicles) {
    const [x, y] = cellCenter(vehicle.start);
    elements.board.append(
      svgElement("text", {
        x,
        y: y + 34,
        fill: "#fff",
        "font-size": 12,
        "font-weight": 1000,
        "text-anchor": "middle",
        stroke: "#17201d",
        "stroke-width": 4,
        "paint-order": "stroke",
      }, "IN"),
    );
  }
}

function activateControl(group, handler, label) {
  const editable = simulation.turn === 0 && timerId === null;
  group.setAttribute("role", "button");
  group.setAttribute("aria-label", label);
  group.setAttribute("aria-disabled", String(!editable));
  group.setAttribute("tabindex", editable ? "0" : "-1");
  group.classList.toggle("is-locked", !editable);
  if (!editable) return;

  group.addEventListener("click", handler);
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handler();
    }
  });
}

function rebuildReadySimulation(focusKey = null) {
  stopTimer();
  simulation = createSimulation(stage(), controls);
  hideResult();
  render();
  if (focusKey) {
    elements.board
      .querySelector(`[data-control-key="${focusKey}"]`)
      ?.focus();
  }
}

function appendRouteControls(currentStage) {
  const colors = [...new Set(currentStage.vehicles.map(({ color }) => color))];
  currentStage.grid.forEach((rowText, row) => {
    [...rowText].forEach((tile, column) => {
      if (tile !== "+" && tile !== "S") return;
      const key = `${row},${column}`;
      const totalWidth = colors.length * 25;
      const startX = column * CELL + (CELL - totalWidth) / 2 + 12.5;
      const y = row * CELL + 14;

      colors.forEach((color, index) => {
        const route = controls.routes[key]?.[color] ?? "straight";
        const group = svgElement("g", {
          class: "route-control",
          transform: `translate(${startX + index * 25} ${y})`,
          "data-control-key": `route-${key}-${color}`,
        });
        group.append(
          svgElement("circle", {
            class: "control-touch-target",
            cx: 0,
            cy: 0,
            r: 20,
            fill: "transparent",
          }),
          svgElement("circle", {
            class: "control-hit",
            cx: 0,
            cy: 0,
            r: 13,
            fill: colorFor(color),
            stroke: "#17201d",
            "stroke-width": 3,
          }),
          svgElement("text", {
            x: 0,
            y: 5,
            fill: "#fff",
            "font-size": 15,
            "font-weight": 1000,
            "text-anchor": "middle",
            "pointer-events": "none",
          }, ROUTE_GLYPHS[route]),
          svgElement(
            "title",
            {},
            `${COLOR_LABELS[color] ?? color}：${ROUTE_LABELS[route]}`,
          ),
        );
        activateControl(
          group,
          () => {
            const nextIndex =
              (ROUTE_ORDER.indexOf(route) + 1) % ROUTE_ORDER.length;
            controls.routes[key][color] = ROUTE_ORDER[nextIndex];
            rebuildReadySimulation(`route-${key}-${color}`);
          },
          `${COLOR_LABELS[color] ?? color}の進路：${ROUTE_LABELS[route]}。クリックで切り替え`,
        );
        elements.board.append(group);
      });
    });
  });
}

function appendSignalControls(currentStage) {
  currentStage.grid.forEach((rowText, row) => {
    [...rowText].forEach((tile, column) => {
      if (tile !== "S") return;
      const key = `${row},${column}`;
      const cycle = controls.signalCycles[key];
      const startX = column * CELL + 14;
      const y = row * CELL + 77;

      cycle.forEach((phase, index) => {
        const active = simulation.turn % cycle.length === index;
        const group = svgElement("g", {
          class: "signal-slot",
          transform: `translate(${startX + index * 19} ${y})`,
          "data-control-key": `signal-${key}-${index}`,
        });
        group.append(
          svgElement("rect", {
            class: "control-touch-target",
            x: -2,
            y: -4,
            width: 21,
            height: 25,
            rx: 6,
            fill: "transparent",
          }),
          svgElement("rect", {
            class: "control-hit",
            x: 0,
            y: 0,
            width: 17,
            height: 17,
            rx: 4,
            fill: phase === "vertical" ? "#72c5a5" : "#f2cf4a",
            stroke: active ? "#fff" : "#17201d",
            "stroke-width": active ? 4 : 2,
          }),
          svgElement("text", {
            x: 8.5,
            y: 12.5,
            fill: "#17201d",
            "font-size": 11,
            "font-weight": 1000,
            "text-anchor": "middle",
            "pointer-events": "none",
          }, PHASE_GLYPHS[phase]),
          svgElement(
            "title",
            {},
            `${index + 1}ターン目：${PHASE_LABELS[phase]}`,
          ),
        );
        activateControl(
          group,
          () => {
            cycle[index] =
              phase === "vertical" ? "horizontal" : "vertical";
            rebuildReadySimulation(`signal-${key}-${index}`);
          },
          `信号サイクル${index + 1}：${PHASE_LABELS[phase]}。クリックで切り替え`,
        );
        elements.board.append(group);
      });
    });
  });
}

function vehicleAngle(direction) {
  return { north: -90, east: 0, south: 90, west: 180 }[direction] ?? 0;
}

function appendVehicles() {
  simulation.vehicles.forEach((vehicle) => {
    if (vehicle.exited) return;
    const [x, y] = cellCenter(vehicle.cell);
    const group = svgElement("g", {
      transform: `translate(${x} ${y}) rotate(${vehicleAngle(vehicle.direction)})`,
    });
    group.append(
      svgElement("rect", {
        x: -24,
        y: -14,
        width: 48,
        height: 28,
        rx: 8,
        fill: colorFor(vehicle.color),
        stroke: "#17201d",
        "stroke-width": 5,
      }),
      svgElement("rect", {
        x: 0,
        y: -10,
        width: 15,
        height: 20,
        rx: 3,
        fill: "#d9edf0",
        stroke: "#17201d",
        "stroke-width": 2,
      }),
    );
    elements.board.append(group);
  });
}

function renderBoard() {
  const currentStage = stage();
  elements.board.replaceChildren(
    svgElement(
      "title",
      { id: "board-title" },
      `${currentStage.title}のグリッド交通パズル`,
    ),
    svgElement(
      "desc",
      { id: "board-description" },
      "色付き矢印と信号サイクルを直接クリックし、車を同じ色の出口へ導きます。",
    ),
  );
  appendBackdrop(currentStage);
  appendRoads(currentStage);
  appendPortals(currentStage);
  appendRouteControls(currentStage);
  appendSignalControls(currentStage);
  appendVehicles();
}

function renderStageList() {
  elements.stageList.replaceChildren();
  STAGES.forEach((item, index) => {
    const button = document.createElement("button");
    const cleared = clearedStageIds.has(item.id);
    button.type = "button";
    button.className = `stage-button${cleared ? " is-cleared" : ""}`;
    button.setAttribute("aria-current", String(index === activeStageIndex));

    const number = document.createElement("span");
    number.className = "stage-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.className = "stage-name";
    name.textContent = item.title;
    const check = document.createElement("span");
    check.className = "stage-check";
    check.textContent = "✓";
    check.setAttribute(cleared ? "aria-label" : "aria-hidden", cleared ? "クリア済み" : "true");
    button.append(number, name, check);
    button.addEventListener("click", () => loadStage(index));
    elements.stageList.append(button);
  });
}

function statusText() {
  if (simulation.status === "ready") {
    return "交差点の色付き矢印と信号スロットを直接クリックしてください。";
  }
  if (simulation.status === "running" && timerId === null) {
    return "一時停止中です。「流してみる」で再開します。";
  }
  if (simulation.status === "running") {
    return "シミュレーション中…信号サイクルは4ターンごとに繰り返します。";
  }
  if (simulation.status === "cleared") {
    return `クリア！ ${simulation.turn}ターンで全車が出口へ到着しました。`;
  }
  const reasons = {
    collision: "車同士が衝突しました。",
    "wrong-exit": "違う色の出口へ入ってしまいました。",
    derailed: "道路から外れ、出口へ到達できませんでした。",
    "time-over": "制限ターン内に出口へ到達できませんでした。",
  };
  return reasons[simulation.reason] ?? "ルートが成立しませんでした。";
}

function render() {
  const currentStage = stage();
  elements.stageKicker.textContent =
    `STAGE ${String(activeStageIndex + 1).padStart(2, "0")}`;
  elements.stageTitle.textContent = currentStage.title;
  elements.instruction.textContent = currentStage.instruction;
  elements.tip.textContent = currentStage.tip;
  elements.turn.textContent = String(simulation.turn).padStart(2, "0");
  elements.status.textContent = statusText();
  elements.play.disabled =
    timerId !== null || !["ready", "running"].includes(simulation.status);
  elements.pause.disabled = timerId === null;
  renderStageList();
  renderBoard();
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function hideResult() {
  elements.overlay.hidden = true;
}

function showResult() {
  const cleared = simulation.status === "cleared";
  elements.overlay.hidden = false;
  elements.resultIcon.textContent = cleared ? "✓" : "!";
  elements.resultIcon.style.background = cleared ? "#72c5a5" : "#ee6a5b";
  elements.resultLabel.textContent = cleared ? "GRID CLEAR" : "GAME OVER";
  elements.resultTitle.textContent = cleared
    ? "全車、到着！"
    : simulation.reason === "collision"
      ? "交差点で衝突"
      : "出口へ届かなかった";
  elements.resultDetail.textContent = cleared
    ? `${simulation.turn}ターンで、すべての車が同じ色の出口へ到着しました。`
    : statusText();
  elements.next.textContent = cleared
    ? activeStageIndex < STAGES.length - 1
      ? "次のステージ"
      : "最初から遊ぶ"
    : "設定に戻る";

  if (cleared) {
    clearedStageIds.add(stage().id);
    localStorage.setItem(
      "junction-flow-grid-cleared",
      JSON.stringify([...clearedStageIds]),
    );
    renderStageList();
  }
}

function advance() {
  simulation = stepSimulation(simulation);
  if (!["ready", "running"].includes(simulation.status)) {
    stopTimer();
    render();
    showResult();
    return;
  }
  render();
}

function play() {
  if (!["ready", "running"].includes(simulation.status) || timerId !== null) {
    return;
  }
  hideResult();
  advance();
  if (simulation.status === "running") {
    timerId = window.setInterval(advance, TICK_MS);
    render();
  }
}

function reset() {
  stopTimer();
  simulation = createSimulation(stage(), controls);
  hideResult();
  render();
}

function loadStage(index) {
  activeStageIndex = index;
  controls = createDefaultControls(stage());
  reset();
}

elements.play.addEventListener("click", play);
elements.pause.addEventListener("click", () => {
  stopTimer();
  render();
});
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
