import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const dataSource = (await readFile(path.join(root, "src/data.js"), "utf8")).replaceAll("export const ", "const ");
const storageSource = (await readFile(path.join(root, "src/storage.js"), "utf8"))
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+"\.\/data\.js";\s*/m, "")
  .replaceAll("export function ", "function ");
const appSource = (await readFile(path.join(root, "src/app.js"), "utf8"))
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+"\.\/data\.js";\s*/m, "")
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+"\.\/storage\.js";\s*/m, "");

const bundle = `"use strict";\n\n${dataSource}\n\n${storageSource}\n\n${appSource}`;
await writeFile(path.join(dist, "app.js"), bundle);
await cp(path.join(root, "src/styles.css"), path.join(dist, "styles.css"));
await cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });

const indexSource = (await readFile(path.join(root, "index.html"), "utf8"))
  .replace('./src/styles.css', './styles.css')
  .replace('<script type="module" src="./src/app.js"></script>', '<script src="./app.js"></script>');
await writeFile(path.join(dist, "index.html"), indexSource);
await writeFile(path.join(dist, ".nojekyll"), "");

console.log("Built dist/ with index.html, styles.css, app.js and local dog images.");
