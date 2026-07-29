import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function validateOutputDirectory(rootDirectory, outputDirectory) {
  const root = resolve(rootDirectory);
  const output = resolve(outputDirectory);
  const relativeOutput = relative(root, output);
  const firstSegment = relativeOutput.split(/[\\/]/, 1)[0];
  const protectedSegments = new Set([
    ".git",
    ".openai",
    "docs",
    "scripts",
    "src",
    "tests",
  ]);

  if (
    !relativeOutput ||
    isAbsolute(relativeOutput) ||
    relativeOutput === ".." ||
    relativeOutput.startsWith(`..\\`) ||
    relativeOutput.startsWith("../") ||
    protectedSegments.has(firstSegment)
  ) {
    throw new Error("Build output must be a disposable directory inside the project.");
  }

  return output;
}

export async function build(outputDirectory = resolve(projectRoot, "dist")) {
  const output = validateOutputDirectory(projectRoot, outputDirectory);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(resolve(projectRoot, "index.html"), resolve(output, "index.html"));
  await cp(resolve(projectRoot, "styles.css"), resolve(output, "styles.css"));
  await cp(resolve(projectRoot, "src"), resolve(output, "src"), {
    recursive: true,
  });

  const assetPaths = [
    "index.html",
    "styles.css",
    "src/app.js",
    "src/engine.js",
    "src/stages.js",
  ];
  const assets = Object.fromEntries(
    await Promise.all(
      assetPaths.map(async (assetPath) => [
        `/${assetPath.replaceAll("\\", "/")}`,
        await readFile(resolve(projectRoot, assetPath), "utf8"),
      ]),
    ),
  );
  const workerSource = `
const FILES = ${JSON.stringify(assets)};
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const body = FILES[pathname];
    if (body === undefined) {
      return new Response("Not found", { status: 404 });
    }
    const extension = pathname.slice(pathname.lastIndexOf("."));
    return new Response(body, {
      headers: {
        "content-type": CONTENT_TYPES[extension] ?? "text/plain; charset=utf-8",
        "cache-control": pathname === "/index.html"
          ? "no-cache"
          : "public, max-age=3600"
      }
    });
  }
};
`.trimStart();

  await mkdir(resolve(output, "server"), { recursive: true });
  await writeFile(resolve(output, "server", "index.js"), workerSource, "utf8");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";

if (import.meta.url === invokedPath) {
  await build();
}
