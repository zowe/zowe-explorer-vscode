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
var parsedJesNodeActions = JSON.parse(fs.readFileSync('./out/src/jes/jesNodeActions.nls.metadata.json').toString());
var keysPairsJesNodeActions = {};
var parsedMvsNodeActions = JSON.parse(fs.readFileSync('./out/src/mvs/mvsNodeActions.nls.metadata.json').toString());
var keysPairsMvsNodeActions = {};
var parsedUssNodeActions = JSON.parse(fs.readFileSync('./out/src/uss/ussNodeActions.nls.metadata.json').toString());
var keysPairsUssNodeActions = {};
var parsedDatasetTree = JSON.parse(fs.readFileSync('./out/src/DatasetTree.nls.metadata.json').toString());
var keysPairsDatasetTree = {};
var parsedExtension = JSON.parse(fs.readFileSync('./out/src/extension.nls.metadata.json').toString());
var keysPairsExtension = {};
var parsedGetAllProfiles = JSON.parse(fs.readFileSync('./out/src/getAllProfiles.nls.metadata.json').toString());
var keysPairsGetAllProfiles = {};
var parsedGetDefaultProfile = JSON.parse(fs.readFileSync('./out/src/getDefaultProfile.nls.metadata.json').toString());
var keysPairsGetDefaultProfile = {};
var parsedPersistentFilters = JSON.parse(fs.readFileSync('./out/src/PersistentFilters.nls.metadata.json').toString());
var keysPairsPersistentFilters = {};
var parsedProfileLoader = JSON.parse(fs.readFileSync('./out/src/ProfileLoader.nls.metadata.json').toString());
var keysPairsProfileLoader = {};
var parsedProfiles = JSON.parse(fs.readFileSync('./out/src/Profiles.nls.metadata.json').toString());
var keysPairsProfiles = {};
var parsedSpoolProvider = JSON.parse(fs.readFileSync('./out/src/SpoolProvider.nls.metadata.json').toString());
var keysPairsSpoolProvider = {};
var parsedUSSTree = JSON.parse(fs.readFileSync('./out/src/USSTree.nls.metadata.json').toString());
var keysPairsUSSTree = {};
var parsedUtils = JSON.parse(fs.readFileSync('./out/src/utils.nls.metadata.json').toString());
var keysPairsUtils = {};
var parsedZosJobsProvider = JSON.parse(fs.readFileSync('./out/src/ZosJobsProvider.nls.metadata.json').toString());
var keysPairsZosJobsProvider = {};
var parsedZoweJobNode = JSON.parse(fs.readFileSync('./out/src/ZoweJobNode.nls.metadata.json').toString());
var keysPairsZoweJobNode = {};
var parsedZoweNode = JSON.parse(fs.readFileSync('./out/src/ZoweNode.nls.metadata.json').toString());
var keysPairsZoweNode = {};
var parsedZoweUSSNode = JSON.parse(fs.readFileSync('./out/src/ZoweUSSNode.nls.metadata.json').toString());
var keysPairsZoweUSSNode = {};
var keysPairsPackage = JSON.parse(fs.readFileSync('./package.nls.json').toString());

