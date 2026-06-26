#!/usr/bin/env node
/* =========================================================
   Restored Daily Ministries / Iron Sharpener
   WEB Internal Cross-Reference Builder

   Purpose:
   - Builds an INTERNAL cross-reference database from the local
     World English Bible files only.
   - Does NOT use TSK, external commentaries, dictionaries, APIs,
     or web sources.
   - Outputs book-by-book JSON files that Iron Sharpener can read:
       bible/resources/internal-cross-references/Genesis.json
       bible/resources/internal-cross-references/1 Corinthians.json
       ...

   Usage from repo root:
     node tools/build-web-internal-crossrefs.js

   Optional:
     node tools/build-web-internal-crossrefs.js \
       --input bible/web \
       --output bible/resources/internal-cross-references \
       --max-per-verse 12 \
       --min-score 8
   ========================================================= */

const fs = require('fs');
const path = require('path');

const BOOKS = [
  ['Genesis',50],['Exodus',40],['Leviticus',27],['Numbers',36],['Deuteronomy',34],['Joshua',24],['Judges',21],['Ruth',4],
  ['1 Samuel',31],['2 Samuel',24],['1 Kings',22],['2 Kings',25],['1 Chronicles',29],['2 Chronicles',36],['Ezra',10],['Nehemiah',13],
  ['Esther',10],['Job',42],['Psalms',150],['Proverbs',31],['Ecclesiastes',12],['Song of Solomon',8],['Isaiah',66],['Jeremiah',52],
  ['Lamentations',5],['Ezekiel',48],['Daniel',12],['Hosea',14],['Joel',3],['Amos',9],['Obadiah',1],['Jonah',4],['Micah',7],
  ['Nahum',3],['Habakkuk',3],['Zephaniah',3],['Haggai',2],['Zechariah',14],['Malachi',4],['Matthew',28],['Mark',16],['Luke',24],
  ['John',21],['Acts',28],['Romans',16],['1 Corinthians',16],['2 Corinthians',13],['Galatians',6],['Ephesians',6],
  ['Philippians',4],['Colossians',4],['1 Thessalonians',5],['2 Thessalonians',3],['1 Timothy',6],['2 Timothy',4],
  ['Titus',3],['Philemon',1],['Hebrews',13],['James',5],['1 Peter',5],['2 Peter',3],['1 John',5],['2 John',1],['3 John',1],
  ['Jude',1],['Revelation',22]
];

const STOPWORDS = new Set(`
a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own said same saying says she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with you your yours yourself yourselves
afterward already always another around became become becomes becoming came come comes coming every everything made make makes many much must one ones said say says shall should thing things thus unto upon went were wherefore would yet
`.trim().split(/\s+/));

