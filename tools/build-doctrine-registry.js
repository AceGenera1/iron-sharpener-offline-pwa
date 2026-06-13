const fs = require("fs");
const path = require("path");

const doctrineDir = path.join(__dirname, "..", "bible", "resources", "doctrine");
const outputFile = path.join(doctrineDir, "doctrine-registry.json");
const reportFile = path.join(doctrineDir, "doctrine-registry-report.json");
const aliasesFile = path.join(doctrineDir, "doctrine-aliases.json");

const registryFileName = "doctrine-registry.json";
const reportFileName = "doctrine-registry-report.json";
const aliasesFileName = "doctrine-aliases.json";

const canonicalCategories = [
  "Scripture",
  "God",
  "Christ",
  "Holy Spirit",
  "Salvation",
  "Church",
  "Prayer",
  "Spiritual Warfare",
  "Last Things",
  "Restoration & Suffering",
  "Christian Living"
];

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

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map(item => String(item || "").trim())
      .filter(Boolean)
  )];
}

function inferDoctrineCategory(id, title) {
  const text = `${id} ${title}`.toLowerCase();

  if (text.includes("scripture") || text.includes("word")) return "Scripture";
  if (text.includes("god") || text.includes("trinity")) return "God";
  if (text.includes("christ") || text.includes("jesus") || text.includes("gospel")) return "Christ";
  if (text.includes("holy-spirit") || text.includes("spirit")) return "Holy Spirit";
  if (text.includes("salvation") || text.includes("grace") || text.includes("redemption") || text.includes("justification")) return "Salvation";
  if (text.includes("church") || text.includes("elders") || text.includes("deacons")) return "Church";
  if (text.includes("prayer")) return "Prayer";
  if (text.includes("satan") || text.includes("devil") || text.includes("demon") || text.includes("warfare")) return "Spiritual Warfare";
  if (text.includes("heaven") || text.includes("hell") || text.includes("judgment") || text.includes("second-coming") || text.includes("last-things")) return "Last Things";
  if (text.includes("addiction") || text.includes("recovery") || text.includes("suffering") || text.includes("grief") || text.includes("disability")) return "Restoration & Suffering";

  return "Christian Living";
}

function getDoctrineCategory(doctrine, id, title) {
  const category = isNonEmptyString(doctrine.category)
    ? doctrine.category.trim()
    : inferDoctrineCategory(id, title);

  return canonicalCategories.includes(category) ? category : category;
}

function validateKeyScriptures(doctrine) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(doctrine.keyScriptures) || doctrine.keyScriptures.length === 0) {
    errors.push("Missing or empty keyScriptures array.");
    return { errors, warnings };
  }

  doctrine.keyScriptures.forEach((ref, index) => {
    let reference = "";

    if (typeof ref === "string") {
      reference = ref.trim();

      if (!reference) {
        errors.push(`keyScriptures[${index}] is empty.`);
      }
    } else if (typeof ref === "object" && ref !== null) {
      reference = String(ref.reference || "").trim();

      if (!reference) {
        errors.push(`keyScriptures[${index}] missing reference.`);
      }
    } else {
      errors.push(`keyScriptures[${index}] must be a string or object.`);
      return;
    }

    if (reference && !/\b\d+:\d+/.test(reference)) {
      warnings.push(`keyScriptures[${index}] may not look like a Scripture reference: "${reference}".`);
    }
  });

  return { errors, warnings };
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

function validateSources(doctrine) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(doctrine.sources)) {
    errors.push("Missing sources array.");
    return { errors, warnings };
  }

  if (doctrine.sources.length === 0) {
    warnings.push("sources array is empty.");
  }

  doctrine.sources.forEach((source, index) => {
    if (typeof source === "string") {
      if (!source.trim()) {
        warnings.push(`sources[${index}] is empty.`);
      }
      return;
    }

    if (typeof source === "object" && source !== null) {
      if (!isNonEmptyString(source.title) && !isNonEmptyString(source.name)) {
        warnings.push(`sources[${index}] object should include title or name.`);
      }
      return;
    }

    warnings.push(`sources[${index}] should be a string or object.`);
  });

  return { errors, warnings };
}

function validateRelatedTopics(doctrine) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(doctrine.relatedTopics)) {
    errors.push("Missing relatedTopics array.");
    return { errors, warnings };
  }

  if (doctrine.relatedTopics.length === 0) {
    warnings.push("relatedTopics array is empty.");
  }

  doctrine.relatedTopics.forEach((topic, index) => {
    if (!isNonEmptyString(topic)) {
      errors.push(`relatedTopics[${index}] must be a non-empty string.`);
    }
  });

  return { errors, warnings };
}

