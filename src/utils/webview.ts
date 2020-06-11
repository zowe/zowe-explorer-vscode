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

import * as fs from "fs";
import * as path from "path";

export async function getContentForWebView(directory: string): Promise<{ html: string; js: string; css: string; }> {
    return {
        html: await fs.promises.readFile(path.resolve(directory, "index.html"), { encoding: "utf-8" }),
        js: await fs.promises.readFile(path.resolve(directory, "index.js"), { encoding: "utf-8" }),
        css: await fs.promises.readFile(path.resolve(directory, "index.css"), { encoding: "utf-8" })
    };
}

export function unifyContentOfHTML(content: { html: string; js: string; css: string; }) {
    let html = content.html;
    html = html.replace("<style-inject></style-inject>", `<style>${content.css}</style>`);
    html = html.replace("<script-inject></script-inject>", `<script>${content.js}</script>`);

    return html;
}
