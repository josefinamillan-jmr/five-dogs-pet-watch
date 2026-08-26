import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "index.html",
  "src/app.js",
  "src/data.js",
  "src/storage.js",
  "src/styles.css",
  ".github/workflows/deploy.yml",
  "README.md",
];

for (const file of requiredFiles) {
  await stat(path.join(root, file));
}

const app = await readFile(path.join(root, "src/app.js"), "utf8");
const data = await readFile(path.join(root, "src/data.js"), "utf8");
const storage = await readFile(path.join(root, "src/storage.js"), "utf8");
const readme = await readFile(path.join(root, "README.md"), "utf8");

const expectations = [
  [app.includes('href="#/report"'), "report route"],
  [app.includes('href="#/publications"'), "publications route"],
  [app.includes('parts[0] === "sighting"'), "sighting route"],
  [app.includes("navigator.share"), "Web Share API"],
  [app.includes("3 * 1024 * 1024"), "3 MB image rule"],
  [app.includes("no se envió a un servidor"), "honest storage confirmation"],
  [storage.includes("localStorage"), "localStorage persistence"],
  [data.match(/id: "demo-/g)?.length === 5, "exactly five demo profiles"],
  [readme.includes("Day 2 requirements completed"), "Day 2 checklist"],
];

for (const [passed, label] of expectations) {
  if (!passed) throw new Error(`Verification failed: ${label}`);
}

const prohibited = /food|delivery|adopt|adopción|Necesita hogar|Perro solicitado|Mis solicitudes|tipo de hogar|otras mascotas|hogar temporal|lugar de recojo|Quiero ayudar/gi;
for (const [label, content] of [
  ["src/app.js", app],
  ["src/data.js", data],
  ["src/storage.js", storage],
  ["README.md", readme],
]) {
  const matches = content.match(prohibited);
  if (matches?.length) throw new Error(`Verification failed: prohibited wording in ${label}: ${matches.join(", ")}`);
}

const dogFiles = (await readdir(path.join(root, "assets/dogs"))).filter((file) => file.endsWith(".jpg"));
if (dogFiles.length !== 5) throw new Error(`Expected 5 dog images, found ${dogFiles.length}`);

console.log("Verification passed: files, routes, features, five profiles, wording and Day 2 checklist.");
