# Restored Daily Iron Sharpener — Category 2 God / Theology Proper 365 Reset

This package contains the rebuilt Category 2 God / Theology Proper doctrine set for the 365-doctrine Iron Sharpener library.

## Contents

- Doctrine JSON files: 30
- Category: God / Theology Proper
- Framework: 365 total doctrine rebuild
- Visible Summary: disabled
- Visible Sources: disabled
- `sources`: empty arrays on all doctrine cards
- Scripture authority: 66-book Old and New Testament only
- Included `doctrine-aliases.json`: merged Category 1 + Category 2 aliases

## Upload target

Upload/replace these JSON files in:

```text
bible/resources/doctrine/
```

Then rebuild the doctrine registry using the existing Iron Sharpener registry build workflow.

## Important upload note

This package is designed to be added on top of the already-approved Category 1 Scripture files. Do not clear the doctrine folder unless you are intentionally re-uploading Category 1 as well. Upload the 30 Category 2 JSON files and replace `doctrine-aliases.json` with the included merged alias file, then rebuild the registry.

## Expected live count after upload

If Category 1 is already present and Category 2 is added, the regenerated registry should show 60 doctrine entries total.

## Notes

The `summary` field remains present only for registry/search compatibility. It should not be displayed on doctrine cards. The `sources` field is intentionally empty because individual source lists are not displayed on cards. Source policy and approved source framework are embedded for internal governance.
