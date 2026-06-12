const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const target = args.find(arg => arg !== '--') || '../zowex/packages/sdk';

function findTgz(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findTgz(full);
      if (nested) return nested;
    } else if (entry.name.endsWith('.tgz')) {
      return full;
    }
  }
  return null;
}

function installFromPr(prNumber) {
  const repo = 'zowe/zowex';
  console.log(`Resolving zowex PR #${prNumber} from ${repo}...`);

  const prInfo = JSON.parse(
    execSync(`gh pr view ${prNumber} --repo ${repo} --json headRefName,headRefOid`, { encoding: 'utf8' })
  );
  const { headRefName: branch, headRefOid: sha } = prInfo;
  console.log(`PR #${prNumber} -> branch "${branch}" @ ${sha}`);

  const runs = JSON.parse(
    execSync(
      `gh run list --repo ${repo} --workflow build.yml --branch ${branch} --json databaseId,headSha,status,conclusion,createdAt --limit 50`,
      { encoding: 'utf8' }
    )
  );
  const run = runs.find(r => r.headSha === sha) || runs[0];
  if (!run) {
    throw new Error(`No "build.yml" workflow runs found for branch "${branch}".`);
  }
  console.log(`Using workflow run ${run.databaseId} (status: ${run.status}, conclusion: ${run.conclusion}).`);

  const cacheDir = path.join('node_modules', '.cache', `zowex-${prNumber}`);
  console.log(`Downloading artifact matching "zowex-sdk" into ${cacheDir}...`);

  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
  fs.mkdirSync(cacheDir, { recursive: true });

  try {
    execSync(`gh run download ${run.databaseId} --repo ${repo} --pattern "*zowex-sdk*" --dir "${cacheDir}"`, {
      stdio: 'inherit',
    });
  } catch (err) {
    throw new Error(`No matching "zowex-sdk" artifact found for run ${run.databaseId}.`);
  }

  const tgz = findTgz(cacheDir);
  if (!tgz) {
    throw new Error(`No .tgz file found in downloaded artifact at ${cacheDir}.`);
  }
  console.log(`Installing zowex SDK from ${path.relative(cacheDir, tgz)}...`);
  execSync(`pnpm add "file:${tgz}" --no-lockfile --force`, { stdio: 'inherit' });
}

if (/^\d+$/.test(target)) {
  installFromPr(target);
} else {
  execSync(`pnpm add "file:../../${target}" --no-lockfile`, { stdio: 'inherit' });
}
