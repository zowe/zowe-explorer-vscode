import fs from "node:fs";
import { execFileSync } from "node:child_process";

const LOCKFILE_PATH = "pnpm-lock.yaml";
const PACKAGE_JSON_PATH = "package.json";

function parseSimpleValue(value) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}

function parseLockfileSections(lockfileContent) {
  const lines = lockfileContent.split(/\r?\n/);
  const settings = {};
  const overrides = {};
  let section = "";

  for (const line of lines) {
    const topLevelMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*$/);
    if (topLevelMatch) {
      section = topLevelMatch[1];
      if (section === "importers") {
        break;
      }
      continue;
    }

    if (section === "settings") {
      const match = line.match(/^  ([^:]+):\s*(.*)$/);
      if (match) {
        settings[match[1].trim()] = parseSimpleValue(match[2].trim());
      }
      continue;
    }

    if (section === "overrides") {
      const match = line.match(/^  ([^:]+):\s*(.*)$/);
      if (match) {
        overrides[match[1].trim()] = match[2].trim();
      }
    }
  }

  return { settings, overrides };
}

function getProjectPnpmConfig() {
  const output = execFileSync("pnpm", ["config", "list", "--location", "project", "--json"], {
    encoding: "utf8",
  });

  return JSON.parse(output);
}

function readEffectiveBooleanConfig(config, envKey, fallbackValue, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(config, key) && config[key] !== undefined) {
      return parseSimpleValue(String(config[key]));
    }
  }

  if (process.env[envKey] !== undefined) {
    return parseSimpleValue(String(process.env[envKey]));
  }

  const lowercaseEnvKey = envKey.toLowerCase();
  if (process.env[lowercaseEnvKey] !== undefined) {
    return parseSimpleValue(String(process.env[lowercaseEnvKey]));
  }

  return fallbackValue;
}

function compareOverrides(packageOverrides, lockfileOverrides) {
  const mismatches = [];
  const keys = [...new Set([...Object.keys(packageOverrides), ...Object.keys(lockfileOverrides)])].sort();

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(packageOverrides, key)) {
      mismatches.push(`missing in package.json: ${key}=${lockfileOverrides[key]}`);
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(lockfileOverrides, key)) {
      mismatches.push(`missing in pnpm-lock.yaml: ${key}=${packageOverrides[key]}`);
      continue;
    }

    if (String(packageOverrides[key]) !== String(lockfileOverrides[key])) {
      mismatches.push(
        `override mismatch ${key}: package.json=${packageOverrides[key]} pnpm-lock.yaml=${lockfileOverrides[key]}`,
      );
    }
  }

  return mismatches;
}

function main() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const lockfileContent = fs.readFileSync(LOCKFILE_PATH, "utf8");
  const { settings: lockfileSettings, overrides: lockfileOverrides } = parseLockfileSections(lockfileContent);
  const packageOverrides = packageJson?.pnpm?.overrides ?? {};
  const projectConfig = getProjectPnpmConfig();

  const effectiveAutoInstallPeers = readEffectiveBooleanConfig(
    projectConfig,
    "NPM_CONFIG_AUTO_INSTALL_PEERS",
    true,
    ["auto-install-peers", "autoInstallPeers"],
  );
  const effectiveExcludeLinksFromLockfile = readEffectiveBooleanConfig(
    projectConfig,
    "NPM_CONFIG_EXCLUDE_LINKS_FROM_LOCKFILE",
    false,
    ["exclude-links-from-lockfile", "excludeLinksFromLockfile"],
  );

  const mismatches = [];
  mismatches.push(...compareOverrides(packageOverrides, lockfileOverrides));

  if (Object.prototype.hasOwnProperty.call(lockfileSettings, "autoInstallPeers")) {
    if (Boolean(lockfileSettings.autoInstallPeers) !== Boolean(effectiveAutoInstallPeers)) {
      mismatches.push(
        `settings mismatch autoInstallPeers: pnpm-lock.yaml=${lockfileSettings.autoInstallPeers} effective=${effectiveAutoInstallPeers}`,
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(lockfileSettings, "excludeLinksFromLockfile")) {
    if (Boolean(lockfileSettings.excludeLinksFromLockfile) !== Boolean(effectiveExcludeLinksFromLockfile)) {
      mismatches.push(
        `settings mismatch excludeLinksFromLockfile: pnpm-lock.yaml=${lockfileSettings.excludeLinksFromLockfile} effective=${effectiveExcludeLinksFromLockfile}`,
      );
    }
  }

  console.log(`lockfile override keys: ${Object.keys(lockfileOverrides).length}`);
  console.log(`package override keys: ${Object.keys(packageOverrides).length}`);
  console.log(`effective autoInstallPeers: ${effectiveAutoInstallPeers}`);
  console.log(`effective excludeLinksFromLockfile: ${effectiveExcludeLinksFromLockfile}`);

  if (mismatches.length > 0) {
    console.error("\nPNPM LOCKFILE CONFIG MISMATCH");
    console.error(mismatches.join("\n"));
    process.exit(2);
  }

  console.log("\npnpm lockfile config OK");
}

main();
