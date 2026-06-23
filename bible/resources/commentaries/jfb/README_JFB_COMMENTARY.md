# Jamieson-Fausset-Brown Commentary Resource Package

Install by copying the `bible/` folder into the Iron Sharpener project root.

Expected destination:

```text
bible/resources/commentaries/jfb/
```

Generated from a cleaner text-based public-domain JFB source derived from the CCEL electronic edition after the scanned PDF OCR proved noisy.

Book JSON files: 66
Mapped verse keys: 24820 / 31103
Overall verse-key coverage: 79.8%

Notes:
- JFB is a verse-by-verse/range commentary and does not contain a separate note for every Bible verse.
- Multiple verses may share one note when the source groups them, e.g. `1, 2.` or `3-5.`
- Files are shaped for Iron Sharpener’s existing commentary loader: `Book.json` keyed by `Book Chapter:Verse`.
