const fs = require("fs");
const poeditorToken = process.env.POEDITOR_TOKEN;
const projectId = 698824;
const defaultHeaders = { "Content-Type": "application/x-www-form-urlencoded" };
(async () => {
    const listResponse = await fetch("https://api.poeditor.com/v2/languages/list", {
        method: "POST",
        body: `api_token=${poeditorToken}&id=${projectId}`,
        headers: defaultHeaders
    }).then(r => r.json());
    for (const { code } of listResponse.result.languages) {
        const exportResponse = await fetch("https://api.poeditor.com/v2/projects/export", {
            method: "POST",
            body: `api_token=${poeditorToken}&id=${projectId}&language=${code}&type=key_value_json`,
            headers: defaultHeaders
        }).then(r => r.json());
        const packageNls = {};
        const l10nBundle = {};
        const l10nTemplate = require(__dirname + "/../l10n/bundle.l10n.json");
        for (const [k, v] of Object.entries(await fetch(exportResponse.result.url).then(r => r.json()))) {
            if (typeof v !== "string") {
                packageNls[k] = Object.values(v)[0] || undefined;
            } else {
                const message = Object.keys(l10nTemplate).find(k2 => l10nTemplate[k2].message === k) || k;
                l10nBundle[message] = v || undefined;
            }
        }
        fs.writeFileSync(`${__dirname}/../package.nls.${code}.json`, JSON.stringify(packageNls, null, 2));
        fs.writeFileSync(`${__dirname}/../l10n/bundle.l10n.${code}.json`, JSON.stringify(l10nBundle, null, 2));
    }
})();
