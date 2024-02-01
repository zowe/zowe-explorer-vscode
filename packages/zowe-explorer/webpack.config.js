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
const TerserPlugin = require("terser-webpack-plugin");

/**@type {webpack.Configuration}*/
const config = {
    target: "node",
    entry: "./src/extension.ts",
    output: {
        path: path.resolve(__dirname, "out/src"),
        filename: "[name].extension.js",
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "webpack:///[absolute-resource-path]",
    },
    devtool: "source-map",
    externals: ["vscode", "cpu-features"],
    resolve: {
        modules: [path.resolve(__dirname, "../../node_modules"), path.resolve(__dirname, "node_modules")],
        extensions: [".ts", ".js"],
        alias: {
            "@zowe/zowe-explorer-api$": path.resolve(__dirname, "..", "zowe-explorer-api/src"),
        },
    },
    watchOptions: {
        ignored: /node_modules/,
    },
    stats: {
        warnings: false,
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                parallel: true,
                minify: TerserPlugin.esbuildMinify,
            }),
        ],
        runtimeChunk: "single",
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: "vendors",
                    chunks: "all",
                },
            },
        },
    },
    module: {
        rules: [
            {
                test: /\.node$/,
                loader: "node-loader",
            },
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
                            projectReferences: true,
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