function validateDoctrine(doctrine, file, id, title) {
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

  if (!isNonEmptyString(doctrine.category)) {
    warnings.push(`Missing category. Builder will infer category: "${inferDoctrineCategory(id, title)}".`);
  }

  if (isNonEmptyString(doctrine.category) && !canonicalCategories.includes(doctrine.category.trim())) {
    warnings.push(`Category "${doctrine.category}" is not in the canonical category list.`);
  }

  const fileId = makeDoctrineId(file);
  if (doctrine.id && makeDoctrineId(doctrine.id) !== fileId) {
    warnings.push(`Doctrine id "${doctrine.id}" does not match filename id "${fileId}".`);
  }

  const scriptureValidation = validateKeyScriptures(doctrine);
  errors.push(...scriptureValidation.errors);
  warnings.push(...scriptureValidation.warnings);

  errors.push(...validateStudySections(doctrine));

  const sourceValidation = validateSources(doctrine);
  errors.push(...sourceValidation.errors);
  warnings.push(...sourceValidation.warnings);

  const relatedValidation = validateRelatedTopics(doctrine);
  errors.push(...relatedValidation.errors);
  warnings.push(...relatedValidation.warnings);

  return { errors, warnings };
}

function shouldSkipFile(file) {
  if (!file.endsWith(".json")) return true;
  if (file.startsWith("index")) return true;
  if (file === registryFileName) return true;
  if (file === reportFileName) return true;
  if (file === aliasesFileName) return true;
  return false;
}

function loadDoctrineAliases() {
  const aliases = {};
  const warnings = [];

  if (!fs.existsSync(aliasesFile)) {
    return {
      loaded: false,
      aliases,
      warnings: ["doctrine-aliases.json was not found."]
    };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(aliasesFile, "utf8"));

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {
        loaded: true,
        aliases,
        warnings: ["doctrine-aliases.json must contain a plain JSON object."]
      };
    }

    Object.entries(raw).forEach(([aliasName, targetValue]) => {
      const aliasLabel = String(aliasName || "").trim();
      const targetLabel = String(targetValue || "").trim();

      if (!aliasLabel || !targetLabel) {
        warnings.push(`Invalid alias entry: "${aliasName}" -> "${targetValue}".`);
        return;
      }

      aliases[makeDoctrineId(aliasLabel)] = {
        alias: aliasLabel,
        aliasId: makeDoctrineId(aliasLabel),
        target: targetLabel,
        targetId: makeDoctrineId(targetLabel)
      };
    });

    return {
      loaded: true,
      aliases,
      warnings
    };
  } catch (error) {
    return {
      loaded: true,
      aliases,
      warnings: [`Could not parse doctrine-aliases.json: ${error.message}`]
    };
  }
}

function findRegistryItemByTarget(registry, targetValue) {
  const targetId = makeDoctrineId(targetValue);

  return registry.find(item => {
    if (makeDoctrineId(item.id) === targetId) return true;
    if (makeDoctrineId(item.title) === targetId) return true;
    if (makeDoctrineId(item.file) === targetId) return true;

    return Array.isArray(item.searchTerms) &&
      item.searchTerms.some(term => makeDoctrineId(term) === targetId);
  });
}

const files = fs.readdirSync(doctrineDir)
  .filter(file => !shouldSkipFile(file))
  .sort();

const registry = [];
const acceptedDoctrines = [];

const report = {
  generatedAt: new Date().toISOString(),
  frameworkVersion: "1.0",
  totals: {
    scanned: files.length,
    accepted: 0,
    warnings: 0,
    rejected: 0,
    duplicates: 0,
    aliasesLoaded: 0,
    resolvedAliases: 0,
    unresolvedAliases: 0,
    unresolvedRelatedTopics: 0
  },
  accepted: [],
  warnings: [],
  rejected: [],
  duplicates: [],
  aliases: {
    file: aliasesFileName,
    loaded: false,
    count: 0,
    warnings: []
  },
  resolvedAliases: [],
  unresolvedAliases: [],
  unresolvedRelatedTopics: [],
  categories: {}
};

const seenIds = new Map();

for (const file of files) {
  const fullPath = path.join(doctrineDir, file);

  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const doctrine = JSON.parse(raw);

    const id = makeDoctrineId(doctrine.id || file);
    const title = doctrine.title || makeDoctrineTitle(file);
    const category = getDoctrineCategory(doctrine, id, title);

    if (!id) {
      report.rejected.push({
        file,
        reason: "Missing doctrine id."
      });
      continue;
    }

    if (seenIds.has(id)) {
      report.duplicates.push({
        file,
        id,
        title,
        conflictsWith: seenIds.get(id)
      });
      continue;
    }

    const validation = validateDoctrine(doctrine, file, id, title);

    if (validation.errors.length) {
      report.rejected.push({
        file,
        id,
        title,
        errors: validation.errors
      });
      continue;
    }

    seenIds.set(id, file);

    const tags = normalizeStringArray(doctrine.tags);
    const relatedTopics = normalizeStringArray(doctrine.relatedTopics);

    const searchTerms = normalizeStringArray([
      id,
      title,
      category,
      ...tags,
      ...relatedTopics,
      ...(Array.isArray(doctrine.searchTerms) ? doctrine.searchTerms : [])
    ]);

    const registryItem = {
      id,
      title,
      file,
      frameworkVersion: doctrine.frameworkVersion || "1.0",
      validated: true,
      category,
      tags,
      searchTerms
    };

    registry.push(registryItem);

    acceptedDoctrines.push({
      file,
      id,
      title,
      category,
      doctrine
    });

    report.accepted.push({
      file,
      id,
      title,
      category
    });

    if (!report.categories[category]) {
      report.categories[category] = 0;
    }
    report.categories[category] += 1;

    if (validation.warnings.length) {
      report.warnings.push({
        file,
        id,
        title,
        warnings: validation.warnings
      });
    }
  } catch (error) {
    report.rejected.push({
      file,
      reason: error.message
    });
  }
}

