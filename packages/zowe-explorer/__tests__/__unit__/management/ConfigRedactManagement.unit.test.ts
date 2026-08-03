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

import * as vscode from "vscode";
import { Gui } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../src/configuration/Profiles";
import { ConfigRedactManagement } from "../../../src/management/ConfigRedactManagement";

describe("ConfigRedactManagement unit tests", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function createGlobalMocks() {
        const exportedFiles = [{ file: "zowe.config.json" }];
        const exportToDirectory = vi.fn().mockReturnValue(exportedFiles);
        const mockProfileInfo = {
            getTeamConfig: () => ({
                api: { redact: { exportToDirectory } },
            }),
        };
        const dirUri = { fsPath: "/tmp/export" } as vscode.Uri;
        const getProfileInfo = vi.fn().mockResolvedValue(mockProfileInfo);
        Object.defineProperty(Profiles, "getInstance", {
            value: vi.fn().mockReturnValue({ getProfileInfo }),
            configurable: true,
        });

        Object.defineProperty(vscode.env, "openExternal", {
            value: vi.fn().mockResolvedValue(true),
            configurable: true,
        });

        return {
            exportedFiles,
            exportToDirectory,
            dirUri,
            getProfileInfo,
            showQuickPickSpy: vi.spyOn(Gui, "showQuickPick"),
            showOpenDialogSpy: vi.spyOn(Gui, "showOpenDialog"),
            infoMessageSpy: vi.spyOn(Gui, "infoMessage").mockResolvedValue(undefined),
            errorMessageSpy: vi.spyOn(Gui, "errorMessage").mockResolvedValue(undefined),
            warningMessageSpy: vi.spyOn(Gui, "warningMessage").mockResolvedValue("Continue" as any),
            openExternalSpy: vi.spyOn(vscode.env, "openExternal"),
        };
    }

    describe("exportRedactedConfig", () => {
        it("does nothing if the user cancels the option quick pick", async () => {
            const mocks = createGlobalMocks();
            mocks.showQuickPickSpy.mockResolvedValueOnce(undefined);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.showOpenDialogSpy).not.toHaveBeenCalled();
            expect(mocks.exportToDirectory).not.toHaveBeenCalled();
        });

        it("does nothing if the user cancels the export folder selection", async () => {
            const mocks = createGlobalMocks();
            mocks.showQuickPickSpy.mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.showOpenDialogSpy).not.toHaveBeenCalled();
            expect(mocks.exportToDirectory).not.toHaveBeenCalled();
        });

        it("does nothing if the user closes the folder browse dialog", async () => {
            const mocks = createGlobalMocks();
            mocks.showQuickPickSpy.mockResolvedValueOnce([]).mockResolvedValueOnce({ label: "browse" } as any);
            mocks.showOpenDialogSpy.mockResolvedValueOnce(undefined);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.exportToDirectory).not.toHaveBeenCalled();
        });

        it("exports the redacted config with the selected options and shows an info message", async () => {
            const mocks = createGlobalMocks();
            const redactStringsItem = { key: "redactStrings", label: "Redact string values" } as any;
            mocks.showQuickPickSpy.mockResolvedValueOnce([redactStringsItem]).mockResolvedValueOnce({ label: "browse" } as any);
            mocks.showOpenDialogSpy.mockResolvedValueOnce([mocks.dirUri]);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.exportToDirectory).toHaveBeenCalledWith(
                mocks.dirUri.fsPath,
                expect.objectContaining({
                    redactStrings: true,
                    redactNumbers: false,
                    redactBooleans: false,
                    redactProfileNames: false,
                    hideSecureFields: false,
                    showHostPath: false,
                })
            );
            expect(mocks.infoMessageSpy).toHaveBeenCalled();
            expect(mocks.errorMessageSpy).not.toHaveBeenCalled();
        });

        it("opens the export folder when the user selects the Open Folder action", async () => {
            const mocks = createGlobalMocks();
            mocks.showQuickPickSpy.mockResolvedValueOnce([]).mockResolvedValueOnce({ label: "browse" } as any);
            mocks.showOpenDialogSpy.mockResolvedValueOnce([mocks.dirUri]);
            mocks.infoMessageSpy.mockResolvedValueOnce("Open Folder" as any);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.openExternalSpy).toHaveBeenCalledWith(mocks.dirUri);
        });

        it("shows an info message and does not attempt to open a folder when no files are exported", async () => {
            const mocks = createGlobalMocks();
            mocks.exportToDirectory.mockReturnValueOnce([]);
            mocks.showQuickPickSpy.mockResolvedValueOnce([]).mockResolvedValueOnce({ label: "browse" } as any);
            mocks.showOpenDialogSpy.mockResolvedValueOnce([mocks.dirUri]);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.infoMessageSpy).toHaveBeenCalled();
            expect(mocks.openExternalSpy).not.toHaveBeenCalled();
        });

        it("warns and cancels if no redact options are selected and the user does not continue", async () => {
            const mocks = createGlobalMocks();
            mocks.showQuickPickSpy.mockResolvedValueOnce([]);
            mocks.warningMessageSpy.mockResolvedValueOnce(undefined);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.warningMessageSpy).toHaveBeenCalled();
            expect(mocks.showOpenDialogSpy).not.toHaveBeenCalled();
            expect(mocks.exportToDirectory).not.toHaveBeenCalled();
        });

        it("warns but proceeds if only the show host/basePath option is selected", async () => {
            const mocks = createGlobalMocks();
            const showHostPathItem = { key: "showHostPath", label: "Show host and basePath values" } as any;
            mocks.showQuickPickSpy.mockResolvedValueOnce([showHostPathItem]).mockResolvedValueOnce({ label: "browse" } as any);
            mocks.showOpenDialogSpy.mockResolvedValueOnce([mocks.dirUri]);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.warningMessageSpy).toHaveBeenCalled();
            expect(mocks.exportToDirectory).toHaveBeenCalledWith(
                mocks.dirUri.fsPath,
                expect.objectContaining({
                    redactStrings: false,
                    redactNumbers: false,
                    redactBooleans: false,
                    redactProfileNames: false,
                    hideSecureFields: false,
                    showHostPath: true,
                })
            );
        });

        it("does not warn if at least one redact option is selected", async () => {
            const mocks = createGlobalMocks();
            const redactStringsItem = { key: "redactStrings", label: "Redact string values" } as any;
            mocks.showQuickPickSpy.mockResolvedValueOnce([redactStringsItem]).mockResolvedValueOnce({ label: "browse" } as any);
            mocks.showOpenDialogSpy.mockResolvedValueOnce([mocks.dirUri]);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.warningMessageSpy).not.toHaveBeenCalled();
        });

        it("shows an error message if exporting the redacted config fails", async () => {
            const mocks = createGlobalMocks();
            mocks.exportToDirectory.mockImplementationOnce(() => {
                throw new Error("export failed");
            });
            mocks.showQuickPickSpy.mockResolvedValueOnce([]).mockResolvedValueOnce({ label: "browse" } as any);
            mocks.showOpenDialogSpy.mockResolvedValueOnce([mocks.dirUri]);

            await ConfigRedactManagement.exportRedactedConfig();

            expect(mocks.errorMessageSpy).toHaveBeenCalled();
            expect(mocks.infoMessageSpy).not.toHaveBeenCalled();
        });
    });
});
