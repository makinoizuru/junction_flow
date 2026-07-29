import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultControls,
  createSimulation,
  stepSimulation,
  turnDirection,
} from "../src/engine.js";

function stage(overrides = {}) {
  return {
    size: 5,
    grid: [
      "..#..",
      "..#..",
      "##+##",
      "..#..",
      "..#..",
    ],
    vehicles: [
      {
        id: "red-car",
        color: "red",
        start: [2, 0],
        direction: "east",
        exitId: "red-exit",
      },
    ],
    exits: [{ id: "red-exit", color: "red", cell: [2, 4] }],
    controls: {
      routes: { "2,2": { red: "straight" } },
      signalCycles: {},
    },
    maxTurns: 12,
    ...overrides,
  };
}

function runToEnd(current) {
  while (current.status === "ready" || current.status === "running") {
    current = stepSimulation(current);
  }
  return current;
}

test("relative turns rotate only to orthogonal directions", () => {
  assert.equal(turnDirection("north", "right"), "east");
  assert.equal(turnDirection("north", "left"), "west");
  assert.equal(turnDirection("west", "straight"), "west");
});

test("default controls are copied from the stage", () => {
  const currentStage = stage({
    controls: {
      routes: { "2,2": { red: "left", blue: "right" } },
      signalCycles: {
        "2,2": ["vertical", "horizontal", "horizontal", "vertical"],
      },
    },
  });

  const controls = createDefaultControls(currentStage);
  assert.deepEqual(controls, currentStage.controls);
  controls.routes["2,2"].red = "right";
  assert.equal(currentStage.controls.routes["2,2"].red, "left");
});

test("a vehicle advances one grid cell per turn", () => {
  const next = stepSimulation(createSimulation(stage(), {}));
  assert.deepEqual(next.vehicles[0].cell, [2, 1]);
});

test("a color-specific intersection instruction turns the vehicle", () => {
  let current = createSimulation(stage(), {
    routes: { "2,2": { red: "left" } },
  });
  current = stepSimulation(stepSimulation(current));
  current = stepSimulation(current);

  assert.equal(current.vehicles[0].direction, "north");
  assert.deepEqual(current.vehicles[0].cell, [1, 2]);
});

test("a signal cycle blocks the wrong axis and repeats", () => {
  const signalStage = stage({
    grid: [
      "..#..",
      "..#..",
      "##S##",
      "..#..",
      "..#..",
    ],
    controls: {
      routes: { "2,2": { red: "straight" } },
      signalCycles: {
        "2,2": ["horizontal", "vertical", "horizontal", "vertical"],
      },
    },
  });
  let current = createSimulation(signalStage, {});
  current = stepSimulation(current);
  current = stepSimulation(current);
  assert.deepEqual(current.vehicles[0].cell, [2, 1]);
  current = stepSimulation(current);
  assert.deepEqual(current.vehicles[0].cell, [2, 2]);
});

test("two vehicles entering the same cell collide", () => {
  const collisionStage = stage({
    vehicles: [
      { id: "red-car", color: "red", start: [2, 1], direction: "east", exitId: "red-exit" },
      { id: "blue-car", color: "blue", start: [1, 2], direction: "south", exitId: "blue-exit" },
    ],
    exits: [
      { id: "red-exit", color: "red", cell: [2, 4] },
      { id: "blue-exit", color: "blue", cell: [4, 2] },
    ],
  });

  const next = stepSimulation(createSimulation(collisionStage, {}));
  assert.equal(next.status, "crashed");
});

test("entering another color's exit fails the stage", () => {
  const wrongExitStage = stage({
    exits: [{ id: "blue-exit", color: "blue", cell: [2, 2] }],
  });
  const failed = runToEnd(createSimulation(wrongExitStage, {}));
  assert.equal(failed.status, "failed");
  assert.equal(failed.reason, "wrong-exit");
});

test("leaving the road or reaching a dead end fails the stage", () => {
  const failed = runToEnd(
    createSimulation(
      stage({
        grid: [
          ".....",
          ".....",
          "##+..",
          ".....",
          ".....",
        ],
        exits: [],
      }),
      {},
    ),
  );
  assert.equal(failed.status, "failed");
  assert.equal(failed.reason, "derailed");
});

test("reaching the matching colored exit clears the stage", () => {
  const cleared = runToEnd(createSimulation(stage(), {}));
  assert.equal(cleared.status, "cleared");
});
