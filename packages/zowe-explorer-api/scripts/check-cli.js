/**
 * Script to scan for the required @zowe/cli dependency for zowe-explorer-api.
 */

const { readdirSync } = require("fs");
const { join, resolve } = require("path");
const { exit } = require("process");

const logWithPrefix = (msg) => console.log(`[Zowe Explorer API] ${msg}`);

// Looks for the scoped @zowe folder & inner "cli" module folder in node_modules
const findCli = (folderToScan) => {
    const nodeModuleDirs = readdirSync(folderToScan);
    if (nodeModuleDirs.find((d) => d === "@zowe")) {
        const scopedModulePath = join(folderToScan, "@zowe");
        const scopedModuleDirs = readdirSync(scopedModulePath);
        if (scopedModuleDirs.find((d) => d === "cli")) {
            logWithPrefix("OK ✔ @zowe/cli was found in node_modules");
            exit(0);
        }
    }

    logWithPrefix("ERR ✘ @zowe/cli was not found in node_modules");
    exit(1);
};

logWithPrefix("Checking for @zowe/cli in node_modules...");

if (__dirname.includes("packages") && __dirname.includes("scripts")) {
    // Within the API scripts folder of the monorepo
    findCli(resolve(__dirname, "../../../node_modules"));
} else if (__dirname.includes("packages")) {
    // Within the context of the monorepo
    findCli(resolve(__dirname, "../../node_modules"));
} else if (__dirname.includes("node_modules")) {
    findCli(resolve(__dirname, "../../"));
} else {
    findCli(__dirname);
}
