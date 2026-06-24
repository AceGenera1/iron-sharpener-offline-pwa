# Iron Sharpener — Bible Backgrounds & Customs Master Report

**Resource:** Bible Backgrounds & Customs  
**Install path:** `bible/resources/backgrounds/`  
**Package status:** Phase 1–5 cumulative database  
**Report purpose:** One authoritative report for verifying that the full Bible Backgrounds & Customs database is present, linked, and internally consistent.  

## Final Summary

| Check | Count / Status |
|---|---:|
| Topic cards in `topics/` | 469 |
| Entries in `index.json` | 469 |
| Bible book files in `by-reference/` | 66 / 66 |
| Books with mapped background references | 66 / 66 |
| Mapped verse keys | 7669 |
| Total topic links from verse maps | 21416 |
| Categories represented | 119 |
| Key Scripture links inside topic cards | 1368 |
| Related-topic links inside topic cards | 1366 |
| Search terms in index | 7700 |
| Tags in index | 1819 |
| Missing topic references from by-reference maps | 0 |
| Orphan topic cards not mapped anywhere | 0 |
| Duplicate index IDs | 0 |
| Duplicate topic file IDs | 0 |
| Index entries missing topic files | 0 |
| Topic files missing from index | 0 |
| Bad topic JSON files | 0 |
| Bad by-reference rows | 0 |
| Related-topic links pointing to missing topics | 128 |

## Overall Validation

**Status:** REVIEW NEEDED — see validation sections below.

Validation rules used:

- Every `index.json` entry must point to a real file in `topics/`.
- Every topic file must be represented in `index.json`.
- Every by-reference topic ID must resolve to a topic file.
- Every topic must be mapped from at least one by-reference verse key.
- All 66 Bible books must have a by-reference JSON file.
- No duplicate topic IDs or index IDs should exist.
- Topic-card related topics should resolve to real topic IDs.

## Phase Coverage

| Phase / Content Group | Topic Cards |
|---|---:|
| Earlier / untagged foundation | 98 |
| Phase 1 | 46 |
| Phase 3 | 113 |
| Phase 4 | 93 |
| Phase 5 | 119 |

## Topic Count by Category