const DEFAULTS = {
  input: 'bible/web',
  output: 'bible/resources/internal-cross-references',
  maxPerVerse: 12,
  minScore: 8,
  maxWordDf: 80,
  maxBigramDf: 60,
  maxTrigramDf: 45,
  minFeatureDf: 2
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { ...DEFAULTS };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--input' && next) { options.input = next; i += 1; }
    else if (arg === '--output' && next) { options.output = next; i += 1; }
    else if (arg === '--max-per-verse' && next) { options.maxPerVerse = parseInt(next, 10) || options.maxPerVerse; i += 1; }
    else if (arg === '--min-score' && next) { options.minScore = parseFloat(next) || options.minScore; i += 1; }
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node tools/build-web-internal-crossrefs.js [--input bible/web] [--output bible/resources/internal-cross-references] [--max-per-verse 12] [--min-score 8]`);
      process.exit(0);
    }
  }

  options.input = path.resolve(process.cwd(), options.input);
  options.output = path.resolve(process.cwd(), options.output);
  return options;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ');
}

function normalizeText(value) {
  return stripHtml(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemLite(word) {
  let w = String(word || '').toLowerCase();
  if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 6 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 6 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 5 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function significantTokens(text) {
  return normalizeText(text)
    .split(/\s+/)
    .map(token => token.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
    .map(stemLite)
    .filter(token => token.length >= 4)
    .filter(token => !STOPWORDS.has(token))
    .filter(token => !/^\d+$/.test(token));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractFeatures(text) {
  const tokens = significantTokens(text);
  const words = unique(tokens.map(token => `w:${token}`));
  const bigrams = [];
  const trigrams = [];

  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (tokens[i] !== tokens[i + 1]) bigrams.push(`b:${tokens[i]} ${tokens[i + 1]}`);
  }

  for (let i = 0; i < tokens.length - 2; i += 1) {
    const tri = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
    if (new Set(tri.split(' ')).size >= 2) trigrams.push(`t:${tri}`);
  }

  return unique([...words, ...bigrams, ...trigrams]);
}

function canonicalRef(book, chapter, verse) {
  return `${book} ${chapter}:${verse}`;
}

function getChapterFile(inputRoot, book, chapter) {
  const padded = String(chapter).padStart(2, '0');
  return path.join(inputRoot, book, `${padded}.json`);
}

function loadVerses(inputRoot) {
  const verses = [];
  const missing = [];

  for (const [book, chapterCount] of BOOKS) {
    for (let chapter = 1; chapter <= chapterCount; chapter += 1) {
      const file = getChapterFile(inputRoot, book, chapter);
      if (!fs.existsSync(file)) {
        missing.push(path.relative(process.cwd(), file));
        continue;
      }

      const data = readJson(file);
      const list = Array.isArray(data.verses) ? data.verses : [];

      for (const item of list) {
        const verseNum = parseInt(item.verse, 10);
        const text = String(item.text || item.content || '').trim();
        if (!verseNum || !text) continue;

        const ref = canonicalRef(book, chapter, verseNum);
        verses.push({
          id: verses.length,
          book,
          chapter,
          verse: verseNum,
          ref,
          text,
          features: extractFeatures(text)
        });
      }
    }
  }

  return { verses, missing };
}

function featureType(feature) {
  if (feature.startsWith('t:')) return 'trigram';
  if (feature.startsWith('b:')) return 'bigram';
  return 'word';
}

function maxDfForFeature(feature, options) {
  const type = featureType(feature);
  if (type === 'trigram') return options.maxTrigramDf;
  if (type === 'bigram') return options.maxBigramDf;
  return options.maxWordDf;
}

function featureWeight(feature, df, totalVerses) {
  const type = featureType(feature);
  const idf = Math.log((totalVerses + 1) / (df + 1));
  if (type === 'trigram') return 5.5 + idf;
  if (type === 'bigram') return 3.2 + idf;
  return 0.85 + Math.min(idf, 3.0);
}

function sameSource(a, b) {
  return a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;
}

function rankCandidates(verse, verses, featureIndex, featureDf, totalVerses, options) {
  const scores = new Map();
  const sharedWords = new Map();
  const sharedPhrases = new Map();

  for (const feature of verse.features) {
    const targets = featureIndex.get(feature);
    if (!targets) continue;

    const df = featureDf.get(feature) || 0;
    const weight = featureWeight(feature, df, totalVerses);
    const type = featureType(feature);

    for (const targetId of targets) {
      if (targetId === verse.id) continue;
      const target = verses[targetId];
      if (!target || sameSource(verse, target)) continue;

      scores.set(targetId, (scores.get(targetId) || 0) + weight);

      if (type === 'word') sharedWords.set(targetId, (sharedWords.get(targetId) || 0) + 1);
      else sharedPhrases.set(targetId, (sharedPhrases.get(targetId) || 0) + 1);
    }
  }

  return [...scores.entries()]
    .map(([targetId, score]) => {
      const target = verses[targetId];
      const words = sharedWords.get(targetId) || 0;
      const phrases = sharedPhrases.get(targetId) || 0;

      let adjusted = score;
      if (verse.book === target.book && verse.chapter === target.chapter) adjusted *= 0.82;
      if (verse.book === target.book && Math.abs(verse.chapter - target.chapter) <= 1) adjusted *= 0.92;

      return { target, score: adjusted, words, phrases };
    })
    .filter(item => item.score >= options.minScore)
    .filter(item => item.phrases >= 1 || item.words >= 3)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.phrases !== a.phrases) return b.phrases - a.phrases;
      if (b.words !== a.words) return b.words - a.words;
      return a.target.id - b.target.id;
    })
    .slice(0, options.maxPerVerse);
}

function buildIndexes(verses, options) {
  const rawIndex = new Map();

  for (const verse of verses) {
    for (const feature of verse.features) {
      if (!rawIndex.has(feature)) rawIndex.set(feature, []);
      rawIndex.get(feature).push(verse.id);
    }
  }

  const featureIndex = new Map();
  const featureDf = new Map();

  for (const [feature, ids] of rawIndex.entries()) {
    const df = ids.length;
    if (df < options.minFeatureDf) continue;
    if (df > maxDfForFeature(feature, options)) continue;

    featureIndex.set(feature, ids);
    featureDf.set(feature, df);
  }

  return { featureIndex, featureDf, rawFeatureCount: rawIndex.size };
}

function buildCrossReferences(verses, options) {
  const { featureIndex, featureDf, rawFeatureCount } = buildIndexes(verses, options);
  const byBook = new Map();
  const reportByBook = new Map();
  let sourceVersesWithRefs = 0;
  let totalLinks = 0;

  for (const [book] of BOOKS) {
    byBook.set(book, {});
    reportByBook.set(book, { book, sourceVersesWithRefs: 0, links: 0 });
  }

  for (const verse of verses) {
    const ranked = rankCandidates(verse, verses, featureIndex, featureDf, verses.length, options);
    if (!ranked.length) continue;

    const refs = ranked.map(item => item.target.ref);
    byBook.get(verse.book)[verse.ref] = refs;
    sourceVersesWithRefs += 1;
    totalLinks += refs.length;

    const bookReport = reportByBook.get(verse.book);
    bookReport.sourceVersesWithRefs += 1;
    bookReport.links += refs.length;
  }

  return {
    byBook,
    rawFeatureCount,
    keptFeatureCount: featureIndex.size,
    report: {
      totalVerses: verses.length,
      sourceVersesWithRefs,
      totalLinks,
      averageLinksPerSourceVerse: sourceVersesWithRefs ? Number((totalLinks / sourceVersesWithRefs).toFixed(2)) : 0,
      books: [...reportByBook.values()]
    }
  };
}

function writeReport(outputRoot, options, loaded, built) {
  const lines = [];
  lines.push('# Iron Sharpener Internal Cross References — Build Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Source');
  lines.push('');
  lines.push('- Source text: local World English Bible JSON files only.');
  lines.push('- External sources used: none.');
  lines.push('- TSK used: no.');
  lines.push('');
  lines.push('## Settings');
  lines.push('');
  lines.push(`- Input: \`${path.relative(process.cwd(), options.input)}\``);
  lines.push(`- Output: \`${path.relative(process.cwd(), options.output)}\``);
  lines.push(`- Max references per source verse: ${options.maxPerVerse}`);
  lines.push(`- Minimum score: ${options.minScore}`);
  lines.push(`- Raw features: ${built.rawFeatureCount}`);
  lines.push(`- Kept features after frequency filter: ${built.keptFeatureCount}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- Loaded verses: ${built.report.totalVerses}`);
  lines.push(`- Source verses with references: ${built.report.sourceVersesWithRefs}`);
  lines.push(`- Total internal links: ${built.report.totalLinks}`);
  lines.push(`- Average links per source verse: ${built.report.averageLinksPerSourceVerse}`);
  lines.push(`- Missing WEB chapter files: ${loaded.missing.length}`);
  lines.push('');
  lines.push('## Book Coverage');
  lines.push('');
  lines.push('| Book | Source verses with refs | Links |');
  lines.push('|---|---:|---:|');
  for (const item of built.report.books) {
    lines.push(`| ${item.book} | ${item.sourceVersesWithRefs} | ${item.links} |`);
  }
  lines.push('');
  if (loaded.missing.length) {
    lines.push('## Missing Files');
    lines.push('');
    for (const file of loaded.missing.slice(0, 250)) lines.push(`- ${file}`);
    if (loaded.missing.length > 250) lines.push(`- ...and ${loaded.missing.length - 250} more`);
    lines.push('');
  }
  lines.push('## Notes');
  lines.push('');
  lines.push('This is an algorithmic, WEB-only internal cross-reference system. It links verses by repeated significant wording and phrase overlap in the WEB text. It is not copied from TSK and is not a replacement for Spirit-led study or pastoral judgment.');
  lines.push('');

  fs.writeFileSync(path.join(outputRoot, 'BUILD_REPORT.md'), lines.join('\n'), 'utf8');
}