// Extract localization key/value pairs from metadata files
parsedJesNodeActions.keys.forEach((key, i) => keysPairsJesNodeActions[key] = parsedJesNodeActions.messages[i]);
parsedMvsNodeActions.keys.forEach((key, i) => keysPairsMvsNodeActions[key] = parsedMvsNodeActions.messages[i]);
parsedUssNodeActions.keys.forEach((key, i) => keysPairsUssNodeActions[key] = parsedUssNodeActions.messages[i]); 
parsedDatasetTree.keys.forEach((key, i) => keysPairsDatasetTree[key] = parsedDatasetTree.messages[i]); 
parsedExtension.keys.forEach((key, i) => keysPairsExtension[key] = parsedExtension.messages[i]);
parsedGetAllProfiles.keys.forEach((key, i) => keysPairsGetAllProfiles[key] = parsedGetAllProfiles.messages[i]);
parsedGetDefaultProfile.keys.forEach((key, i) => keysPairsGetDefaultProfile[key] = parsedGetDefaultProfile.messages[i]);
parsedPersistentFilters.keys.forEach((key, i) => keysPairsPersistentFilters[key] = parsedPersistentFilters.messages[i]);
parsedProfileLoader.keys.forEach((key, i) => keysPairsProfileLoader[key] = parsedProfileLoader.messages[i]);
parsedProfiles.keys.forEach((key, i) => keysPairsProfiles[key] = parsedProfiles.messages[i]);
parsedSpoolProvider.keys.forEach((key, i) => keysPairsSpoolProvider[key] = parsedSpoolProvider.messages[i]);
parsedUSSTree.keys.forEach((key, i) => keysPairsUSSTree[key] = parsedUSSTree.messages[i]);
parsedUtils.keys.forEach((key, i) => keysPairsUtils[key] = parsedUtils.messages[i]);
parsedZosJobsProvider.keys.forEach((key, i) => keysPairsZosJobsProvider[key] = parsedZosJobsProvider.messages[i]);
parsedZoweJobNode.keys.forEach((key, i) => keysPairsZoweJobNode[key] = parsedZoweJobNode.messages[i]);
parsedZoweNode.keys.forEach((key, i) => keysPairsZoweNode[key] = parsedZoweNode.messages[i]); 
parsedZoweUSSNode.keys.forEach((key, i) => keysPairsZoweUSSNode[key] = parsedZoweUSSNode.messages[i]); 

// Write to i18n sample folder to create template for new languages
fs.writeFileSync('./i18n/sample/src/jes/jesNodeActions.i18n.json', JSON.stringify(keysPairsJesNodeActions, null, 4));
fs.writeFileSync('./i18n/sample/src/mvs/mvsNodeActions.i18n.json', JSON.stringify(keysPairsMvsNodeActions, null, 4));
fs.writeFileSync('./i18n/sample/src/uss/ussNodeActions.i18n.json', JSON.stringify(keysPairsUssNodeActions, null, 4));
fs.writeFileSync('./i18n/sample/src/DatasetTree.i18n.json', JSON.stringify(keysPairsDatasetTree, null, 4));
fs.writeFileSync('./i18n/sample/src/extension.i18n.json', JSON.stringify(keysPairsExtension, null, 4));
fs.writeFileSync('./i18n/sample/src/getAllProfiles.i18n.json', JSON.stringify(keysPairsGetAllProfiles, null, 4));
fs.writeFileSync('./i18n/sample/src/getDefaultProfile.i18n.json', JSON.stringify(keysPairsGetDefaultProfile, null, 4));
fs.writeFileSync('./i18n/sample/src/PersistentFilters.i18n.json', JSON.stringify(keysPairsPersistentFilters, null, 4));
fs.writeFileSync('./i18n/sample/src/ProfileLoader.i18n.json', JSON.stringify(keysPairsProfileLoader, null, 4));
fs.writeFileSync('./i18n/sample/src/Profiles.i18n.json', JSON.stringify(keysPairsProfiles, null, 4));
fs.writeFileSync('./i18n/sample/src/SpoolProvider.i18n.json', JSON.stringify(keysPairsSpoolProvider, null, 4));
fs.writeFileSync('./i18n/sample/src/USSTree.i18n.json', JSON.stringify(keysPairsUSSTree, null, 4));
fs.writeFileSync('./i18n/sample/src/utils.i18n.json', JSON.stringify(keysPairsUtils, null, 4));
fs.writeFileSync('./i18n/sample/src/ZosJobsProvider.i18n.json', JSON.stringify(keysPairsZosJobsProvider, null, 4));
fs.writeFileSync('./i18n/sample/src/ZoweJobNode.i18n.json', JSON.stringify(keysPairsZoweJobNode, null, 4));
fs.writeFileSync('./i18n/sample/src/ZoweNode.i18n.json', JSON.stringify(keysPairsZoweNode, null, 4));
fs.writeFileSync('./i18n/sample/src/ZoweUSSNode.i18n.json', JSON.stringify(keysPairsZoweUSSNode, null, 4));
fs.writeFileSync('./i18n/sample/package.i18n.json', JSON.stringify(keysPairsPackage, null, 4));