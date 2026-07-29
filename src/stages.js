// Four compact, deterministic traffic puzzles.
export const STAGES = [
  {
    id: "first-turn",
    title: "最初の曲がり角",
    instruction: "各車の矢印分岐を選び、交差点を安全に通過させます。",
    tip: "互いに進路が重ならない分岐を選びましょう。",
    vehicles: [
      { id: "car-a", portals: { entry: [6.5, 38], exit: [38, 6.5] }, branchId: "a-turn", defaultBranch: "straight", branches: { straight: [[0, 1], [1, 1], [2, 1]], turn: [[0, 1], [0, 0], [1, 0]] } },
      { id: "car-b", portals: { entry: [62, 93.5], exit: [62, 6.5] }, branchId: "b-turn", defaultBranch: "straight", branches: { straight: [[2, 3], [2, 2], [2, 1]], turn: [[2, 3], [3, 3], [3, 2]] } },
    ],
    signals: [],
    controls: { arrows: { "a-turn": ["straight", "turn"], "b-turn": ["straight", "turn"] } },
    maxTurns: 10,
    solution: { arrows: { "a-turn": "turn", "b-turn": "straight" } },
  },
  {
    id: "crossing",
    title: "交差点",
    instruction: "南北・東西の信号を順番に青へ切り替えます。",
    tip: "南北を先に青にすると渋滞を避けられます。",
    vehicles: [
      { id: "north", portals: { entry: [50, 6.5], exit: [50, 93.5] }, path: [[1, 0], [1, 1], [1, 2], [1, 3]] },
      { id: "west", portals: { entry: [6.5, 50], exit: [93.5, 50] }, path: [[0, 1], [1, 1], [2, 1]] },
    ],
    signals: [
      { id: "ns", phase: "north-south", vehicleIds: ["north"], stopIndex: 1 },
      { id: "ew", phase: "east-west", vehicleIds: ["west"], stopIndex: 1 },
    ],
    controls: { phaseOrder: ["north-south", "east-west"] },
    phaseDuration: 1,
    maxTurns: 6,
    solution: { phaseOrder: ["north-south", "east-west"] },
  },
  {
    id: "mixed-turns",
    title: "混合ターン",
    instruction: "分岐を選び、青信号のフェーズに合わせて進みます。",
    tip: "曲がる車のフェーズを最初に設定します。",
    vehicles: [
      { id: "turner", portals: { entry: [13, 93.5], exit: [93.5, 50] }, branchId: "turner", defaultBranch: "left", branches: { left: [[0, 2], [0, 1], [1, 1]], right: [[0, 2], [1, 2], [2, 1], [3, 1]] } },
      { id: "runner", portals: { entry: [75, 6.5], exit: [75, 93.5] }, path: [[3, 0], [3, 1], [3, 2]] },
    ],
    signals: [
      { id: "mix", phase: "turn-phase", vehicleIds: ["turner"], stopIndex: 1 },
      { id: "run", phase: "run-phase", vehicleIds: ["runner"], stopIndex: 1 },
    ],
    controls: { arrows: { turner: ["left", "right"] }, phaseOrder: ["turn-phase", "run-phase"] },
    phaseDuration: 2,
    maxTurns: 5,
    solution: { arrows: { turner: "left" }, phaseOrder: ["turn-phase", "run-phase"] },
  },
  {
    id: "rush-hour",
    title: "ラッシュアワー",
    instruction: "3つの信号フェーズを正しい順番で処理します。",
    tip: "3台を一台ずつ順番に通過させましょう。",
    vehicles: [
      { id: "r1", portals: { entry: [6.5, 50], exit: [93.5, 50] }, path: [[0, 2], [1, 2], [2, 2]] },
      { id: "r2", portals: { entry: [50, 6.5], exit: [50, 93.5] }, path: [[1, 0], [1, 1], [1, 2]] },
      { id: "r3", portals: { entry: [93.5, 87], exit: [6.5, 50] }, path: [[2, 4], [1, 4], [1, 2], [0, 2]] },
    ],
    signals: [
      { id: "p1", phase: "phase-1", vehicleIds: ["r1"], stopIndex: 1 },
      { id: "p2", phase: "phase-2", vehicleIds: ["r2"], stopIndex: 1 },
      { id: "p3", phase: "phase-3", vehicleIds: ["r3"], stopIndex: 1 },
    ],
    controls: { phaseOrder: ["phase-1", "phase-2", "phase-3"] },
    phaseDuration: 1,
    maxTurns: 8,
    solution: { phaseOrder: ["phase-1", "phase-2", "phase-3"] },
  },
];

export default STAGES;
