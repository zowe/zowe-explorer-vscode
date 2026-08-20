/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

// This script points npm at a private registry to run `npm audit`, and with --fix it replays
// the upgrades npm picks into yarn.lock.
//
//   node scripts/auditPrivate.js [registryUrl] [--fix] [--force] [--dry-run] [<npm audit args>]
//
// npm audit requires a package-lock.json, but this repo uses Yarn, so one is generated on the
// fly (via `npm install --package-lock-only`) and removed afterwards. Two things are reconciled
// while that runs, so the audit describes the tree Yarn installs rather than one npm invented:
//   - Yarn `resolutions` are mirrored into npm `overrides`, since npm ignores `resolutions` and
//     would otherwise re-report vulnerabilities this repo has already pinned away;
//   - the yarn.lock that npm rewrites to "stay in sync" is restored afterwards, so an audit never
//     leaves the repo dirty and only Yarn ever authors a real yarn.lock change.
//
// --fix runs `npm audit fix --package-lock-only` (pass --force to allow semver-major upgrades,
// exactly like npm) and then lands the outcome in yarn.lock:
//   1. dependency ranges npm rewrote in a package.json are kept;
//   2. yarn.lock entries for packages npm upgraded are dropped, since Yarn only re-resolves a
//      dependency whose entry is missing;
//   3. `yarn install` (through installPrivate.js, which owns the registry swap) rewrites yarn.lock.
// Vulnerabilities that survive are listed at the end: in Yarn 1 those need a `resolutions` entry.
// Add --dry-run to see the plan (steps 1 and 2) without writing anything.
//
// Flags this script does not define are passed straight through to `npm audit`, so the usual
// filters work: --omit=dev audits runtime dependencies only (--production is the deprecated alias
// for it, which npm still honours but warns about), while --audit-level=high sets the exit-code
// threshold without shortening the report. Neither reaches the repair: `npm audit fix` always runs
// over the whole tree, so `--omit=dev --fix` reports runtime dependencies but fixes dev ones too.
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const npmLockPath = "package-lock.json";
const yarnLockPath = "yarn.lock";
const manifestName = "package.json";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
    console.log(
        [
            "Usage: node scripts/auditPrivate.js [registryUrl] [--fix] [--force] [--dry-run] [<npm audit args>]",
            "",
            "  registryUrl  private registry to audit against (default: `npm config get registry`)",
            "  --fix        apply `npm audit fix` and write the resulting upgrades to yarn.lock",
            "  --force      with --fix, allow semver-major upgrades (as `npm audit fix --force`)",
            "  --dry-run    with --fix, report what would change without writing anything",
            "",
            "Any other flag is forwarded to `npm audit`, so the usual filters work:",
            "  --omit=dev          audit runtime dependencies only. --production is the",
            "                      deprecated alias: npm honours it but warns to use --omit=dev",
            "  --audit-level=high  exit non-zero only for high or worse. This is an exit-code",
            "                      threshold, not a filter: the report still lists every advisory",
            "",
            "Those filters shape the report, not the repair. `npm audit fix` always runs over the",
            "whole tree, so `--omit=dev --fix` reports runtime deps while fixing dev deps too.",
        ].join("\n")
    );
    process.exit(0);
}

const shouldFix = args.includes("--fix");
const allowMajor = args.includes("--force");
const dryRun = args.includes("--dry-run");
const ownFlags = ["--fix", "--force", "--dry-run"];
const auditArgs = args.filter((arg) => arg.startsWith("-") && !ownFlags.includes(arg));
const privateUrl =
    args.find((arg) => !arg.startsWith("-")) ||
    childProcess
        .execSync("npm config get registry", {
            env: { ...process.env, npm_config_registry: "" },
        })
        .toString()
        .trim();

if (!fs.existsSync(yarnLockPath)) {
    console.error(`Run this script from the repo root: no ${yarnLockPath} in ${process.cwd()}`);
    process.exit(1);
}

const npmEnv = {
    ...process.env,
    npm_config_registry: privateUrl,
    npm_config_always_auth: "true",
};

/** Runs an npm subcommand against the private registry and returns its exit status. */
function npm(subcommand, { tolerateFailure = false } = {}) {
    console.log(`\n> npm ${subcommand}`);
    try {
        childProcess.execSync(`npm ${subcommand}`, { env: npmEnv, stdio: "inherit" });
        return 0;
    } catch (err) {
        const status = typeof err.status === "number" ? err.status : 1;
        if (!tolerateFailure) throw err;
        return status;
    }
}

