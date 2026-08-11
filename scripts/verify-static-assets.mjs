import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve("dist/public");
const assetsDir = path.join(publicDir, "assets");
const missing = new Set();

function verifyReference(fromFile, reference) {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  const target = cleanReference.startsWith("/assets/")
    ? path.join(publicDir, cleanReference.slice(1))
    : path.resolve(path.dirname(fromFile), cleanReference);

  if (!target.startsWith(publicDir + path.sep) || !fs.existsSync(target)) {
    missing.add(`${path.relative(publicDir, fromFile)} -> ${reference}`);
  }
}

const indexPath = path.join(publicDir, "index.html");
const index = fs.readFileSync(indexPath, "utf8");
for (const match of index.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)) {
  verifyReference(indexPath, match[1]);
}

for (const name of fs.readdirSync(assetsDir)) {
  if (!name.endsWith(".js")) continue;
  const assetPath = path.join(assetsDir, name);
  const source = fs.readFileSync(assetPath, "utf8");
  for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](\.\/[^"']+)["']/g)) {
    verifyReference(assetPath, match[1]);
  }
}

if (missing.size > 0) {
  console.error("Static build contains missing local asset references:");
  for (const reference of missing) console.error(`- ${reference}`);
  process.exit(1);
}

console.log("Static asset references verified.");
