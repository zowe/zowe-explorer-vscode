const fs = require("fs");
const poeditorJson = {};
const packageNls = require(__dirname + "/../package.nls.json");
for (const [k, v] of Object.entries(packageNls)) {
    poeditorJson[k] = { [v]: "" };
}
const l10nBundle = require(__dirname + "/../l10n/bundle.l10n.json");
for (const [k, v] of Object.entries(l10nBundle)) {
    poeditorJson[typeof v === "string" ? k : v.message] = "";
}
fs.writeFileSync(__dirname + "/../l10n/poeditor.json", JSON.stringify(poeditorJson, null, 2));
