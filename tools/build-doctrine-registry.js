const fs = require("fs");
const path = require("path");

const doctrineDir = path.join(__dirname, "..", "bible", "resources", "doctrine");
const outputFile = path.join(doctrineDir, "doctrine-registry.json");
const reportFile = path.join(doctrineDir, "doctrine-registry-report.json");

function makeDoctrineId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.json$/i, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeDoctrineTitle(value) {
  return String(value || "")
    .replace(/\.json$/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

function hasScriptureLinks(doctrine) {
  if (!Array.isArray(doctrine.keyScriptures)) return true;

  return doctrine.keyScriptures.every(ref => {
    if (typeof ref === "string") return true;
    return ref.reference && (ref.url || ref.link);
  });
}

const files = fs.readdirSync(doctrineDir)
  .filter(file => file.endsWith(".json"))
  .filter(file => !file.startsWith("index"))
  .filter(file => file !== "doctrine-registry.json")
  .filter(file => file !== "doctrine-registry-report.json");

const registry = [];
const report = {
  accepted: [],
  warnings: [],
  rejected: [],
  duplicates: []
};

const seenIds = new Set();

for (const file of files) {
  const fullPath = path.join(doctrineDir, file);

  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const doctrine = JSON.parse(raw);

    const id = makeDoctrineId(doctrine.id || file);
    const title = doctrine.title || makeDoctrineTitle(file);

    if (!id) {
      report.rejected.push({ file, reason: "Missing doctrine id." });
      continue;
    }

    if (seenIds.has(id)) {
      report.duplicates.push({ file, id, title });
      continue;
    }

    seenIds.add(id);

    if (!doctrine.title) {
      report.warnings.push({
        file,
        id,
        warning: "Missing title. Generated title from filename."
      });
    }

    if (!hasScriptureLinks(doctrine)) {
      report.warnings.push({
        file,
        id,
        warning: "One or more keyScriptures entries are missing url/link."
      });
    }

    registry.push({
      id,
      title,
      file
    });

    report.accepted.push({ file, id, title });

  } catch (error) {
    report.rejected.push({
      file,
      reason: error.message
    });
  }
}

registry.sort((a, b) => a.title.localeCompare(b.title));

fs.writeFileSync(outputFile, JSON.stringify(registry, null, 2));
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

console.log("Doctrine registry built.");
console.log(`Accepted: ${report.accepted.length}`);
console.log(`Warnings: ${report.warnings.length}`);
console.log(`Rejected: ${report.rejected.length}`);
console.log(`Duplicates: ${report.duplicates.length}`);
