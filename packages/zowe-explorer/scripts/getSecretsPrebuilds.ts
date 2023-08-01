import { copySync } from "fs-extra";
import { join, resolve } from "path";
const secretsPkgDir = resolve(require.resolve("@zowe/secrets-for-zowe-sdk"), "..", "..");
copySync(join(secretsPkgDir, "prebuilds"), resolve(__dirname, "..", "prebuilds"));