import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, validateOutputDirectory } from "../scripts/build.js";

test("build output validation rejects protected and sibling directories", () => {
  const root = resolve("project");

  assert.throws(() => validateOutputDirectory(root, root));
  assert.throws(() => validateOutputDirectory(root, resolve(root, "src")));
  assert.throws(() => validateOutputDirectory(root, resolve("project-copy")));
  assert.doesNotThrow(() =>
    validateOutputDirectory(root, resolve(root, "tmp", "junction-flow-build-safe")),
  );
  assert.doesNotThrow(() =>
    validateOutputDirectory(root, resolve(root, "dist")),
  );
});

test("the build creates a deployable static site", async () => {
  await mkdir(resolve("tmp"), { recursive: true });
  const output = await mkdtemp(resolve("tmp", "junction-flow-build-"));

  try {
    await build(output);
    await access(resolve(output, "index.html"));
    await access(resolve(output, "styles.css"));
    await access(resolve(output, "src", "app.js"));
    await access(resolve(output, "src", "engine.js"));
    await access(resolve(output, "src", "stages.js"));
    await access(resolve(output, "server", "index.js"));
    const html = await readFile(resolve(output, "index.html"), "utf8");
    assert.match(html, /Junction Flow/);

    const worker = await import(
      `${pathToFileURL(resolve(output, "server", "index.js")).href}?test=${Date.now()}`
    );
    const response = await worker.default.fetch(
      new Request("https://junction-flow.test/"),
    );
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Junction Flow/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
