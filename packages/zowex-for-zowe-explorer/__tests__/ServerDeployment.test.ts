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
import { Gui, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
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
            const progressReport = vi.fn();
            vi.spyOn(vscode.window, "withProgress").mockImplementation(async (_opts: any, callback: any) => {
                return callback({ report: progressReport }, { isCancellationRequested: false, onCancellationRequested: vi.fn() });
            });
            vi.mocked(ZSshUtils.installServer).mockImplementation(async (_session, _path, opts) => {
                opts?.onProgress?.(25);
                opts?.onProgress?.(50);
                return true;
            });

            await deployWithProgress(fakeSession, "/server/path");

            expect(progressReport).toHaveBeenCalledTimes(2);
            expect(progressReport).toHaveBeenNthCalledWith(1, { increment: 25 });
            expect(progressReport).toHaveBeenNthCalledWith(2, { increment: 50 });
        });

        it("should forward a non-successful install result", async () => {
            vi.mocked(ZSshUtils.installServer).mockResolvedValue(false);

            const result = await deployWithProgress(fakeSession, "/server/path");

            expect(result).toEqual(false);
        });

        it("should propagate a rejection from ZSshUtils.installServer", async () => {
            vi.mocked(ZSshUtils.installServer).mockRejectedValue(new Error("install failed"));

            await expect(deployWithProgress(fakeSession, "/server/path")).rejects.toThrow("install failed");
        });

        it("should cancel the deployment if the user receives an insufficient space warning and the user presses cancel", async () => {
            vi.mocked(ZSshUtils.installServer).mockImplementation(async (_session, _serverPath, opts) => {
                const proceed = await opts!.onInsufficientSpaceWarning!(1, 20);
                return proceed;
            });
            vi.spyOn(Gui, "showMessage").mockResolvedValue("Cancel");
            expect(await deployWithProgress(fakeSession, "/server/path")).toEqual(false);
            expect(Gui.showMessage).toHaveBeenCalled();
        });
        it("should cancel the deployment if the user receives an insufficient space warning and the user closes the warning", async () => {
            vi.mocked(ZSshUtils.installServer).mockImplementation(async (_session, _serverPath, opts) => {
                const proceed = await opts!.onInsufficientSpaceWarning!(1, 20);
                return proceed;
            });
            vi.spyOn(Gui, "showMessage").mockResolvedValue(undefined); // no option selected
            expect(await deployWithProgress(fakeSession, "/server/path")).toEqual(false);
            expect(Gui.showMessage).toHaveBeenCalled();
        });
        it("should continue the deployment if the user receives an insufficient space warning and the user presses cancel", async () => {
            vi.mocked(ZSshUtils.installServer).mockImplementation(async (_session, _serverPath, opts) => {
                const proceed = await opts!.onInsufficientSpaceWarning!(1, 20);
                return proceed;
            });
            let guiMessage = '';
            vi.spyOn(Gui, "showMessage").mockImplementation(async (messageArg, _opts) => {
                guiMessage = messageArg;
                return 'Deploy';
            });
            const mockServerPath = '/server/path';
            expect(await deployWithProgress(fakeSession, mockServerPath)).toEqual(true);
            expect(Gui.showMessage).toHaveBeenCalled();
            expect(guiMessage).toContain(`The remote directory '${mockServerPath}' appears to have only 1 MB available`);

        });

        it("should adapt the warning message if the SSH SDK could not determine the available space", async () => {
            vi.mocked(ZSshUtils.installServer).mockImplementation(async (_session, _serverPath, opts) => {
                const proceed = await opts!.onInsufficientSpaceWarning!(-1, 20);
                return proceed;
            });
            let guiMessage = '';
            const mockServerPath = '/server/path';
            vi.spyOn(Gui, "showMessage").mockImplementation(async (messageArg, _opts) => {
                guiMessage = messageArg;
                return 'Cancel';
            });
            expect(await deployWithProgress(fakeSession, mockServerPath)).toEqual(false); // canceled
            expect(Gui.showMessage).toHaveBeenCalled();
            expect(guiMessage).toContain(`We couldn't detect how much space is available in the remote directory '${mockServerPath}'.`);
        });
    });
});
