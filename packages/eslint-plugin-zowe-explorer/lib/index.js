/**
 * @fileoverview Custom ESLint Rules for ZOWE Explorer
 */
"use strict";

var requireIndex = require("requireindex");

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------

// import all rules in lib/rules
module.exports.rules = requireIndex(__dirname + "/rules");
