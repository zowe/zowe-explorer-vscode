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

/**
 * Local copy of dataset extension detection logic for e2e tests.
 * Kept in tests to avoid importing vscode through the API dependency chain.
 */
export const DS_EXTENSION_MAP: Map<string, (string | RegExp)[]> = new Map([
    [".c", ["C"]],
    [".jcl", ["JCL", "JCLLIB", "CNTL", "PROC", "PROCLIB"]],
    [".cbl", ["COBOL", "CBL", "COB", "SCBL"]],
    [".cpy", ["COPYBOOK", "COPY", "CPY", "COBCOPY"]],
    [".inc", ["INC", "INCLUDE", "PLINC"]],
    [".pli", ["PLI", "PL1", "PLX", "PCX"]],
    [".sh", ["SH", "SHELL"]],
    [".rexx", ["REXX", "REXEC", "EXEC"]],
    [".xml", ["XML"]],
    [".asm", ["ASM", /ASSEMBL/]],
    [".log", ["LOG", /SPFLOG/]],
]);

/**
 * Get the file extension for a Data Set (or data set member) based on its name or its PDS name.
 */
export function getDatasetExtension(label: string): string | null {
    const limit = 5;
    const bracket = label.indexOf("(");
    const split = bracket > -1 ? label.substring(0, bracket).split(".", limit) : label.split(".", limit);
    for (let i = split.length - 1; i > 0; i--) {
        for (const [ext, matches] of DS_EXTENSION_MAP.entries()) {
            if (matches.some((match) => (match instanceof RegExp ? match.test(split[i]) : match === split[i]))) {
                return ext;
            }
        }
    }
    return null;
}
