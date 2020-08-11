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

// Workaround until this vsce issue is fixed: https://github.com/microsoft/vscode-vsce/issues/300
// Potential candidate: https://github.com/microsoft/vscode-vsce/pull/458

var AdmZip = require('adm-zip');
var vsixFile = process.argv[2] + '-' + process.env.npm_package_version + '.vsix';

var foldersToAdd = [
    'vscode-nls'
];

console.log('Opening VSIX file to add missing vscode node_modules: ' + vsixFile);
var zip = new AdmZip(vsixFile);

foldersToAdd.forEach(function(folder){
    zip.addLocalFolder('node_modules/' + folder, 'extension/node_modules/' + folder);
});

zip.writeZip();
console.log('Finished writing file: ' + vsixFile);
