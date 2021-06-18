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

const fs = require("fs");
const jsonDiff = require('json-diff');
const diff = require('diff');

// Specify the Zowe-Temp-Folder-Location
const readPkg = fs.readFileSync('../../packages/zowe-explorer/package.json');
const tempPkg = readPkg.toString();
const pkg = JSON.parse(readPkg);
pkg.contributes.configuration.properties['Zowe-Temp-Folder-Location'].default.folderPath = "/projects";

// Remove `yarn lint` to allow yarn package to work
const temp = pkg.scripts['vscode:prepublish'];
pkg.scripts['vscode:prepublish'] = temp.replace("&& yarn lint", "");
fs.writeFileSync('../../packages/zowe-explorer/package.json', JSON.stringify(pkg));

// Output diff for package.json
console.log("Diff for package.json:\n");
const diff1 = jsonDiff.diffString(JSON.parse(tempPkg), JSON.parse(fs.readFileSync('../../packages/zowe-explorer/package.json').toString()));
console.log(diff1);

// Set workspace configuration
const readTsF = fs.readFileSync('../../packages/zowe-explorer/src/extension.ts');
const tempTsF = readTsF.toString();
const tsF = tempTsF.split('\n');
const line = tsF.indexOf(tsF.find((line)=>line.indexOf('function activate(')>=0));
tsF.splice(line+1, 0, 'vscode.workspace.getConfiguration("files").update("exclude", {"**/.zowe": true, "**/temp": true}, vscode.ConfigurationTarget.Workspace);'); 
fs.writeFileSync('../../packages/zowe-explorer/src/extension.ts', tsF.join('\n'));

// Output diff for extension.ts
console.log("Diff for extension.ts:\n");
const diff2 = diff.diffLines(tempTsF, fs.readFileSync('../../packages/zowe-explorer/src/extension.ts').toString());
diff2.forEach((part) => {
    if(part.added){
        console.log("+ ", part.value);
    }
    if(part.removed){
        console.log("- ", part.value);
    }
  });

