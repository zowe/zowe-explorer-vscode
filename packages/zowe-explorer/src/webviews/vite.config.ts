/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import * as path from "path";
import { readdirSync } from "fs";
import checker from "vite-plugin-checker";

// https://vitejs.dev/config/

interface Webviews {
    webview?: string;
    webviewLocation?: string;
}

/**
 * Get all available webviews under the source specified
 * @param source
 * @returns Object the object where the key is the webview and the value is the location of the webview
 */
const getAvailableWebviews = (source: string): Webviews => {
    const webviews = readdirSync(source, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

    return webviews.reduce((o, key) => Object.assign(o, { [key]: path.resolve("src", key, "index.html") }), {});
};

export default defineConfig({
    plugins: [
        preact(),
        checker({
            typescript: true,
        }),
    ],
    root: path.resolve(__dirname, "src"),
    build: {
        emptyOutDir: true,
        outDir: path.resolve(__dirname, "dist"),
        rollupOptions: {
            input: getAvailableWebviews(path.resolve(__dirname, "src")) as any,
            output: {
                entryFileNames: `[name]/[name].js`,
                chunkFileNames: `[name]/[name].js`,
                assetFileNames: `[name]/[name].[ext]`,
            },
        },
    },
});
