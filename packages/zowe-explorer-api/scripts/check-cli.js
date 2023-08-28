/**
 * Script to scan for the required @zowe/cli dependency for zowe-explorer-api.
 */

const { resolve } = require("path");
const { exit } = require("process");

// Looks for the scoped @zowe folder & inner "cli" module folder in node_modules
const findPackage = (folderToScan, nodePackage) => {
    console.log(`[Zowe Explorer API] Checking for ${nodePackage} in node_modules...`);
    const resolvedModule = require.resolve(nodePackage, {
        paths: [folderToScan],
    });

    if (resolvedModule.includes(folderToScan)) {
        console.log(`[Zowe Explorer API] OK ✔ ${nodePackage} was found in node_modules`);
        return 0;
    }

    console.error(`[Zowe Explorer API] ERR ✘ ${nodePackage} was not found in node_modules`);
    return 1;
};

let exitCode = 0;
let nodePackages = ["@zowe/cli", "@zowe/secrets-for-zowe-sdk"];
nodePackages.forEach(element => {
    if (exitCode === 0) {
        if (__dirname.includes("packages") || __dirname.includes("scripts")) {
            // Modify starting path to point to zowe-explorer-api folder
            exitCode = findPackage(resolve(__dirname, "../../../"), element);
        } else {
            exitCode = findPackage(__dirname, element);
        }
    }
});

exit(exitCode);
