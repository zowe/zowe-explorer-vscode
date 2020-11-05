const dos2unix = require("ssp-dos2unix").dos2unix;
let converted = dos2unix("CHANGELOG.md", { feedback: true, writable: true });
