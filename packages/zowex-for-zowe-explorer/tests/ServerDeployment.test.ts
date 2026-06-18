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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import { deployWithProgress } from "../src/ServerDeployment";
import { SshErrorHandler } from "../src/SshErrorHandler";
import { ZSshUtils } from "@zowe/zowex-for-zowe-sdk";

vi.mock("@zowe/zowex-for-zowe-sdk", () => ({
    ZSshUtils: {
        installServer: vi.fn(),
    },
}));

describe("ServerDeployment", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("deployWithProgress", () => {
        const fakeSession = { ISshSession: { host: "fake-host" } } as any;

        beforeEach(() => {
            vi.spyOn(SshErrorHandler.getInstance(), "createErrorCallback").mockReturnValue(vi.fn());
        });

        it("should deploy the server with a progress notification and return the install result", async () => {
            const installSpy = vi.mocked(ZSshUtils.installServer).mockResolvedValue(true);
            const progressSpy = vi.spyOn(vscode.window, "withProgress");

            const result = await deployWithProgress(fakeSession, "/server/path");

            expect(progressSpy).toHaveBeenCalledTimes(1);
            expect(progressSpy.mock.calls[0][0]).toEqual(expect.objectContaining({ location: vscode.ProgressLocation.Notification }));
            expect(installSpy).toHaveBeenCalledTimes(1);
            expect(installSpy.mock.calls[0][0]).toBe(fakeSession);
            expect(installSpy.mock.calls[0][1]).toEqual("/server/path");
            expect(result).toEqual(true);
        });

        it("should build an error callback scoped to the Server installation scenario", async () => {
            vi.mocked(ZSshUtils.installServer).mockResolvedValue(true);
            const createErrorCallbackSpy = vi.spyOn(SshErrorHandler.getInstance(), "createErrorCallback");

            await deployWithProgress(fakeSession, "/server/path");

            expect(createErrorCallbackSpy).toHaveBeenCalledWith(ZoweExplorerApiType.All, "Server installation");
        });

        it("should forward progress increments to the VS Code progress reporter", async () => {
            const reported: number[] = [];
            vi.mocked(ZSshUtils.installServer).mockImplementation(async (_session, _path, opts) => {
                opts?.onProgress?.(25);
                opts?.onProgress?.(50);
                reported.push(25, 50);
                return true;
            });

            await deployWithProgress(fakeSession, "/server/path");

            expect(reported).toEqual([25, 50]);
        });

        it("should forward a non-successful install result", async () => {
            vi.mocked(ZSshUtils.installServer).mockResolvedValue(false);

            const result = await deployWithProgress(fakeSession, "/server/path");

            expect(result).toEqual(false);
        });
    });
});
