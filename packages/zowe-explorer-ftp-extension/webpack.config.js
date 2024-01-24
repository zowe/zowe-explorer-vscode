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

"use strict";

const path = require("path");
const webpack = require("webpack");
const fs = require("fs");
const nodeExternals = require("webpack-node-externals");

/**@type {webpack.Configuration}*/
const config = {
    target: "webworker",
    entry: "./src/extension.ts",
    output: {
        path: path.resolve(__dirname, "out/src"),
        filename: "extension.js",
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../../[resource-path]",
    },
    devtool: "source-map",
    externals: [
        nodeExternals({
            modulesDir: path.resolve(__dirname, "../../node_modules"),
        }),
        nodeExternals(),
        "vscode",
    ],
    resolve: {
        extensions: [".ts", ".js"],
        fallback: {
            path: require.resolve("path-browserify"),
            crypto: require.resolve("crypto-browserify"),
            fs: false,
        },
    },
    node: {
        __dirname: false,
    },
    stats: {
        warnings: false,
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "ts-loader",
                        options: {
                            compilerOptions: {
                                sourceMap: true,
                            },
                        },
                    },
                ],
            },
        ],
    },
    plugins: [new webpack.BannerPlugin(fs.readFileSync("../../scripts/LICENSE_HEADER", "utf-8"))],
};

module.exports = config;
