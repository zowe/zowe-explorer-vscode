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

interface Stats {
    isDirectory(path: string): boolean;
    isFile(path: string): boolean;
}

export class FakeStats implements Stats {
    isFile(path: string): boolean {
        if (this.path.endsWith(".txt")) {
            return true;
        }
        return false;
    }
    public path: string;
    isDirectory(): boolean {
        if (this.path.endsWith(".txt")) {
            return false;
        }
        return true;
    }
    constructor(private mMyPath: string) {
        this.path = mMyPath;
    }
}

export function lstatSync(path: string): Stats {
    const value = new FakeStats(path);
    return value;
}

export function readdirSync(path: string): string[] {
    const value = [
        "A[testSess]", "Parent[testSess]", "B"
    ];
    return value;
}
export function rmdirSync(path: string): void {}

export function unlinkSync(path: string): void {}

export function writeFileSync(path: string, data: string): void {}