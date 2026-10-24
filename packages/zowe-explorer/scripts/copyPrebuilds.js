const { copySync } = require("fs-extra");
const { join, resolve } = require("path");
// 1. Copy prebuilds for Zowe Secrets SDK
const secretsPkgDir = resolve(require.resolve("@zowe/secrets-for-zowe-sdk"), "..", "..");
copySync(join(secretsPkgDir, "prebuilds"), resolve(__dirname, "..", "prebuilds"));
// 2. Copy prebuilds for Zo SSH server
const zowexPkgDir = resolve(require.resolve("@zowe/zowex-for-zowe-sdk"), "..", "..");
copySync(join(zowexPkgDir, "bin"), resolve(__dirname, "..", "bin"));
