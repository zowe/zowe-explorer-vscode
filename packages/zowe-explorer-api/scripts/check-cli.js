/**
 * Script to scan for the required @zowe/cli dependency for zowe-explorer-api.
 */

const { resolve } = require("path");
const { exit } = require("process");

const logWithPrefix = (msg) => console.log(`[Zowe Explorer API] ${msg}`);

// Looks for the scoped @zowe folder & inner "cli" module folder in node_modules
const findCli = (folderToScan) => {
    const resolvedModule = require.resolve("@zowe/cli", {
        paths: [folderToScan],
    });

    if (resolvedModule.includes(folderToScan)) {
        logWithPrefix("OK ✔ @zowe/cli was found in node_modules");
        return 0;
    }

    logWithPrefix("ERR ✘ @zowe/cli was not found in node_modules");
    return 1;
};

logWithPrefix("Checking for @zowe/cli in node_modules...");

let exitCode = 0;
if (__dirname.includes("packages") || __dirname.includes("scripts")) {
    // Modify starting path to point to zowe-explorer-api folder
    exitCode = findCli(resolve(__dirname, "../../../"));
} else {
    exitCode = findCli(__dirname);
}

exit(exitCode);
