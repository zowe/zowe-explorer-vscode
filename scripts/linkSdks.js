/* Link Zowe Explorer to your local versions of the SDK packages provided by zowe CLI */
const { execSync } = require("child_process");

const args = process.argv.slice(2);
const cliDir = args.find((arg) => arg !== "--") || "../zowe-cli/packages";

const packageArgs = [
	"core",
	"imperative",
	"zosconsole",
	"zosfiles",
	"zosjobs",
	"zostso",
	"zosuss",
	"zosmf",
]
	.map((p) => `"file:${cliDir}/${p}"`)
	.join(" ");
console.log(`Linking SDK packages ${packageArgs}`);
execSync(`pnpm add ${packageArgs} --workspace-root --no-lockfile`, {
	stdio: "inherit",
});
