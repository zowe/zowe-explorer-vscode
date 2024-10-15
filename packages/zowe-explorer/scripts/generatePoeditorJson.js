/**
 * Merges package.nls.json and bundle.l10n.json into a key-value JSON file that
 * can be imported into POEditor. Run this script without any arguments to
 * merge l10n templates, or specify a language ID to merge translation files.
 */

const fs = require("fs");
const langId = process.argv.slice(2).find(arg => !arg.startsWith("-"));
const fileSuffix = langId ? `${langId}.json` : "json";
const poeditorJson = {};
const packageNls = require(__dirname + "/../package.nls." + fileSuffix);
for (const [k, v] of Object.entries(packageNls)) {
    if (!langId) {
        poeditorJson[k] = { [v]: "" };
    } else {
        poeditorJson[k] = packageNls[k] ? { [v]: packageNls[k] } : undefined;
    }
}
const l10nBundle = require(__dirname + "/../l10n/bundle.l10n." + fileSuffix);
for (const [k, v] of Object.entries(l10nBundle)) {
    if (!langId) {
        poeditorJson[typeof v === "string" ? k : v.message] = "";
    } else {
        poeditorJson[typeof v === "string" ? k : v.message] = l10nBundle[k]?.message || l10nBundle[k];
    }
}
fs.writeFileSync(__dirname + "/../l10n/poeditor." + fileSuffix, JSON.stringify(poeditorJson, null, 2) + "\n");

if (process.argv.includes("--strip")) {
    // Strip comments out of bundle.l10n.json and sort properties by key
    const jsonFilePath = __dirname + "/../l10n/bundle.l10n.json";
    let l10nBundle = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));
    for (const [k, v] of Object.entries(l10nBundle)) {
        if (typeof v === "object") {
            l10nBundle[k] = l10nBundle[k].message;
        }
    }
    l10nBundle = Object.fromEntries(Object.entries(l10nBundle).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(jsonFilePath, JSON.stringify(l10nBundle, null, 2) + "\n");
}
