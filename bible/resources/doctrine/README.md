# Iron Sharpener Doctrine Library

This folder contains the doctrine JSON files for the Restored Daily Ministries Iron Sharpener tool.

## Locked Doctrine Flow

Doctrine JSON files are placed directly in:

```text
bible/resources/doctrine/
```

Then the registry builder creates:

```text
doctrine-registry.json
doctrine-registry-report.json
```

The Iron Sharpener app reads `doctrine-registry.json` to power doctrine search, category browsing, and related-topic navigation.

## Keep These Support Files

Do not delete these permanently:

```text
doctrine-aliases.json
doctrine-registry.json
doctrine-registry-report.json
README.md
```

`doctrine-registry.json` and `doctrine-registry-report.json` are overwritten by the builder.

## Reset Workflow

When rebuilding the doctrine library from scratch:

1. Delete old doctrine topic JSON files from this folder.
2. Keep or restore:
   - `doctrine-aliases.json`
   - `doctrine-registry.json`
   - `doctrine-registry-report.json`
   - `README.md`
3. Add the fresh doctrine topic JSON files.
4. Run:

```bash
node tools/build-doctrine-registry.js
```

5. Check `doctrine-registry-report.json`.

## Passing Report Targets

For a clean live batch, the important numbers are:

```text
Rejected: 0
Duplicates: 0
Unresolved related topics: 0
```

`unresolvedAliases` may remain above zero until future doctrine categories are added. That is expected during staged production.

## Locked Doctrine Template v2

Every doctrine entry must include:

- `definition`
- `summary`
- `christFocus`
- `keyScriptures`
- `studySections`
- `relatedTopics`
- `sources`

The visible study sections should include:

- Doctrine in Summary
- Why This Matters
- Discipleship and Application
- Guardrails and Common Errors

Every doctrine should be:

- Christ-centered
- Scripture-driven
- Hope-filled
- Discipleship-oriented
- Hyperlinked through key Scriptures
- Cross-referenced through related topics
- Unique in wording and application

## Current Production Plan

Iron Sharpener Standard v2 uses 12 doctrine categories.

Each production category is being built in batches of 45 doctrine files.

12 categories × 45 files = 540 total doctrine files.

## Category Inventory

1. Scripture
2. God (Theology Proper)
3. Jesus Christ
4. Holy Spirit
5. Salvation
6. Church
7. Christian Life
8. Humanity and Sin
9. Last Things (Eschatology)
10. Angels and the Spiritual Realm
11. Biblical Relationships
12. Suffering, Recovery, Restoration, and Hope