function main() {
  const options = parseArgs();
  ensureDir(options.output);

  console.log('Loading WEB verses from:', path.relative(process.cwd(), options.input));
  const loaded = loadVerses(options.input);

  if (!loaded.verses.length) {
    console.error('ERROR: No WEB verses were loaded. Check --input path and bible/web/<Book>/<Chapter>.json structure.');
    process.exit(1);
  }

  console.log(`Loaded ${loaded.verses.length} verses. Building internal cross references...`);
  const built = buildCrossReferences(loaded.verses, options);

  const index = {
    generatedAt: new Date().toISOString(),
    source: 'World English Bible local JSON only',
    externalSourcesUsed: [],
    tskUsed: false,
    schema: 'book-file-map-v1',
    settings: {
      maxPerVerse: options.maxPerVerse,
      minScore: options.minScore,
      maxWordDf: options.maxWordDf,
      maxBigramDf: options.maxBigramDf,
      maxTrigramDf: options.maxTrigramDf
    },
    totals: built.report,
    files: []
  };

  for (const [book] of BOOKS) {
    const data = built.byBook.get(book) || {};
    const file = `${book}.json`;
    writeJson(path.join(options.output, file), data);
    index.files.push({ book, file, sourceVersesWithRefs: Object.keys(data).length, links: Object.values(data).reduce((sum, refs) => sum + refs.length, 0) });
  }

  writeJson(path.join(options.output, 'index.json'), index);
  writeReport(options.output, options, loaded, built);

  console.log('Done.');
  console.table({
    versesLoaded: built.report.totalVerses,
    sourceVersesWithRefs: built.report.sourceVersesWithRefs,
    totalLinks: built.report.totalLinks,
    averageLinksPerSourceVerse: built.report.averageLinksPerSourceVerse,
    output: path.relative(process.cwd(), options.output)
  });
}

main();
