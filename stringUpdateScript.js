/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

// This script creates the i18n/sample template used for adding/updating i18n files
fs = require('fs');

// Read localization metadata files
// Consider adding support for creating directories in the filepath if they don't exist yet

var parsedZoweVscApiRegister = JSON.parse(fs.readFileSync('./out/src/api/ZoweExplorerApiRegister.nls.metadata.json').toString());
var keysPairsZoweVscApiRegister = {};
var parsedUssNodeActions = JSON.parse(fs.readFileSync('./out/src/uss/ussNodeActions.nls.metadata.json').toString());
var keysPairsUssNodeActions = {};
var parsedDatasetTree = JSON.parse(fs.readFileSync('./out/src/DatasetTree.nls.metadata.json').toString());
var keysPairsDatasetTree = {};
var parsedExtension = JSON.parse(fs.readFileSync('./out/src/extension.nls.metadata.json').toString());
var keysPairsExtension = {};
var parsedProfiles = JSON.parse(fs.readFileSync('./out/src/Profiles.nls.metadata.json').toString());
var keysPairsProfiles = {};
var parsedUSSTree = JSON.parse(fs.readFileSync('./out/src/USSTree.nls.metadata.json').toString());
var keysPairsUSSTree = {};
var parsedUtils = JSON.parse(fs.readFileSync('./out/src/utils.nls.metadata.json').toString());
var keysPairsUtils = {};
var parsedZosJobsProvider = JSON.parse(fs.readFileSync('./out/src/ZosJobsProvider.nls.metadata.json').toString());
var keysPairsZosJobsProvider = {};
var parsedZoweNode = JSON.parse(fs.readFileSync('./out/src/ZoweNode.nls.metadata.json').toString());
var keysPairsZoweNode = {};
var parsedZoweUSSNode = JSON.parse(fs.readFileSync('./out/src/ZoweUSSNode.nls.metadata.json').toString());
var keysPairsZoweUSSNode = {};
var keysPairsPackage = JSON.parse(fs.readFileSync('./package.nls.json').toString());

 // Extract localization key/value pairs from metadata files
parsedZoweVscApiRegister.keys.forEach((key, i) => keysPairsZoweVscApiRegister[key] = parsedZoweVscApiRegister.messages[i]);
parsedUssNodeActions.keys.forEach((key, i) => keysPairsUssNodeActions[key] = parsedUssNodeActions.messages[i]);
parsedDatasetTree.keys.forEach((key, i) => keysPairsDatasetTree[key] = parsedDatasetTree.messages[i]);
parsedExtension.keys.forEach((key, i) => keysPairsExtension[key] = parsedExtension.messages[i]);
parsedProfiles.keys.forEach((key, i) => keysPairsProfiles[key] = parsedProfiles.messages[i]);
parsedUSSTree.keys.forEach((key, i) => keysPairsUSSTree[key] = parsedUSSTree.messages[i]);
parsedUtils.keys.forEach((key, i) => keysPairsUtils[key] = parsedUtils.messages[i]);
parsedZosJobsProvider.keys.forEach((key, i) => keysPairsZosJobsProvider[key] = parsedZosJobsProvider.messages[i]);
parsedZoweNode.keys.forEach((key, i) => keysPairsZoweNode[key] = parsedZoweNode.messages[i]);
parsedZoweUSSNode.keys.forEach((key, i) => keysPairsZoweUSSNode[key] = parsedZoweUSSNode.messages[i]);

 // Write to i18n sample folder to create template for new languages
fs.writeFileSync('./i18n/sample/src/api/ZoweExplorerApiRegister.i18n.json', JSON.stringify(keysPairsZoweVscApiRegister, null, 4));
fs.writeFileSync('./i18n/sample/src/uss/ussNodeActions.i18n.json', JSON.stringify(keysPairsUssNodeActions, null, 4));
fs.writeFileSync('./i18n/sample/src/DatasetTree.i18n.json', JSON.stringify(keysPairsDatasetTree, null, 4));
fs.writeFileSync('./i18n/sample/src/extension.i18n.json', JSON.stringify(keysPairsExtension, null, 4));
fs.writeFileSync('./i18n/sample/src/Profiles.i18n.json', JSON.stringify(keysPairsProfiles, null, 4));
fs.writeFileSync('./i18n/sample/src/USSTree.i18n.json', JSON.stringify(keysPairsUSSTree, null, 4));
fs.writeFileSync('./i18n/sample/src/utils.i18n.json', JSON.stringify(keysPairsUtils, null, 4));
fs.writeFileSync('./i18n/sample/src/ZosJobsProvider.i18n.json', JSON.stringify(keysPairsZosJobsProvider, null, 4));
fs.writeFileSync('./i18n/sample/src/ZoweNode.i18n.json', JSON.stringify(keysPairsZoweNode, null, 4));
fs.writeFileSync('./i18n/sample/src/ZoweUSSNode.i18n.json', JSON.stringify(keysPairsZoweUSSNode, null, 4));
fs.writeFileSync('./i18n/sample/package.i18n.json', JSON.stringify(keysPairsPackage, null, 4));
