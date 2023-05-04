/**
 * Script to scan for the required @zowe/cli dependency for zowe-explorer-api.
 */

const { resolve } = require("path");
const { exit } = require("process");

// Looks for the scoped @zowe folder & inner "cli" module folder in node_modules
const findCli = (folderToScan) => {
    const resolvedModule = require.resolve("@zowe/cli", {
        paths: [folderToScan],
    });

    if (resolvedModule.includes(folderToScan)) {
        console.log("[Zowe Explorer API] OK ✔ @zowe/cli was found in node_modules");
        return 0;
    }

    console.error("[Zowe Explorer API] ERR ✘ @zowe/cli was not found in node_modules");
    return 1;
};

console.log("[Zowe Explorer API] Checking for @zowe/cli in node_modules...");

let exitCode = 0;
if (__dirname.includes("packages") || __dirname.includes("scripts")) {
    // Modify starting path to point to zowe-explorer-api folder
    exitCode = findCli(resolve(__dirname, "../../../"));
} else {
    exitCode = findCli(__dirname);
}

exit(exitCode);
