const DIRECTIONS = ["north", "east", "south", "west"];
const DELTAS = {
  north: [-1, 0],
  east: [0, 1],
  south: [1, 0],
  west: [0, -1],
};

function cellKey([row, column]) {
  return `${row},${column}`;
}

function copyControls(controls = {}) {
  return {
    routes: Object.fromEntries(
      Object.entries(controls.routes ?? {}).map(([key, routes]) => [
        key,
        { ...routes },
      ]),
    ),
    signalCycles: Object.fromEntries(
      Object.entries(controls.signalCycles ?? {}).map(([key, cycle]) => [
        key,
        [...cycle],
      ]),
    ),
  };
}

function mergeControls(defaults, overrides = {}) {
  const merged = copyControls(defaults);
  for (const [key, routes] of Object.entries(overrides.routes ?? {})) {
    merged.routes[key] = { ...(merged.routes[key] ?? {}), ...routes };
  }
  for (const [key, cycle] of Object.entries(overrides.signalCycles ?? {})) {
    merged.signalCycles[key] = [...cycle];
  }
  return merged;
}

function isInside(stage, [row, column]) {
  return (
    row >= 0 &&
    column >= 0 &&
    row < stage.size &&
    column < stage.size
  );
}

function isRoad(stage, cell) {
  return isInside(stage, cell) && stage.grid[cell[0]][cell[1]] !== ".";
}

function axisFor(direction) {
  return direction === "north" || direction === "south"
    ? "vertical"
    : "horizontal";
}

function exitAt(stage, cell) {
  return stage.exits.find((exit) =>
    exit.cell[0] === cell[0] && exit.cell[1] === cell[1]
  );
}

export function turnDirection(direction, turn = "straight") {
  const index = DIRECTIONS.indexOf(direction);
  if (index < 0) throw new Error(`Unknown direction: ${direction}`);
  const offset = turn === "right" ? 1 : turn === "left" ? -1 : 0;
  return DIRECTIONS[(index + offset + DIRECTIONS.length) % DIRECTIONS.length];
}

export function createDefaultControls(stage) {
  return copyControls(stage.controls);
}

export function createSimulation(stage, controls = {}) {
  return {
    stage,
    controls: mergeControls(stage.controls, controls),
    turn: 0,
    status: "ready",
    reason: null,
    vehicles: stage.vehicles.map((vehicle) => ({
      ...vehicle,
      cell: [...vehicle.start],
      direction: vehicle.direction,
      exited: false,
    })),
  };
}

function proposalFor(vehicle, state) {
  if (vehicle.exited) return { type: "stay", vehicle };

  const currentKey = cellKey(vehicle.cell);
  const currentTile = state.stage.grid[vehicle.cell[0]][vehicle.cell[1]];
  const instruction =
    currentTile === "+" || currentTile === "S"
      ? state.controls.routes[currentKey]?.[vehicle.color] ?? "straight"
      : "straight";
  const direction = turnDirection(vehicle.direction, instruction);
  const delta = DELTAS[direction];
  const destination = [
    vehicle.cell[0] + delta[0],
    vehicle.cell[1] + delta[1],
  ];

  if (!isRoad(state.stage, destination)) {
    return { type: "fail", vehicle, direction, reason: "derailed" };
  }

  const destinationKey = cellKey(destination);
  const destinationTile =
    state.stage.grid[destination[0]][destination[1]];
  if (destinationTile === "S") {
    const cycle = state.controls.signalCycles[destinationKey] ?? [];
    const phase = cycle[state.turn % cycle.length];
    if (!phase || phase !== axisFor(direction)) {
      return { type: "stay", vehicle };
    }
  }

  const destinationExit = exitAt(state.stage, destination);
  if (
    destinationExit &&
    (destinationExit.id !== vehicle.exitId ||
      destinationExit.color !== vehicle.color)
  ) {
    return {
      type: "fail",
      vehicle,
      direction,
      destination,
      reason: "wrong-exit",
    };
  }

  return {
    type: "move",
    vehicle,
    direction,
    destination,
    exits: Boolean(destinationExit),
  };
}

function proposalsCrash(proposals, vehicles) {
  const moving = proposals
    .map((proposal, index) => ({ ...proposal, index }))
    .filter((proposal) => proposal.type === "move");
  const destinations = new Map();

  for (const proposal of moving) {
    const key = cellKey(proposal.destination);
    destinations.set(key, (destinations.get(key) ?? 0) + 1);
  }
  if ([...destinations.values()].some((count) => count > 1)) return true;

  return moving.some((proposal) =>
    moving.some((other) =>
      proposal.index !== other.index &&
      cellKey(proposal.destination) === cellKey(vehicles[other.index].cell) &&
      cellKey(other.destination) === cellKey(vehicles[proposal.index].cell)
    )
  );
}

export function stepSimulation(state) {
  if (!["ready", "running"].includes(state.status)) return state;

  const rawProposals = state.vehicles.map((vehicle) =>
    proposalFor(vehicle, state)
  );
  const crashed = proposalsCrash(rawProposals, state.vehicles);
  const failedProposal = rawProposals.find(({ type }) => type === "fail");
  const occupied = new Set(
    state.vehicles
      .filter((vehicle) => !vehicle.exited)
      .map((vehicle) => cellKey(vehicle.cell)),
  );
  const proposals = rawProposals.map((proposal) =>
    proposal.type === "move" &&
    occupied.has(cellKey(proposal.destination))
      ? { type: "stay", vehicle: proposal.vehicle }
      : proposal
  );

  const vehicles = state.vehicles.map((vehicle, index) => {
    const proposal = proposals[index];
    if (proposal.type !== "move") return { ...vehicle };
    return {
      ...vehicle,
      cell: [...proposal.destination],
      direction: proposal.direction,
      exited: proposal.exits,
    };
  });
  const turn = state.turn + 1;
  const cleared = vehicles.every((vehicle) => vehicle.exited);
  const timeOver = turn >= state.stage.maxTurns;

  return {
    ...state,
    turn,
    vehicles,
    status: crashed
      ? "crashed"
      : failedProposal
        ? "failed"
        : cleared
          ? "cleared"
          : timeOver
            ? "failed"
            : "running",
    reason: crashed
      ? "collision"
      : failedProposal?.reason ??
        (timeOver ? "time-over" : null),
  };
}

export function signalPhaseAt(state, key) {
  const cycle = state.controls.signalCycles[key] ?? [];
  return cycle.length ? cycle[state.turn % cycle.length] : null;
}
