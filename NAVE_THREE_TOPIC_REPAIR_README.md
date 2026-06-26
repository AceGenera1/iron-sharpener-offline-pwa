# Nave Three Topic Repair

This repair package restores these Nave topic files:

- bible/resources/topics/prayer.json
- bible/resources/topics/repentance.json
- bible/resources/topics/zechariah-zecharias.json
- bible/resources/topics/zacharias-zechariah.json
- bible/resources/topics/index.json

Upload `nave-three-topic-repair-v1.zip` to the repository root.
Add `import-nave-three-topic-repair.yml` to `.github/workflows/`.
Run **Actions → Repair Nave Missing Topics → Run workflow**.

After the workflow finishes, test Nave's Topical Bible again for:

- prayer
- repentance
- zechariah