/**
 * Builds package-lock.json from package.json and yarn.lock alone. Any lockfile already on disk is
 * removed first, because npm keeps versions that are pinned there and still satisfy their range:
 * a lockfile left behind by an earlier --fix run would otherwise make the audit describe a tree
 * that Yarn never installed, under-reporting the vulnerabilities that are really in yarn.lock.
 */
function generateNpmLock() {
    fs.rmSync(npmLockPath, { force: true });
    npm("install --package-lock-only --ignore-scripts");
}

/** `npm audit --json`, which exits non-zero whenever it finds anything, so the report is read off stdout. */
function auditReport() {
    const command = ["npm audit --json", ...auditArgs].join(" ");
    console.log(`\n> ${command}`);
    let output;
    try {
        output = childProcess.execSync(command, { env: npmEnv, encoding: "utf-8", stdio: ["ignore", "pipe", "inherit"] });
    } catch (err) {
        if (!err.stdout) throw err;
        output = err.stdout;
    }
    try {
        return JSON.parse(output);
    } catch {
        console.error("Could not parse the audit report as JSON.");
        return {};
    }
}

// Yarn resolution keys are paths ("@zowe/cli/@zowe/imperative/markdown-it"); npm expresses the
// same thing as nested `overrides` objects. Scoped names count as a single path segment.
function specifierSegments(key) {
    const parts = key.replace(/^\*\*\//, "").split("/");
    const segments = [];
    while (parts.length > 0) {
        const part = parts.shift();
        segments.push(part.startsWith("@") && parts.length > 0 ? `${part}/${parts.shift()}` : part);
    }
    return segments;
}

function resolutionsToOverrides(resolutions) {
    const overrides = {};
    for (const [key, range] of Object.entries(resolutions || {})) {
        const segments = specifierSegments(key);
        let node = overrides;
        segments.forEach((segment, index) => {
            if (index === segments.length - 1) {
                // "." is how npm pins a package that also has nested overrides of its own
                if (typeof node[segment] === "object") node[segment]["."] = range;
                else node[segment] = range;
            } else {
                if (typeof node[segment] !== "object") node[segment] = node[segment] ? { ".": node[segment] } : {};
                node = node[segment];
            }
        });
    }
    return overrides;
}

/**
 * Runs `action` with this repo's Yarn `resolutions` mirrored into npm `overrides`, then takes the
 * mirrored overrides back out. Dependency ranges npm rewrites in the meantime (what `npm audit fix`
 * does) are kept, and package.json is left byte-identical when npm changed nothing.
 */
function withMirroredResolutions(action) {
    const originalText = fs.readFileSync(manifestName, "utf-8");
    const original = JSON.parse(originalText);
    const overrides = resolutionsToOverrides(original.resolutions);

    if (Object.keys(overrides).length > 0) {
        // hand-written overrides win over mirrored resolutions
        const mirrored = { ...original, overrides: { ...overrides, ...original.overrides } };
        fs.writeFileSync(manifestName, `${JSON.stringify(mirrored, null, 2)}\n`);
    }
    try {
        return action();
    } finally {
        const current = JSON.parse(fs.readFileSync(manifestName, "utf-8"));
        if ("overrides" in original) current.overrides = original.overrides;
        else delete current.overrides;
        const untouched = JSON.stringify(current) === JSON.stringify(original);
        fs.writeFileSync(manifestName, untouched ? originalText : `${JSON.stringify(current, null, 2)}\n`);
    }
}

/**
 * npm rewrites an existing yarn.lock as a side effect of `npm install --package-lock-only`, to keep
 * both lockfiles in sync. Reading yarn.lock is what makes the audit reflect the tree Yarn actually
 * installs, so the read is wanted, but the rewrite reorders and merges every entry and is thrown
 * away here: --fix edits yarn.lock deliberately further down, through Yarn itself.
 */
function withPreservedYarnLock(action) {
    const original = fs.readFileSync(yarnLockPath, "utf-8");
    try {
        return action();
    } finally {
        if (fs.readFileSync(yarnLockPath, "utf-8") !== original) fs.writeFileSync(yarnLockPath, original);
    }
}

/** Every package name in package-lock.json mapped to the set of versions the tree installs. */
function npmLockVersions() {
    const nodeModules = "node_modules/";
    const versions = new Map();
    for (const [location, entry] of Object.entries(JSON.parse(fs.readFileSync(npmLockPath, "utf-8")).packages || {})) {
        const marker = location.lastIndexOf(nodeModules);
        if (marker < 0 || entry.link || !entry.version) continue;
        const name = location.slice(marker + nodeModules.length);
        if (!versions.has(name)) versions.set(name, new Set());
        versions.get(name).add(entry.version);
    }
    return versions;
}

/** Fingerprints the root and workspace manifests, ignoring the `overrides` this script injects. */
function manifestFingerprints() {
    const workspaces = Object.keys(JSON.parse(fs.readFileSync(npmLockPath, "utf-8")).packages || {}).filter(
        (location) => location && !location.includes("node_modules/")
    );
    const fingerprints = new Map();
    for (const file of [manifestName, ...workspaces.map((dir) => path.join(dir, manifestName))]) {
        if (!fs.existsSync(file)) continue;
        const manifest = JSON.parse(fs.readFileSync(file, "utf-8"));
        delete manifest.overrides;
        fingerprints.set(file, JSON.stringify(manifest));
    }
    return fingerprints;
}

// yarn.lock v1 is a flat list of blocks: an unindented `<name>@<range>[, <name>@<range>]:` header
// followed by indented lines. Blocks are kept as raw lines so untouched ones round-trip exactly.
function parseYarnLock() {
    const lines = fs.readFileSync(yarnLockPath, "utf-8").split("\n");
    const preamble = [];
    const blocks = [];
    let index = 0;
    while (index < lines.length && (lines[index].startsWith("#") || lines[index].trim() === "")) {
        preamble.push(lines[index++]);
    }
    while (index < lines.length) {
        const header = lines[index++];
        const body = [];
        while (index < lines.length && (lines[index].startsWith(" ") || lines[index].trim() === "")) {
            body.push(lines[index++]);
        }
        const version = body.map((line) => line.trim().match(/^version\s+"?([^"]+)"?$/)).find(Boolean);
        blocks.push({ name: entryName(header), version: version && version[1], lines: [header, ...body] });
    }
    return { preamble, blocks };
}

function entryName(header) {
    const [firstSpec] = header.replace(/:\s*$/, "").split(",");
    const spec = firstSpec.trim().replace(/^"|"$/g, "");
    const at = spec.lastIndexOf("@");
    return at > 0 ? spec.slice(0, at) : spec;
}

function yarnLockVersions() {
    const versions = new Map();
    for (const block of parseYarnLock().blocks) {
        if (!block.version) continue;
        if (!versions.has(block.name)) versions.set(block.name, new Set());
        versions.get(block.name).add(block.version);
    }
    return versions;
}

/** Names whose installed version set gained something between two lockfile reads. */
function upgradedPackages(before, after) {
    const upgraded = new Map();
    for (const [name, versions] of after) {
        const previous = before.get(name);
        if (!previous || [...versions].some((version) => !previous.has(version))) upgraded.set(name, versions);
    }
    return upgraded;
}

function describeUpgrades(before, after) {
    const described = [];
    for (const [name, versions] of upgradedPackages(before, after)) {
        const previous = before.get(name) || new Set();
        const added = [...versions].filter((version) => !previous.has(version));
        const removed = [...previous].filter((version) => !versions.has(version));
        described.push(`  ${name}: ${removed.join(", ") || "(added)"} -> ${added.join(", ")}`);
    }
    return described.sort();
}

/** Drops the yarn.lock entries npm replaced, so `yarn install` re-resolves those ranges. */
function dropUpgradedEntries(upgraded, { pretend = false } = {}) {
    const lockfile = parseYarnLock();
    const dropped = [];
    const blocks = lockfile.blocks.filter((block) => {
        const wanted = upgraded.get(block.name);
        if (!wanted || !block.version || wanted.has(block.version)) return true;
        dropped.push(`${block.name}@${block.version}`);
        return false;
    });
    if (dropped.length > 0 && !pretend) {
        fs.writeFileSync(yarnLockPath, [...lockfile.preamble, ...blocks.flatMap((block) => block.lines)].join("\n"));
    }
    return dropped.sort();
}

function reportRemaining(report) {
    const totals = (report.metadata && report.metadata.vulnerabilities) || {};
    if (!totals.total) {
        console.log("\nNo known vulnerabilities remain.");
        return;
    }
    const summary = Object.entries(totals)
        .filter(([severity, count]) => severity !== "total" && count > 0)
        .map(([severity, count]) => `${count} ${severity}`)
        .join(", ");
    console.log(`\n${totals.total} vulnerabilit${totals.total === 1 ? "y" : "ies"} remain (${summary}).`);
    console.log(`Yarn 1 can only force a transitive upgrade through "resolutions" in ${manifestName}:`);
    for (const vulnerability of Object.values(report.vulnerabilities || {})) {
        const fixAvailable = vulnerability.fixAvailable;
        const hint =
            fixAvailable === true
                ? "npm can reach it in a nested tree, Yarn cannot: pin it"
                : fixAvailable && typeof fixAvailable === "object"
                ? `needs ${fixAvailable.name}@${fixAvailable.version}${fixAvailable.isSemVerMajor ? " (semver-major, needs --force)" : ""}`
                : "no fix published";
        console.log(`  ${String(vulnerability.severity).padEnd(8)} ${vulnerability.name} ${vulnerability.range} - ${hint}`);
    }
}

const npmLockExisted = fs.existsSync(npmLockPath);
const npmLockBackup = npmLockExisted ? fs.readFileSync(npmLockPath, "utf-8") : undefined;

try {
    if (!shouldFix) {
        withPreservedYarnLock(() =>
            withMirroredResolutions(() => {
                generateNpmLock();
                process.exitCode = npm(["audit", ...auditArgs].join(" "), { tolerateFailure: true });
            })
        );
    } else {
        const yarnLockBefore = yarnLockVersions();
        let manifestsBefore;
        let manifestsAfter;
        let upgraded;

        withPreservedYarnLock(() =>
            withMirroredResolutions(() => {
                generateNpmLock();
                manifestsBefore = manifestFingerprints();
                const before = npmLockVersions();
                npm(`audit fix --package-lock-only --ignore-scripts${allowMajor ? " --force" : ""}`, { tolerateFailure: true });
                upgraded = upgradedPackages(before, npmLockVersions());
                manifestsAfter = manifestFingerprints();
            })
        );

        const editedManifests = [...manifestsAfter.keys()].filter((file) => manifestsBefore.get(file) !== manifestsAfter.get(file));
        const dropped = dropUpgradedEntries(upgraded, { pretend: dryRun });

        if (dropped.length === 0 && editedManifests.length === 0) {
            console.log("\n`npm audit fix` found nothing to change, so yarn.lock is untouched.");
        } else if (dryRun) {
            console.log("\n--dry-run, so nothing was written. `--fix` would:");
            if (editedManifests.length > 0) console.log(`  rewrite dependency ranges in: ${editedManifests.join(", ")}`);
            if (dropped.length > 0) {
                console.log(`  drop ${dropped.length} yarn.lock entries: ${dropped.join(", ")}`);
            }
            console.log("  then run `yarn install`, so Yarn re-resolves those ranges and rewrites yarn.lock");
        } else {
            if (editedManifests.length > 0) {
                console.log(`\nnpm rewrote dependency ranges in: ${editedManifests.join(", ")}`);
            }
            if (dropped.length > 0) {
                console.log(`\nDropped ${dropped.length} yarn.lock entries, so Yarn re-resolves them:`);
                dropped.forEach((entry) => console.log(`  ${entry}`));
            }
            // Lifecycle scripts are skipped here: this install only exists to rewrite yarn.lock.
            childProcess.execSync(`node "${path.join(__dirname, "installPrivate.js")}" "${privateUrl}"`, {
                env: { ...process.env, YARN_IGNORE_SCRIPTS: "true" },
                stdio: "inherit",
            });

            const changes = describeUpgrades(yarnLockBefore, yarnLockVersions());
            console.log(changes.length > 0 ? `\nyarn.lock now installs:\n${changes.join("\n")}` : "\nyarn.lock ended up unchanged.");
        }

        // re-audit the tree Yarn just wrote, to show what --fix could not reach
        if (!dryRun) {
            withPreservedYarnLock(() =>
                withMirroredResolutions(() => {
                    generateNpmLock();
                    reportRemaining(auditReport());
                })
            );
        }
    }
} catch (err) {
    console.error(`\n${err.message}`);
    process.exitCode = typeof err.status === "number" ? err.status : 1;
} finally {
    if (npmLockExisted) fs.writeFileSync(npmLockPath, npmLockBackup);
    else fs.rmSync(npmLockPath, { force: true });
}
