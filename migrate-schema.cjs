#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "src");

const RENAMES = {
  disclosureText: "disclosureNotes",
  aiUsage: "disclosureTypes",
  indicators: "markers",
  indicatorsText: "markerNotes",
};

const files = fs
  .readdirSync(srcDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => path.join(srcDir, f));

let updated = 0;
let skipped = 0;

for (const filePath of files) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const obj = JSON.parse(raw);
  const keys = Object.keys(obj);

  const needsRename = keys.some((k) => k in RENAMES);
  if (!needsRename) {
    skipped++;
    continue;
  }

  // Build new object preserving key order, renaming as needed
  const newObj = {};
  for (const key of keys) {
    const newKey = RENAMES[key] || key;
    newObj[newKey] = obj[key];
  }

  fs.writeFileSync(filePath, JSON.stringify(newObj, null, 2) + "\n");
  updated++;
}

console.log(`Done. Updated: ${updated}, Skipped: ${skipped}, Total: ${files.length}`);
