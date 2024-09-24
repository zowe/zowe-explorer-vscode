/**
 * Merges package.nls.json and bundle.l10n.json into a key-value JSON file that
 * can be imported into POEditor. Run this script without any arguments to
 * merge l10n templates, or specify a language ID to merge translation files.
 */

const fs = require("fs");
const langId = process.argv[2];
const poeditorJson = {};
const packageNls = require(__dirname + "/../package.nls.json");
if (!langId) {
    for (const [k, v] of Object.entries(packageNls)) {
        poeditorJson[k] = { [v]: "" };
    }
} else {
    const packageNls2 = require(__dirname + "/../package.nls." + langId + ".json");
    for (const [k, v] of Object.entries(packageNls)) {
        poeditorJson[k] = packageNls2[k] ? { [v]: packageNls2[k] } : undefined;
    }
}
const l10nBundle = require(__dirname + "/../l10n/bundle.l10n.json");
if (!langId) {
    for (const [k, v] of Object.entries(l10nBundle)) {
        poeditorJson[typeof v === "string" ? k : v.message] = "";
    }
} else {
    const l10nBundle2 = require(__dirname + "/../l10n/bundle.l10n." + langId + ".json");
    for (const [k, v] of Object.entries(l10nBundle)) {
        poeditorJson[typeof v === "string" ? k : v.message] = l10nBundle2[k]?.message || l10nBundle2[k];
    }
}
fs.writeFileSync(__dirname + "/../l10n/poeditor." + (langId ? `${langId}.json` : "json"), JSON.stringify(poeditorJson, null, 2) + "\n");
