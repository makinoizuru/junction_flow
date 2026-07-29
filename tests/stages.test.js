import test from "node:test";
import assert from "node:assert/strict";
import { STAGES } from "../src/stages.js";
import {
  createDefaultControls,
  createSimulation,
  stepSimulation,
} from "../src/engine.js";

function run(stage, controls) {
  let state = createSimulation(stage, controls);
  while (state.status === "ready" || state.status === "running") {
    state = stepSimulation(state);
  }
  return state;
}

test("the game defines four distinct 7x7 grid stages", () => {
  assert.equal(STAGES.length, 4);
  assert.equal(new Set(STAGES.map(({ id }) => id)).size, 4);
  for (const stage of STAGES) {
    assert.equal(stage.size, 7);
    assert.equal(stage.grid.length, 7);
    assert.ok(stage.grid.every((row) => row.length === 7));
    assert.ok(stage.grid.every((row) => /^[.#+S]+$/.test(row)));
  }
});

test("each stage has Japanese metadata and boundary portals", () => {
  for (const stage of STAGES) {
    assert.match(stage.title, /[^\x00-\x7F]/);
    assert.match(stage.instruction, /[^\x00-\x7F]/);
    assert.match(stage.tip, /[^\x00-\x7F]/);
    for (const vehicle of stage.vehicles) {
      const [row, column] = vehicle.start;
      assert.ok(row === 0 || column === 0 || row === 6 || column === 6);
      assert.notEqual(stage.grid[row][column], ".");
    }
    for (const exit of stage.exits) {
      const [row, column] = exit.cell;
      assert.ok(row === 0 || column === 0 || row === 6 || column === 6);
      assert.notEqual(stage.grid[row][column], ".");
    }
  }
});

test("every intersection has a route setting for every vehicle color", () => {
  for (const stage of STAGES) {
    const colors = [...new Set(stage.vehicles.map(({ color }) => color))];
    stage.grid.forEach((row, rowIndex) => {
      [...row].forEach((tile, columnIndex) => {
        if (tile !== "+" && tile !== "S") return;
        const settings = stage.controls.routes[`${rowIndex},${columnIndex}`];
        for (const color of colors) {
          assert.ok(settings?.[color], `${stage.id} missing ${color} route`);
        }
      });
    });
  }
});

test("every signal owns a four-turn vertical/horizontal cycle", () => {
  for (const stage of STAGES) {
    stage.grid.forEach((row, rowIndex) => {
      [...row].forEach((tile, columnIndex) => {
        if (tile !== "S") return;
        const cycle =
          stage.controls.signalCycles[`${rowIndex},${columnIndex}`];
        assert.equal(cycle.length, 4);
        assert.ok(
          cycle.every((phase) =>
            phase === "vertical" || phase === "horizontal"
          ),
        );
      });
    });
  }
});

for (const stage of STAGES) {
  test(`${stage.id} has a verified solution`, () => {
    assert.equal(run(stage, stage.solution).status, "cleared");
  });

  test(`${stage.id} does not clear with its initial controls`, () => {
    assert.notEqual(
      run(stage, createDefaultControls(stage)).status,
      "cleared",
    );
  });
}