const acceptedAliases = new Set();

function rebuildAcceptedAliases() {
  acceptedAliases.clear();

  acceptedDoctrines.forEach(item => {
    acceptedAliases.add(makeDoctrineId(item.id));
    acceptedAliases.add(makeDoctrineId(item.title));
    acceptedAliases.add(makeDoctrineId(item.file));

    if (Array.isArray(item.doctrine.searchTerms)) {
      item.doctrine.searchTerms.forEach(term => {
        acceptedAliases.add(makeDoctrineId(term));
      });
    }
  });

  registry.forEach(item => {
    acceptedAliases.add(makeDoctrineId(item.id));
    acceptedAliases.add(makeDoctrineId(item.title));
    acceptedAliases.add(makeDoctrineId(item.file));

    if (Array.isArray(item.searchTerms)) {
      item.searchTerms.forEach(term => {
        acceptedAliases.add(makeDoctrineId(term));
      });
    }
  });
}

rebuildAcceptedAliases();

const aliasLoad = loadDoctrineAliases();
const doctrineAliases = aliasLoad.aliases;
const resolvedAliasIds = new Set();

report.aliases.loaded = aliasLoad.loaded;
report.aliases.count = Object.keys(doctrineAliases).length;
report.aliases.warnings = aliasLoad.warnings;

Object.values(doctrineAliases).forEach(aliasEntry => {
  const targetItem = findRegistryItemByTarget(registry, aliasEntry.target);

  if (!targetItem) {
    report.unresolvedAliases.push({
      alias: aliasEntry.alias,
      aliasId: aliasEntry.aliasId,
      target: aliasEntry.target,
      targetId: aliasEntry.targetId,
      message: "Alias target does not match any accepted doctrine id, title, filename, or searchTerm."
    });
    return;
  }

  targetItem.searchTerms = normalizeStringArray([
    ...(Array.isArray(targetItem.searchTerms) ? targetItem.searchTerms : []),
    aliasEntry.alias,
    aliasEntry.aliasId
  ]);

  resolvedAliasIds.add(aliasEntry.aliasId);

  report.resolvedAliases.push({
    alias: aliasEntry.alias,
    aliasId: aliasEntry.aliasId,
    target: aliasEntry.target,
    resolvedToId: targetItem.id,
    resolvedToTitle: targetItem.title
  });
});

rebuildAcceptedAliases();

acceptedDoctrines.forEach(item => {
  const relatedTopics = normalizeStringArray(item.doctrine.relatedTopics);

  relatedTopics.forEach(topic => {
    const topicId = makeDoctrineId(topic);

    if (acceptedAliases.has(topicId) || resolvedAliasIds.has(topicId)) {
      return;
    }

    report.unresolvedRelatedTopics.push({
      file: item.file,
      id: item.id,
      title: item.title,
      relatedTopic: topic,
      normalizedTopic: topicId,
      message: "Related topic does not match any accepted doctrine id, title, filename, searchTerm, or doctrine alias."
    });
  });
});

registry.sort((a, b) => {
  const categoryCompare = a.category.localeCompare(b.category);
  if (categoryCompare !== 0) return categoryCompare;
  return a.title.localeCompare(b.title);
});

report.totals.accepted = report.accepted.length;
report.totals.warnings = report.warnings.length;
report.totals.rejected = report.rejected.length;
report.totals.duplicates = report.duplicates.length;
report.totals.aliasesLoaded = report.aliases.count;
report.totals.resolvedAliases = report.resolvedAliases.length;
report.totals.unresolvedAliases = report.unresolvedAliases.length;
report.totals.unresolvedRelatedTopics = report.unresolvedRelatedTopics.length;

fs.writeFileSync(outputFile, JSON.stringify(registry, null, 2));
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

console.log("Doctrine registry built with locked framework validation.");
console.log(`Scanned: ${report.totals.scanned}`);
console.log(`Accepted: ${report.totals.accepted}`);
console.log(`Warnings: ${report.totals.warnings}`);
console.log(`Rejected: ${report.totals.rejected}`);
console.log(`Duplicates: ${report.totals.duplicates}`);
console.log(`Aliases loaded: ${report.totals.aliasesLoaded}`);
console.log(`Resolved aliases: ${report.totals.resolvedAliases}`);
console.log(`Unresolved aliases: ${report.totals.unresolvedAliases}`);
console.log(`Unresolved related topics: ${report.totals.unresolvedRelatedTopics}`);

if (
  report.rejected.length ||
  report.duplicates.length ||
  report.unresolvedAliases.length ||
  report.unresolvedRelatedTopics.length
) {
  console.warn("Doctrine validation issues detected. See doctrine-registry-report.json.");
}
