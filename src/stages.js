const STRAIGHT = "straight";
const HORIZONTAL = "horizontal";
const VERTICAL = "vertical";

function routes(keys, colors) {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      Object.fromEntries(colors.map((color) => [color, STRAIGHT])),
    ]),
  );
}

export const STAGES = [
  {
    id: "first-turn",
    title: "色別ルート",
    instruction: "青い矢印を切り替え、青い車を同じ色の出口へ導きます。",
    tip: "青い車は東から交差点へ入ります。相対的な「左」を考えましょう。",
    size: 7,
    grid: [
      "...#...",
      "...#...",
      "...#...",
      "###+###",
      "...#...",
      "...#...",
      "...#...",
    ],
    vehicles: [
      { id: "blue-1", color: "blue", start: [3, 0], direction: "east", exitId: "blue-exit" },
    ],
    exits: [
      { id: "blue-exit", color: "blue", cell: [0, 3] },
      { id: "red-decoy", color: "red", cell: [3, 6] },
    ],
    controls: {
      routes: routes(["3,3"], ["blue"]),
      signalCycles: {},
    },
    solution: {
      routes: { "3,3": { blue: "left" } },
      signalCycles: {},
    },
    maxTurns: 10,
  },
  {
    id: "signal-cycle",
    title: "信号サイクル",
    instruction: "中央信号の4ターンサイクルを編集し、青と赤を順番に通します。",
    tip: "2台は同じターンに中央へ到着します。まず左右方向を通しましょう。",
    size: 7,
    grid: [
      "...#...",
      "...#...",
      "...#...",
      "###S###",
      "...#...",
      "...#...",
      "...#...",
    ],
    vehicles: [
      { id: "blue-1", color: "blue", start: [3, 0], direction: "east", exitId: "blue-exit" },
      { id: "red-1", color: "red", start: [0, 3], direction: "south", exitId: "red-exit" },
    ],
    exits: [
      { id: "blue-exit", color: "blue", cell: [3, 6] },
      { id: "red-exit", color: "red", cell: [6, 3] },
    ],
    controls: {
      routes: routes(["3,3"], ["blue", "red"]),
      signalCycles: {
        "3,3": [HORIZONTAL, HORIZONTAL, HORIZONTAL, HORIZONTAL],
      },
    },
    solution: {
      routes: routes(["3,3"], ["blue", "red"]),
      signalCycles: {
        "3,3": [HORIZONTAL, VERTICAL, HORIZONTAL, VERTICAL],
      },
    },
    maxTurns: 12,
  },
  {
    id: "mixed-grid",
    title: "分岐と信号",
    instruction: "色別の分岐と中央信号を組み合わせ、2台を別々の出口へ導きます。",
    tip: "青は上へ、赤は下段から中央へ上がって右へ曲がります。",
    size: 7,
    grid: [
      "...#...",
      "###+###",
      "...#...",
      "###S###",
      "...#...",
      "###+###",
      "...#...",
    ],
    vehicles: [
      { id: "blue-1", color: "blue", start: [1, 0], direction: "east", exitId: "blue-exit" },
      { id: "red-1", color: "red", start: [5, 0], direction: "east", exitId: "red-exit" },
    ],
    exits: [
      { id: "blue-exit", color: "blue", cell: [0, 3] },
      { id: "red-exit", color: "red", cell: [3, 6] },
      { id: "green-decoy-a", color: "green", cell: [1, 6] },
      { id: "green-decoy-b", color: "green", cell: [5, 6] },
    ],
    controls: {
      routes: routes(["1,3", "3,3", "5,3"], ["blue", "red"]),
      signalCycles: {
        "3,3": [HORIZONTAL, HORIZONTAL, HORIZONTAL, HORIZONTAL],
      },
    },
    solution: {
      routes: {
        "1,3": { blue: "left", red: STRAIGHT },
        "3,3": { blue: STRAIGHT, red: "right" },
        "5,3": { blue: STRAIGHT, red: "left" },
      },
      signalCycles: {
        "3,3": [VERTICAL, HORIZONTAL, HORIZONTAL, HORIZONTAL],
      },
    },
    maxTurns: 11,
  },
  {
    id: "rush-hour",
    title: "グリッドラッシュ",
    instruction: "3色のルートと2基の信号サイクルを調整し、混雑を解消します。",
    tip: "中央は緑→青→赤の順。下の信号で赤を1ターン待たせます。",
    size: 7,
    grid: [
      "...#...",
      "###+###",
      "...#...",
      "###S###",
      "...#...",
      "###S###",
      "...#...",
    ],
    vehicles: [
      { id: "blue-1", color: "blue", start: [1, 0], direction: "east", exitId: "blue-exit" },
      { id: "red-1", color: "red", start: [5, 0], direction: "east", exitId: "red-exit" },
      { id: "green-1", color: "green", start: [3, 0], direction: "east", exitId: "green-exit" },
    ],
    exits: [
      { id: "blue-exit", color: "blue", cell: [3, 6] },
      { id: "red-exit", color: "red", cell: [0, 3] },
      { id: "green-exit", color: "green", cell: [6, 3] },
    ],
    controls: {
      routes: routes(["1,3", "3,3", "5,3"], ["blue", "red", "green"]),
      signalCycles: {
        "3,3": [HORIZONTAL, HORIZONTAL, HORIZONTAL, HORIZONTAL],
        "5,3": [HORIZONTAL, HORIZONTAL, HORIZONTAL, HORIZONTAL],
      },
    },
    solution: {
      routes: {
        "1,3": { blue: "right", red: STRAIGHT, green: STRAIGHT },
        "3,3": { blue: "left", red: STRAIGHT, green: "right" },
        "5,3": { blue: STRAIGHT, red: "left", green: STRAIGHT },
      },
      signalCycles: {
        "3,3": [VERTICAL, VERTICAL, HORIZONTAL, VERTICAL],
        "5,3": [VERTICAL, HORIZONTAL, VERTICAL, VERTICAL],
      },
    },
    maxTurns: 16,
  },
];

export default STAGES;
