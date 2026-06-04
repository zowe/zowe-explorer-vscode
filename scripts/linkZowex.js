const { execSync } = require('child_process');
const args = process.argv.slice(2);
const target = args.find(arg => arg !== '--') || '../zowex/packages/sdk';
execSync(`pnpm install "file:../../${target}" --no-lockfile`, { stdio: 'inherit' });
