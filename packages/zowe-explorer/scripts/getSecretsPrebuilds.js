const { copySync } = require("fs-extra");
const { join, resolve } = require("path");
const secretsPkgDir = resolve(require.resolve("@zowe/secrets-for-zowe-sdk"), "..", "..");
copySync(join(secretsPkgDir, "prebuilds"), resolve(__dirname, "..", "prebuilds"));
