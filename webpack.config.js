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

//@ts-check

'use strict';

const path = require('path');
var webpack = require("webpack");
var fs = require("fs");

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	// mode:'development',
    entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    output: { // the bundle is stored in the 'out/src' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, 'out/src'),
        filename: 'extension.js',
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    devtool: 'source-map',
    externals: {
        // Add modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        "vscode-nls" : "commonjs vscode-nls",
        keytar: "commonjs keytar",
        "spdx-exceptions": "commonjs spdx-exceptions",
        "spdx-license-ids": "commonjs spdx-license-ids",
        "spdx-license-ids/deprecated": "commonjs spdx-license-ids/deprecated"
    },
    resolve: { // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
        extensions: ['.ts', '.js']
    },
    node: {
        __dirname: false, // leave the __dirname behavior intact
    },
    stats: {
        // Ignore warnings
        warnings: false
    },
    module: {
        rules: [{
            test: /\.ts$/,
            exclude: /node_modules/,
            use: [
                {
                    // configure TypeScript loader:
                    // * enable sources maps for end-to-end source maps
                    loader: 'ts-loader',
                    options: {
                        compilerOptions: {
                            "sourceMap": true,
                        }
                    }
                },
        ]},
    ]},
    plugins: [
        new webpack.BannerPlugin(fs.readFileSync('./.vscode/banner.txt', 'utf8'))
    ]
}

// Generates source code folder hierarchy nls metadata files in the output folder (e.g. out/src) 
if (process.argv.includes('--vscode-nls')) {
	// rewrite nls call when being asked for
	config.module.rules.unshift({
		loader: 'vscode-nls-dev/lib/webpack-loader',
		options: {
			base: __dirname
		}
	})
}


module.exports = config;