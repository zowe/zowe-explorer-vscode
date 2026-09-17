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

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { imperative } from "@zowe/zowe-explorer-api";
import { RUSSH_BINARY_SHA256 } from "@zowe/zowex-for-zowe-sdk";
import * as vscode from "vscode";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sdkPackageJson = require("@zowe/zowex-for-zowe-sdk/package.json");
const RUSSH_VERSION: string = sdkPackageJson.optionalDependencies!.russh;
const SSH_TIMEOUT: number = 60e3;

const NATIVE_TRIPLES: Record<string, Record<string, string>> = {
    win32: {
        x64: "win32-x64-msvc",
        arm64: "win32-arm64-msvc",
    },
    darwin: {
        x64: "darwin-x64",
        arm64: "darwin-arm64",
    },
    linux: {
        x64: "linux-x64-gnu",
        arm: "linux-arm-gnueabihf",
        arm64: "linux-arm64-gnu",
    },
};

async function ensureNativeBinary(context: vscode.ExtensionContext): Promise<void> {
    const triple = NATIVE_TRIPLES[process.platform]?.[process.arch];
    if (!triple) {
        vscode.window.showWarningMessage(`No native SSH binary available for ${process.platform}-${process.arch}.`);
        return;
    }

    const filename = `russh.${triple}.node`;
    const prebuildsDir = path.join(context.extensionPath, "prebuilds");
    const destPath = path.join(prebuildsDir, filename);

    if (fs.existsSync(destPath)) {
        return;
    }

    const expectedSha256 = RUSSH_BINARY_SHA256[triple];
    if (!expectedSha256) {
        throw new Error(`No SHA256 checksum registered for native SSH binary target ${triple}.`);
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Downloading native SSH binary: ${filename}`,
        },
        async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), SSH_TIMEOUT);
            let response: Response;
            try {
                response = await fetch(`https://unpkg.com/russh@${RUSSH_VERSION}/${filename}`, {
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeoutId);
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const actualSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
            if (actualSha256 !== expectedSha256) {
                throw new Error(`SHA256 mismatch for ${filename}: expected ${expectedSha256}, but got ${actualSha256}.`);
            }

            fs.mkdirSync(prebuildsDir, { recursive: true });
            fs.writeFileSync(destPath, buffer);
            imperative.Logger.getAppLogger().info("Downloaded native SSH binary to %s", destPath);
        }
    );
}

export function handleNativeSshSettings(context: vscode.ExtensionContext): void {
    if (!vscode.workspace.getConfiguration("zowe").get<boolean>("zowex.experimentalNativeSsh")) {
        return;
    }
    ensureNativeBinary(context).catch((err: Error) => {
        imperative.Logger.getAppLogger().error("Failed to download native SSH binary: %s", err.message);
        vscode.window.showErrorMessage(`Failed to download native SSH binary: ${err.message}`);
    });
}
