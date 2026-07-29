import test from "node:test";
import assert from "node:assert/strict";
import { STAGES } from "../src/stages.js";
import { createSimulation, stepSimulation } from "../src/engine.js";

test("the game defines four distinct stages", () => {
  assert.equal(STAGES.length, 4);
  assert.equal(new Set(STAGES.map((stage) => stage.id)).size, 4);
});

test("each stage has Japanese UI metadata and puzzle fields", () => {
  for (const stage of STAGES) {
    assert.match(stage.title, /^[^\x00-\x7F]+$/);
    assert.equal(typeof stage.instruction, "string");
    assert.ok(stage.instruction.length > 0);
    assert.equal(typeof stage.tip, "string");
    assert.ok(stage.tip.length > 0);
    for (const key of ["controls", "vehicles", "signals", "maxTurns", "solution"]) {
      assert.ok(stage[key] !== undefined, `${stage.id} missing ${key}`);
    }
  }
});

test("every listed phase controls at least one signal", () => {
  for (const stage of STAGES) {
    for (const phase of stage.controls?.phaseOrder ?? []) {
      assert.ok(stage.signals.some((signal) => signal.phase === phase), `${stage.id} phase ${phase} is unused`);
    }
  }
});

test("mixed-turns wrong arrow cannot clear", () => {
  const stage = STAGES.find((item) => item.id === "mixed-turns");
  let state = createSimulation(stage, { ...stage.solution, arrows: { turner: "right" } });
  while (state.status === "ready" || state.status === "running") state = stepSimulation(state);
  assert.notEqual(state.status, "cleared");
});

test("rush-hour vehicles share a central crossing and require phase order", () => {
  const stage = STAGES.find((item) => item.id === "rush-hour");
  const paths = stage.vehicles.map((vehicle) => vehicle.path);
  const common = paths[0].filter((point) => paths.every((path) => path.some((p) => p[0] === point[0] && p[1] === point[1])));
  assert.ok(common.length > 0);
  let state = createSimulation(stage, { phaseOrder: ["phase-1", "phase-1", "phase-1"] });
  while (state.status === "ready" || state.status === "running") state = stepSimulation(state);
  assert.notEqual(state.status, "cleared");
});

test("crossing requires the listed north-south-first order", () => {
  const stage = STAGES.find((item) => item.id === "crossing");
  let state = createSimulation(stage, stage.solution);
  while (state.status === "ready" || state.status === "running") state = stepSimulation(state);
  assert.equal(state.status, "cleared");
  state = createSimulation(stage, { phaseOrder: ["east-west", "north-south"] });
  while (state.status === "ready" || state.status === "running") state = stepSimulation(state);
  assert.notEqual(state.status, "cleared");
});

for (const stage of STAGES) {
  test(`${stage.id} has a verified solution`, () => {
    let state = createSimulation(stage, stage.solution);
    while (state.status === "ready" || state.status === "running") state = stepSimulation(state);
    assert.equal(state.status, "cleared");
  });
}