| Category | Topic Cards |
|---|---:|
| Agriculture and Work | 34 |
| Temple and Worship | 22 |
| Family and Household | 17 |
| Roman World | 16 |
| Church and Assembly | 13 |
| Travel and Geography | 13 |
| Daily Life and Household | 12 |
| Law and Covenant Life | 11 |
| Places and Geography | 11 |
| Government and Legal Life | 10 |
| Jewish Life and Worship | 9 |
| Land and Geography | 9 |
| Social Life and Economy | 9 |
| Tabernacle and Temple | 9 |
| Commerce and Wealth | 7 |
| Daily Life and Occupations | 7 |
| Daily Life and Society | 7 |
| Occupations and Work | 7 |
| Prophets and Revelation | 7 |
| Royal and Legal Life | 7 |
| Apocalyptic and Prophetic Imagery | 6 |
| Cities and Public Life | 6 |
| Feasts and Worship | 6 |
| Family and Marriage | 5 |
| Family and Social Life | 5 |
| Food and Daily Life | 5 |
| Homes and Daily Life | 5 |
| Household Life | 5 |
| Pagan Religion and Idolatry | 5 |
| War and Conflict | 5 |
| Worship and Sacrifice | 5 |
| Clothing and Appearance | 4 |
| Daily Life and Clothing | 4 |
| Daily Life and Social Life | 4 |
| Death and Mourning | 4 |
| Food and Table Fellowship | 4 |
| Justice and Mercy | 4 |
| Kings and Government | 4 |
| Money and Measures | 4 |
| Purity and Cleanliness | 4 |
| Scripture and Learning | 4 |
| Social Life and Relationships | 4 |
| Synagogue and Jewish Life | 4 |
| Temple and Priesthood | 4 |
| Trade and Economy | 4 |
| Warfare and Protection | 4 |
| Burial and Death | 3 |
| Covenant and Promise | 3 |
| Fishing and Sea Life | 3 |
| Greek and Roman World | 3 |
| Groups and Leaders | 3 |
| Idolatry and Worship | 3 |
| Law and Civic Life | 3 |
| Meals and Hospitality | 3 |
| Places and Nations | 3 |
| Places and Roman World | 3 |
| Teaching and Learning | 3 |
| Worship and Public Signals | 3 |
| Communication and Travel | 2 |
| Daily Life and Sickness | 2 |
| Daily Life and Time | 2 |
| Documents and Authority | 2 |
| Early Church Life | 2 |
| Economy and Measures | 2 |
| Family and Covenant Identity | 2 |
| Jewish Groups and Politics | 2 |
| Land and Daily Life | 2 |
| Law and Worship | 2 |
| Materials and Construction | 2 |
| Places and Greek World | 2 |
| Places and Public Life | 2 |
| Prophets and Messengers | 2 |
| Purity and Healing | 2 |
| Vows and Dedication | 2 |
| Writing and Records | 2 |
| Angels and Sacred Space | 1 |
| Animals and Travel | 1 |
| Church and Community | 1 |
| Covenant and Family | 1 |
| Covenants and Agreements | 1 |
| Covenants and Identity | 1 |
| Daily Life and Community | 1 |
| Daily Life and Family | 1 |
| Daily Life and Food | 1 |
| Daily Life and Travel | 1 |
| Daily Life and Warfare | 1 |
| Death and Burial | 1 |
| Government and Social Life | 1 |
| Greek World | 1 |
| Healing and Mercy | 1 |
| Healing and Purity | 1 |
| Household and Economy | 1 |
| Household and Work | 1 |
| Idolatry and Spiritual Realm | 1 |
| Jewish Life and Geography | 1 |
| Jewish and Gentile Background | 1 |
| Kings and Worship | 1 |
| Last Things and Hope | 1 |
| Law and Government | 1 |
| Military and Spiritual Imagery | 1 |
| Mourning and Lament | 1 |
| Nations and Gentile Background | 1 |
| Pagan Worship and Culture | 1 |
| Peoples and Nations | 1 |
| Places and Imagery | 1 |
| Places and Jerusalem | 1 |
| Places and Peoples | 1 |
| Places and Worship | 1 |
| Prophets and Judgment | 1 |
| Public Decision and Guidance | 1 |
| Social Customs | 1 |
| Social Life and Mercy | 1 |
| Teaching and Discipleship | 1 |
| Temple and Economy | 1 |
| Wilderness and Provision | 1 |
| Worship and Devotion | 1 |
| Worship and Giving | 1 |
| Worship and Memory | 1 |
| Worship and Prayer | 1 |

## By-Reference Coverage by Bible Book

