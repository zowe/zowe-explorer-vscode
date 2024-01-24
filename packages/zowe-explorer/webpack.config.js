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
const CopyPlugin = require("copy-webpack-plugin");
// const nodeExternals = require("webpack-node-externals");

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
    externals: ["vscode", "wontache", "ssh2", "@zowe/imperative", "cross-spawn", "log4js", "opener", "read", "fs"],
    resolve: {
        mainFields: ["browser", "module", "main"],
        extensions: [".ts", ".js"],
        fallback: {
            path: require.resolve("path-browserify"),
            crypto: require.resolve("crypto-browserify"),
            os: require.resolve("os-browserify/browser"),
            stream: require.resolve("stream-browserify"),
            https: require.resolve("https-browserify"),
            zlib: require.resolve("browserify-zlib"),
            constants: require.resolve("constants-browserify"),
            tty: require.resolve("tty-browserify"),
            assert: require.resolve("assert"),
            http: require.resolve("stream-http"),
            util: require.resolve("util"),
            url: require.resolve("url"),
        },
    },
    watchOptions: {
        ignored: /node_modules/,
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
    plugins: [
        new webpack.BannerPlugin(fs.readFileSync("../../scripts/LICENSE_HEADER", "utf-8")),
        new CopyPlugin({
            patterns: [{ from: "../../node_modules/@zowe/secrets-for-zowe-sdk/prebuilds", to: "../../prebuilds/" }],
        }),
    ],
};

module.exports = config;
