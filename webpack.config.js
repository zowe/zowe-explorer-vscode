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
var basePath = __dirname;
/**@type {import('webpack').Configuration}*/
const extensionConfig = {
    target: 'node',
    entry: {
        extension: path.resolve(basePath, 'src/extension.ts')
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: 'commonjs',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    node: {
        __dirname: false
    },
    stats: 'errors-only',
    devtool: 'source-map',
    externals: {
        vscode: 'commonjs vscode',
        keytar: 'commonjs keytar'
    },
    resolve: {
        extensions: ['.ts', '.js', '.json']
    },
    module: {
        rules: [
            {
                test: /\.ts|\.tsx$/,
                exclude: /node_modules/,
                use:[{
					// vscode-nls-dev loader:
					// * rewrite nls-calls
					loader: 'vscode-nls-dev/lib/webpack-loader',
					options: {
						base: 'src'
					}
                }, {
					// configure TypeScript loader:
					// * enable sources maps for end-to-end source maps
					loader: 'ts-loader',
					options: {
						compilerOptions: {
							"sourceMap": true,
						}
					}
				}]
            }
        ]
    },
    plugins: [
        new webpack.BannerPlugin(fs.readFileSync('./LICENSE_HEADER', 'utf8'))
    ]
};

module.exports = () => {
    return [extensionConfig];
};
