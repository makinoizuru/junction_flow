function copyControls(controls = {}) {
  return {
    arrows: { ...(controls.arrows ?? {}) },
    signals: { ...(controls.signals ?? {}) },
    phaseOrder: [...(controls.phaseOrder ?? [])],
  };
}

export function createDefaultControls(stage) {
  const phases = stage.controls?.phaseOrder ?? [];
  return {
    arrows: Object.fromEntries(
      Object.entries(stage.controls?.arrows ?? {}).map(([id, options]) => [
        id,
        options[0],
      ]),
    ),
    signals: { ...(stage.controls?.signals ?? {}) },
    phaseOrder: phases.map(() => phases[0]),
  };
}

export function resolveVehiclePath(vehicle, controls = {}) {
  if (!vehicle.branches || !vehicle.branchId) {
    return vehicle.path.map((point) => [...point]);
  }

  const selected =
    controls.arrows?.[vehicle.branchId] ?? vehicle.defaultBranch;
  return (vehicle.branches[selected] ?? vehicle.path).map((point) => [
    ...point,
  ]);
}

export function createSimulation(stage, controls = {}) {
  const safeControls = copyControls(controls);
  return {
    stage,
    controls: safeControls,
    turn: 0,
    status: "ready",
    vehicles: stage.vehicles.map((vehicle) => ({
      ...vehicle,
      path: resolveVehiclePath(vehicle, safeControls),
      pathIndex: 0,
      exited: false,
    })),
  };
}

export function isSignalGreen(signal, state) {
  if (signal.phase) {
    const order = state.controls.phaseOrder;
    if (!order.length) return false;
    const duration = state.stage.phaseDuration ?? 2;
    return order[Math.floor(state.turn / duration) % order.length] === signal.phase;
  }

  return state.controls.signals?.[signal.id] ?? true;
}

function isStoppedBySignal(vehicle, nextIndex, state) {
  return state.stage.signals.some(
    (signal) =>
      signal.vehicleIds.includes(vehicle.id) &&
      vehicle.pathIndex < signal.stopIndex &&
      nextIndex >= signal.stopIndex &&
      !isSignalGreen(signal, state),
  );
}

function pointKey(point) {
  return point.join(",");
}

export function stepSimulation(state) {
  if (state.status === "crashed" || state.status === "cleared" || state.status === "jammed") {
    return state;
  }

  const occupiedPoints = new Set(
    state.vehicles
      .filter((vehicle) => !vehicle.exited)
      .map((vehicle) => pointKey(getVehiclePoint(vehicle))),
  );

  const proposals = state.vehicles.map((vehicle) => {
    if (vehicle.exited) return { type: "stay", vehicle };

    const nextIndex = vehicle.pathIndex + 1;
    if (nextIndex >= vehicle.path.length) {
      return { type: "exit", vehicle };
    }
    if (isStoppedBySignal(vehicle, nextIndex, state)) {
      return { type: "stay", vehicle };
    }
    if (occupiedPoints.has(pointKey(vehicle.path[nextIndex]))) {
      return { type: "stay", vehicle };
    }

    return {
      type: "move",
      vehicle,
      nextIndex,
      destination: vehicle.path[nextIndex],
    };
  });

  const destinationCounts = new Map();
  for (const proposal of proposals) {
    if (proposal.type !== "move") continue;
    const key = pointKey(proposal.destination);
    destinationCounts.set(key, (destinationCounts.get(key) ?? 0) + 1);
  }

  const crashed = [...destinationCounts.values()].some((count) => count > 1);
  const vehicles = state.vehicles.map((vehicle, index) => {
    const proposal = proposals[index];
    if (proposal.type === "exit") return { ...vehicle, exited: true };
    if (proposal.type === "move") {
      return { ...vehicle, pathIndex: proposal.nextIndex };
    }
    return { ...vehicle };
  });
  const turn = state.turn + 1;
  const allExited = vehicles.every((vehicle) => vehicle.exited);

  return {
    ...state,
    turn,
    vehicles,
    status: crashed
      ? "crashed"
      : allExited
        ? "cleared"
        : turn >= state.stage.maxTurns
          ? "jammed"
          : "running",
  };
}

export function getVehiclePoint(vehicle) {
  return vehicle.path[Math.min(vehicle.pathIndex, vehicle.path.length - 1)];
}
