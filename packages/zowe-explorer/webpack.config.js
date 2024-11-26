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

// OpenSSL 3 no longer supports the insecure md4 hash, but webpack < 6
// hardcodes it. Work around by substituting a supported algorithm.
// https://github.com/webpack/webpack/issues/13572
// https://github.com/webpack/webpack/issues/14532
const crypto = require("crypto");
const crypto_orig_createHash = crypto.createHash;
crypto.createHash = (algorithm) => crypto_orig_createHash(algorithm == "md4" ? "sha256" : algorithm);

const path = require("path");
var webpack = require("webpack");
var fs = require("fs");

/**@type {import('webpack').Configuration}*/
const config = {
    target: "node", // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
    entry: "./src/extension.ts", // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    output: {
        // the bundle is stored in the 'out/src' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
        path: path.resolve(__dirname, "out/src"),
        filename: "extension.js",
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "webpack:///[absolute-resource-path]",
    },
    devtool: "source-map",
    externals: {
        // Add modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        "spdx-exceptions": "commonjs spdx-exceptions",
        "spdx-license-ids": "commonjs spdx-license-ids",
        "spdx-license-ids/deprecated": "commonjs spdx-license-ids/deprecated",
        "cpu-features": "commonjs cpu-features",
    },
    resolve: {
        // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
        extensions: [".ts", ".js"],
        alias: {
            "@zowe/zowe-explorer-api$": path.resolve(__dirname, "..", "zowe-explorer-api/src"),
        },
    },
    node: {
        __dirname: false, // leave the __dirname behavior intact
    },
    stats: {
        // Ignore warnings
        warnings: false,
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "vscode-nls-dev/lib/webpack-loader",
                        options: {
                            base: __dirname,
                        },
                    },
                    {
                        loader: "ts-loader",
                        options: {
                            compilerOptions: {
                                sourceMap: true,
                            },
                            projectReferences: true,
                        },
                    },
                ],
            },
            {
                test: /\.js$/,
                include: /agent-base|https?-proxy-agent/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                    },
                },
            },
            {
                test: /\.mjs$/,
                include: /markdown-it/,
                type: "javascript/auto",
            },
        ],
    },
    plugins: [new webpack.BannerPlugin(fs.readFileSync("../../scripts/LICENSE_HEADER", "utf-8"))],
};

module.exports = config;
