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

interface Stats {
    isDirectory(): boolean;
    isFile(): boolean;
}

export class FakeStats implements Stats {
    isFile(): boolean {
        if (this.path.endsWith(".txt")) {
            return true;
        }
        return false;
    }
    isDirectory(): boolean {
        if (this.path.endsWith(".txt")) {
            return false;
        }
        return true;
    }
    constructor(public path: string) {}
}

export function access(path: string, callback: any): void {}

export function closeSync(fd: number): void {}

export function existsSync(path: string | Buffer): boolean {
    return Boolean(path);
}

export function lstat(path: string, callback: any): void {}

export function lstatSync(path: string): Stats {
    const value = new FakeStats(path);
    return value;
}

export function openSync(path: string, mode: string): number {
    return process.stdout.fd;
}

export function readdirSync(path: string): string[] {
    const value = ["A[testSess]", "Parent[testSess]", "B"];
    return value;
}

export function readFileSync(path: string): string {
    return "{}";
}

export function realpathSync(path: string): string {
    return path;
}

realpathSync.native = realpathSync;

export function rmdirSync(path: string): void {}

export function stat(path: string, callback: any): void {}

export function statSync(path: string): Stats {
    const value = new FakeStats(path);
    return value;
}

export function unlinkSync(path: string): void {}

export function writeFileSync(path: string, data: any, encoding: string): void {}

export function writeSync(path: string, data: any, position: number, encoding: string): void {}
