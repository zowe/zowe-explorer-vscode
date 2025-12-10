/**
 * Downloads user-contributed translations from POEditor project. This requires
 * the POEDITOR_TOKEN environment variable to be set. Each translation is split
 * into two files: package.nls.<lang>.json and bundle.l10n.<lang>.json. These
 * files use the format expected by vscode-l10n and can be bundled in a VSIX.
 */

const fs = require("fs");
const poeditorToken = process.env.POEDITOR_TOKEN;
const projectId = 698824;
const defaultHeaders = { "Content-Type": "application/x-www-form-urlencoded" };
(async () => {
    const listResponse = await fetch("https://api.poeditor.com/v2/languages/list", {
        method: "POST",
        body: `api_token=${poeditorToken}&id=${projectId}`,
        headers: defaultHeaders
    }).then(r => r.json()).catch(e => {
        console.error(`Error downloading languages list: ${e.message}`);
        console.error(`Response: ${JSON.stringify(e)}`);
        // process.exit(1);
    });
    if (listResponse.response?.status !== "success") {
        console.error(`Error downloading languages list: ${listResponse.response?.code} - ${listResponse.response?.message}`);
        console.error(`Response: ${JSON.stringify(listResponse.response)}`);

        // list contributors
        const contributorsResponse = await fetch("https://api.poeditor.com/v2/contributors/list", {
            method: "POST",
            body: `api_token=${poeditorToken}&id=${projectId}`,
            headers: defaultHeaders
        }).then(r => r.json())
        console.log(JSON.stringify(contributorsResponse, null, 2));

        // Adding zFernand0 to the project
        const addContributorResponse = await fetch("https://api.poeditor.com/v2/contributors/add", {
            method: "POST",
            body: `api_token=${poeditorToken}&id=${projectId}&email=fernando@rijo.dev&name=zFernand0`,
            headers: defaultHeaders
        }).then(r => r.json())
        console.log(JSON.stringify(addContributorResponse, null, 2));
        // process.exit(1);
    }
    for (const { code } of listResponse.result.languages.filter(lang => lang.percentage > 0)) {
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
        fs.writeFileSync(`${__dirname}/../package.nls.${code}.json`, JSON.stringify(packageNls, null, 2) + "\n");
        fs.writeFileSync(`${__dirname}/../l10n/bundle.l10n.${code}.json`, JSON.stringify(l10nBundle, null, 2) + "\n");
    }
})();
