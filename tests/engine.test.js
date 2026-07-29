import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultControls,
  createSimulation,
  stepSimulation,
} from "../src/engine.js";

test("default phase controls begin with one direction repeated", () => {
  const stage = {
    controls: {
      arrows: { route: ["straight", "turn"] },
      phaseOrder: ["north-south", "east-west"],
    },
  };

  assert.deepEqual(createDefaultControls(stage), {
    arrows: { route: "straight" },
    signals: {},
    phaseOrder: ["north-south", "north-south"],
  });
});

test("a vehicle advances one path point per turn", () => {
  const stage = {
    maxTurns: 20,
    signals: [],
    vehicles: [{ id: "a", path: [[0, 0], [1, 0], [2, 0]] }],
  };

  const next = stepSimulation(createSimulation(stage, {}));

  assert.equal(next.vehicles[0].pathIndex, 1);
});

test("a red signal stops a vehicle before its stop index", () => {
  const stage = {
    maxTurns: 20,
    signals: [{ id: "s", vehicleIds: ["a"], stopIndex: 1 }],
    vehicles: [{ id: "a", path: [[0, 0], [1, 0], [2, 0]] }],
  };

  const next = stepSimulation(
    createSimulation(stage, { signals: { s: false } }),
  );

  assert.equal(next.vehicles[0].pathIndex, 0);
});

test("a vehicle waits when its next point is occupied", () => {
  const stage = {
    maxTurns: 20,
    signals: [],
    vehicles: [
      { id: "front", path: [[1, 0], [2, 0], [3, 0]] },
      { id: "back", path: [[0, 0], [1, 0], [2, 0]] },
    ],
  };

  const next = stepSimulation(createSimulation(stage, {}));

  assert.equal(next.vehicles[1].pathIndex, 0);
});

test("two vehicles entering the same point collide", () => {
  const stage = {
    maxTurns: 20,
    signals: [],
    vehicles: [
      { id: "a", path: [[0, 1], [1, 1]] },
      { id: "b", path: [[1, 0], [1, 1]] },
    ],
  };

  const next = stepSimulation(createSimulation(stage, {}));

  assert.equal(next.status, "crashed");
});

test("all exited vehicles clear the stage", () => {
  const stage = {
    maxTurns: 20,
    signals: [],
    vehicles: [{ id: "a", path: [[0, 0], [1, 0]] }],
  };

  const next = stepSimulation(
    stepSimulation(createSimulation(stage, {})),
  );

  assert.equal(next.status, "cleared");
});
