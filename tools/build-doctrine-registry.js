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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function validateKeyScriptures(doctrine) {
  const errors = [];

  if (!Array.isArray(doctrine.keyScriptures) || doctrine.keyScriptures.length === 0) {
    errors.push("Missing or empty keyScriptures array.");
    return errors;
  }

  doctrine.keyScriptures.forEach((ref, index) => {
    if (typeof ref === "string") {
      if (!ref.trim()) {
        errors.push(`keyScriptures[${index}] is empty.`);
      }
      return;
    }

    if (typeof ref !== "object" || ref === null) {
      errors.push(`keyScriptures[${index}] must be a string or object.`);
      return;
    }

    if (!isNonEmptyString(ref.reference)) {
      errors.push(`keyScriptures[${index}] missing reference.`);
    }
  });

  return errors;
}

function validateStudySections(doctrine) {
  const errors = [];
  const sections = doctrine.studySections || doctrine.sections;

  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push("Missing or empty studySections/sections array.");
    return errors;
  }

  sections.forEach((section, index) => {
    if (!section || typeof section !== "object") {
      errors.push(`studySections[${index}] must be an object.`);
      return;
    }

    if (!isNonEmptyString(section.heading)) {
      errors.push(`studySections[${index}] missing heading.`);
    }

    if (!isNonEmptyString(section.content)) {
      errors.push(`studySections[${index}] missing content.`);
    }
  });

  return errors;
}

function validateDoctrine(doctrine) {
  const errors = [];
  const warnings = [];

  if (!isNonEmptyString(doctrine.title)) {
    errors.push("Missing title.");
  }

  if (!isNonEmptyString(doctrine.definition)) {
    errors.push("Missing definition.");
  }

  if (!isNonEmptyString(doctrine.summary)) {
    errors.push("Missing summary.");
  }

  if (!isNonEmptyString(doctrine.christFocus)) {
    errors.push("Missing christFocus.");
  }

  errors.push(...validateKeyScriptures(doctrine));
  errors.push(...validateStudySections(doctrine));

  if (!Array.isArray(doctrine.sources)) {
    errors.push("Missing sources array.");
  }

  if (!Array.isArray(doctrine.relatedTopics)) {
    errors.push("Missing relatedTopics array.");
  }

  if (Array.isArray(doctrine.sources) && doctrine.sources.length === 0) {
    warnings.push("sources array is empty.");
  }

  if (Array.isArray(doctrine.relatedTopics) && doctrine.relatedTopics.length === 0) {
    warnings.push("relatedTopics array is empty.");
  }

  return { errors, warnings };
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

    const validation = validateDoctrine(doctrine);

    if (validation.errors.length) {
      report.rejected.push({
        file,
        id,
        title,
        errors: validation.errors
      });
      continue;
    }

    seenIds.add(id);

    if (validation.warnings.length) {
      report.warnings.push({
        file,
        id,
        title,
        warnings: validation.warnings
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

console.log("Doctrine registry built with framework validation.");
console.log(`Accepted: ${report.accepted.length}`);
console.log(`Warnings: ${report.warnings.length}`);
console.log(`Rejected: ${report.rejected.length}`);
console.log(`Duplicates: ${report.duplicates.length}`);

if (report.rejected.length || report.duplicates.length) {
  console.warn("Doctrine validation issues detected. See doctrine-registry-report.json.");
}
