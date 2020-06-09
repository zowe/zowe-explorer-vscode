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

export function getContentForWebView(directory: string): {html: string; js: string; css: string;} {
    return {
        html: fs.readFileSync(path.resolve(directory, "index.html"), "UTF-8"),
        js: fs.readFileSync(path.resolve(directory, "index.js"), "UTF-8"),
        css: fs.readFileSync(path.resolve(directory, "index.css"), "UTF-8")
    };
}

export function unifyContentOfHTML(content: {html: string; js: string; css: string;}) {
    let html = content.html;
    html = html.replace("<style-inject></style-inject>", `<style>${content.css}</style>`);
    html = html.replace("<script-inject></script-inject>", `<script>${content.js}</script>`);

    return html;
}

export function injectConstantsBlockToHTML(html: string, constants: {[index: string]: any}) {
    const constantsString = Buffer.from(JSON.stringify(constants)).toString("base64");
    return html.replace("constantsPlaceholderAttribute", `constants="${constantsString}"`);
}
