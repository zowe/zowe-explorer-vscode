// Strip comments out of bundle.l10n.json and sort properties by key
const fs = require("fs");
const jsonFilePath = process.argv[2] || (__dirname + "/../l10n/bundle.l10n.json");
let l10nBundle = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));
for (const [k, v] of Object.entries(l10nBundle)) {
    if (typeof v === "object") {
        l10nBundle[k] = l10nBundle[k].message;
    }
}
l10nBundle = Object.fromEntries(Object.entries(l10nBundle).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(jsonFilePath + ".template", JSON.stringify(l10nBundle, null, 2) + "\n");