| Book | Mapped Verse Keys | Topic Links | Unique Topics Used |
|---|---:|---:|---:|
| Genesis | 475 | 1456 | 67 |
| Exodus | 408 | 1090 | 82 |
| Leviticus | 482 | 1604 | 56 |
| Numbers | 254 | 496 | 36 |
| Deuteronomy | 136 | 310 | 57 |
| Joshua | 221 | 373 | 25 |
| Judges | 50 | 95 | 10 |
| Ruth | 75 | 352 | 21 |
| 1 Samuel | 122 | 325 | 17 |
| 2 Samuel | 106 | 196 | 21 |
| 1 Kings | 174 | 636 | 25 |
| 2 Kings | 110 | 214 | 14 |
| 1 Chronicles | 125 | 125 | 6 |
| 2 Chronicles | 80 | 215 | 12 |
| Ezra | 31 | 64 | 12 |
| Nehemiah | 81 | 187 | 19 |
| Esther | 52 | 145 | 16 |
| Job | 18 | 25 | 8 |
| Psalms | 22 | 48 | 11 |
| Proverbs | 40 | 46 | 14 |
| Ecclesiastes | 79 | 85 | 6 |
| Song of Solomon | 50 | 51 | 2 |
| Isaiah | 127 | 234 | 41 |
| Jeremiah | 134 | 163 | 25 |
| Lamentations | 5 | 6 | 2 |
| Ezekiel | 200 | 359 | 18 |
| Daniel | 124 | 249 | 23 |
| Hosea | 26 | 47 | 9 |
| Joel | 8 | 21 | 6 |
| Amos | 15 | 39 | 11 |
| Obadiah | 21 | 35 | 3 |
| Jonah | 26 | 62 | 8 |
| Micah | 10 | 21 | 8 |
| Nahum | 47 | 73 | 3 |
| Habakkuk | 19 | 21 | 3 |
| Zephaniah | 22 | 26 | 4 |
| Haggai | 25 | 45 | 5 |
| Zechariah | 37 | 77 | 8 |
| Malachi | 40 | 49 | 5 |
| Matthew | 603 | 2024 | 175 |
| Mark | 311 | 963 | 84 |
| Luke | 610 | 2062 | 161 |
| John | 484 | 1855 | 89 |
| Acts | 603 | 2225 | 119 |
| Romans | 87 | 183 | 31 |
| 1 Corinthians | 111 | 224 | 28 |
| 2 Corinthians | 26 | 50 | 12 |
| Galatians | 30 | 70 | 13 |
| Ephesians | 57 | 179 | 25 |
| Philippians | 18 | 31 | 12 |
| Colossians | 22 | 50 | 13 |
| 1 Thessalonians | 20 | 24 | 8 |
| 2 Thessalonians | 28 | 47 | 5 |
| 1 Timothy | 30 | 84 | 10 |
| 2 Timothy | 8 | 18 | 9 |
| Titus | 12 | 22 | 6 |
| Philemon | 16 | 73 | 7 |
| Hebrews | 124 | 539 | 42 |
| James | 36 | 98 | 31 |
| 1 Peter | 45 | 97 | 19 |
| 2 Peter | 12 | 14 | 5 |
| 1 John | 15 | 26 | 6 |
| 2 John | 13 | 22 | 4 |
| 3 John | 15 | 36 | 6 |
| Jude | 2 | 4 | 2 |
| Revelation | 254 | 731 | 68 |

## Source Manifest Summary

Sources are documented centrally. Per-topic source pools are intentionally not displayed in the user-facing panels.

**Source display policy:** Sources are documented centrally in this manifest and not shown inside user-facing topic cards.

**Use policy:** Topic cards are original teaching-friendly paraphrases grounded in public-domain background sources. No modern copyrighted Bible background resources are used.

Public-domain source pool:

- James M. Freeman, Hand-book of Bible Manners and Customs (public-domain editions).
- Alfred Edersheim, Sketches of Jewish Social Life in the Days of Christ (1876).
- Alfred Edersheim, The Temple: Its Ministry and Services as They Were at the Time of Jesus Christ (1881).
- International Standard Bible Encyclopedia, original 1915 edition.
- Smith's Bible Dictionary, public-domain edition.
- Easton's Bible Dictionary, public-domain edition.
- Treasury of Scripture Knowledge, public-domain cross-reference source used only for internal reference strengthening where applicable.

## File Structure Expected in GitHub

```text
bible/resources/backgrounds/
  BACKGROUNDS_MASTER_REPORT.md
  SOURCE_MANIFEST.json
  index.json

  topics/
    *.json

  by-reference/
    Genesis.json
    Exodus.json
    ...
    Revelation.json
```

## Files Not Needed for the Final GitHub Resource

The following files were useful while building phases, but they are not required for the final project tracking if this master report is used:

- `_AUDIT_BACKGROUNDS_PHASE1.csv`
- `_AUDIT_BACKGROUNDS_PHASE2.csv`
- `_AUDIT_BACKGROUNDS_PHASE3.csv`
- `_AUDIT_BACKGROUNDS_PHASE4.csv`
- `_AUDIT_BACKGROUNDS_PHASE5.csv`
- `BACKGROUNDS_MASTER_AUDIT.csv`
- `BACKGROUNDS_MASTER_AUDIT.json`
- Phase-specific readme files, unless you want to keep them for history.

