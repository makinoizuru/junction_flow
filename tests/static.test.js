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

  assert.match(html, /href="\.\/styles\.css(?:\?v=[^"]+)?"/);
  assert.match(html, /src="\.\/src\/app\.js(?:\?v=[^"]+)?"/);
});

test("all browser entry modules share one cache-busting version", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
  ]);

  const stylesheetVersion = html.match(
    /href="\.\/styles\.css\?v=([^"]+)"/,
  )?.[1];
  const appVersion = html.match(
    /src="\.\/src\/app\.js\?v=([^"]+)"/,
  )?.[1];

  assert.ok(stylesheetVersion, "stylesheet URL must be versioned");
  assert.equal(appVersion, stylesheetVersion);
  assert.match(
    app,
    new RegExp(`from "\\./engine\\.js\\?v=${stylesheetVersion}"`),
  );
  assert.match(
    app,
    new RegExp(`from "\\./stages\\.js\\?v=${stylesheetVersion}"`),
  );
});
