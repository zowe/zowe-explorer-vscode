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
const TerserPlugin = require("terser-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const config = (mode) => ({
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
        extensions: [".ts", ".js"],
        alias: {
            "@zowe/zowe-explorer-api$": path.resolve(__dirname, "..", "zowe-explorer-api/src"),
        },
        conditionNames: ["@zowe:bundler", "..."],
    },
    watchOptions: {
        ignored: /node_modules/,
    },
    stats: {
        warnings: false,
    },
    optimization: {
        minimize: mode !== "development",
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
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "esbuild-loader",
                    },
                ],
            },
            {
                test: /\.js/,
                include: /wontache/, // https://gitlab.com/jgonggrijp/wontache/-/issues/68
                type: "javascript/auto",
            },
            {
                test: /\.node$/,
                loader: "node-loader",
            },
        ],
    },
    plugins: [
        new webpack.BannerPlugin(fs.readFileSync("../../scripts/LICENSE_HEADER", "utf-8")),
        new ForkTsCheckerWebpackPlugin({
            typescript: {
                build: true,
                configFile: path.join(__dirname, "tsconfig.json"),
                diagnosticOptions: {
                    syntactic: true,
                    semantic: true,
                },
            },
        }),
    ],
});

module.exports = (_, { mode }) => config(mode);
