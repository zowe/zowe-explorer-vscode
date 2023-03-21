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

export function join(...paths: string[]): string {
    const value = paths.join("/").replace("//", "/");
    return value;
}

export function normalize(p: string): string {
    return p;
}

export function extname(file: string): string {
    return "";
}

export function parse(file: string) {
    return { name: file };
}
