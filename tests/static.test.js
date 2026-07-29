import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the page exposes the game board and core controls", async () => {
  const html = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );

  for (const id of [
    "game-board",
    "play-button",
    "pause-button",
    "reset-button",
    "stage-list",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("the page loads local stylesheet and module script", async () => {
  const html = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/src\/app\.js"/);
});