The final resource only needs the actual database files plus this report and the source manifest.

## Validation Details

### Missing topic references from by-reference maps

None found.

### Orphan topic cards not mapped anywhere

None found.

### Duplicate index IDs

None found.

### Duplicate topic file IDs

None found.

### Index entries missing topic files

None found.

### Topic files missing from index

None found.

### Missing by-reference book files

None found.

### Related-topic links pointing to missing topics

- `agricultural-seasons`
- `agriculture`
- `angels`
- `arrows`
- `atonement`
- `authority`
- `baptism`
- `blood-and-atonement`
- `burdens`
- `calling-disciples`
- `charcoal-fire`
- `church-discipline`
- `church-mission`
- `clothing-and-appearance`
- `consecration`
- `courts`
- `covenant-love`
- `covenant-mercy`
- `covenant-promise`
- `covenant-renewal`
- `curse`
- `deliverance`
- `discernment`
- `divorce`
- `documents`
- `eden`
- `exile-and-deportation`
- `exile-and-return`
- `faith`
- `false-teachers`
- `family-headship`
- `famine`
- `feasts`
- `food-in-the-wilderness`
- `foreigners`
- `fortified-cities`
- `fruitfulness`
- `gardens`
- `gentile-background`
- `gospel-typology`
- `guards`
- `healing`
- `holy-spirit`
- `household-honor`
- `household-life`
- `inheritance`
- `intercession`
- `israel`
- `jerusalem`
- `judgment`
- `judgment-imagery`
- `justice-at-the-gate`
- `kingdom-parables`
- `kingship`
- `kinship`
- `lamb-of-god`
- `lament`
- `last-supper`
- `lebanon`
- `legal-disputes`
- `light`
- `meals`
- `mission`
- `money`
- `money-and-coins`
- `mountains`
- `mourning`
- `musical-instruments`
- `nations-around-israel`
- `neighbor-love`
- `occupations`
- `oil-lamps`
- `olive-trees`
- `palaces`
- `pasture`
- `paul`
- `perseverance`
- `pilgrimage`
- `prayer`
- `promised-land`
- `prophetic-judgment`
- `psalms`
- `public-disgrace`
- `public-life`
- `public-witness`
- `purity`
- `purity-customs`
- `redemption`
- `reform`
- `repentance`
- `repentance-customs`
- `restoration`
- `resurrection`
- `rod-and-staff`
- `roman-law`
- `roman-world`
- `royal-palaces`
- `sabbath-commerce`
- `sackcloth`
- `scrolls`
- `seeking-gods-guidance`
- `servant-leadership`
- `shields`
- `signs`
- `sonship`
- `speech-and-oaths`
- `spirit`
- `spiritual-conflict`
- `spiritual-warfare`
- `storehouses`
- `strangers`
- `suffering`
- `tabernacle`
- `teaching-authority`
- `temple-construction`
- `temple-rebuilding`
- `trade`
- `travel`
- `travel-provisions`
- `tree-imagery`
- `trees-and-fruit`
- `trust-in-god`
- `waiting-on-the-lord`
- `warfare`
- `wine`
- `work-and-calling`
- `worship`
- `zachaeus-tax-context`

### Bad topic JSON files

None found.

### Bad by-reference rows

None found.

## Lock Recommendation

This resource is ready for final spot-testing. If the sample passages display expected topic cards and no missing-topic panels appear, Bible Backgrounds & Customs can be considered ready to lock.

Suggested final tests:

- Genesis 24:1-67
- Leviticus 16:1-34
- Ruth 3:1-18
- Matthew 13:1-23
- Luke 4:16-20
- John 10:1-18
- Acts 17:16-34
- Ephesians 6:10-18
- Hebrews 9:1-14
- Revelation 5:1-10
