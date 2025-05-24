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
import * as fs from "fs/promises";
import { ReleaseNotes } from "../../../src/utils/ReleaseNotes";
import { ExtensionContext } from "vscode";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { Constants } from "../../../src/configuration/Constants";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";

jest.mock("fs/promises", () => {
    return {
        readFile: jest
            .fn()
            .mockResolvedValue(
                "## `3.2.2`\n- Patch for 3.2.2\n\n" +
                    "## `3.2.1`\n- Patch for 3.2.1\n\n" +
                    "## `3.2.0`\n- Added feature\n\n" +
                    "## `3.1.1`\n- Patch for 3.1.1\n\n" +
                    "## `3.1.0`\n- Old stuff"
            ),
    };
});

describe("ReleaseNotes Webview", () => {
    let context: ExtensionContext;
    let panelMock: any;
    let postMessageMock: jest.Mock;
    const changelog =
        "## `3.2.2`\n- Patch for 3.2.2\n\n" +
        "## `3.2.1`\n- Patch for 3.2.1\n\n" +
        "## `3.2.0`\n- Added feature\n\n" +
        "## `3.1.1`\n- Patch for 3.1.1\n\n" +
        "## `3.1.0`\n- Old stuff";

    function assignPanelToInstance() {
        if (ReleaseNotes.instance) {
            (ReleaseNotes.instance as any).panel = panelMock;
        }
    }

    beforeEach(() => {
        postMessageMock = jest.fn();
        panelMock = {
            webview: { postMessage: postMessageMock },
            reveal: jest.fn(),
            onDidDispose: jest.fn((cb) => cb()),
        };
        context = {
            subscriptions: [],
            extensionPath: "./test",
            asAbsolutePath: (p: string) => p,
            extension: {
                packageJSON: { version: "3.2.3" },
            },
        } as unknown as vscode.ExtensionContext;

        Object.defineProperty(ZoweLocalStorage, "globalState", {
            value: {
                get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
                update: jest.fn(),
                keys: () => [],
            },
            configurable: true,
        });

        // Reset singleton
        (ReleaseNotes as any).instance = undefined;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Release notes display logic", () => {
        it("should show release notes if setting is 'always'", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS_KEYS.ALWAYS);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);

            ReleaseNotes.show(context, false);
            assignPanelToInstance();
            expect(ReleaseNotes.instance).toBeDefined();
        });

        it("should not show release notes if setting is 'never'", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS_KEYS.NEVER);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);

            ReleaseNotes.show(context, false);
            expect(ReleaseNotes.instance).toBeUndefined();
        });

        it("should only show release notes if version changed for 'disableForThisVersion'", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS_KEYS.DISABLE_FOR_THIS_VERSION);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.1");

            ReleaseNotes.show(context, false);
            assignPanelToInstance();
            expect(ReleaseNotes.instance).toBeDefined();

            // If version is the same, should not show
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.2");
            (ReleaseNotes as any).instance = undefined;
            ReleaseNotes.show(context, false);
            expect(ReleaseNotes.instance).toBeUndefined();
        });

        it("should always show release notes if force=true", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS_KEYS.NEVER);

            ReleaseNotes.show(context, true);
            assignPanelToInstance();
            expect(ReleaseNotes.instance).toBeDefined();
        });

        it("should reveal panel if ReleaseNotes.instance already exists", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS_KEYS.ALWAYS);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);

            ReleaseNotes.instance = new ReleaseNotes(context, "3.2");
            const revealSpy = jest.fn();
            (ReleaseNotes.instance as any).panel = { reveal: revealSpy, onDidDispose: jest.fn() };

            ReleaseNotes.show(context, false);

            expect(revealSpy).toHaveBeenCalled();
        });
    });

    describe("onDidReceiveMessage", () => {
        it("should update setting on dropdown change via onDidReceiveMessage", async () => {
            jest.spyOn(SettingsConfig, "setDirectValue").mockResolvedValue(undefined as any);

            const rn = new ReleaseNotes(context, "3.2");
            await rn.onDidReceiveMessage({ command: Constants.RELEASE_NOTES_OPTS_KEYS.NEVER });
            expect(SettingsConfig.setDirectValue).toHaveBeenCalledWith(
                Constants.SETTINGS_SHOW_RELEASE_NOTES,
                Constants.RELEASE_NOTES_OPTS_KEYS.NEVER
            );

            await rn.onDidReceiveMessage({ command: Constants.RELEASE_NOTES_OPTS_KEYS.DISABLE_FOR_THIS_VERSION });
            expect(SettingsConfig.setDirectValue).toHaveBeenCalledWith(
                Constants.SETTINGS_SHOW_RELEASE_NOTES,
                Constants.RELEASE_NOTES_OPTS_KEYS.DISABLE_FOR_THIS_VERSION
            );

            await rn.onDidReceiveMessage({ command: Constants.RELEASE_NOTES_OPTS_KEYS.ALWAYS });
            expect(SettingsConfig.setDirectValue).toHaveBeenCalledWith(
                Constants.SETTINGS_SHOW_RELEASE_NOTES,
                Constants.RELEASE_NOTES_OPTS_KEYS.ALWAYS
            );
        });

        it("should do nothing if message does not have 'command'", async () => {
            const rn = new ReleaseNotes(context, "3.2");
            await expect(rn.onDidReceiveMessage({})).resolves.toBeUndefined();
        });

        it("should call sendReleaseNotes if command is 'ready'", async () => {
            const rn = new ReleaseNotes(context, "3.2");
            const sendSpy = jest.spyOn(rn, "sendReleaseNotes").mockResolvedValue(true);
            await rn.onDidReceiveMessage({ command: "ready" });
            expect(sendSpy).toHaveBeenCalled();
        });

        it("should do nothing for unknown command", async () => {
            const rn = new ReleaseNotes(context, "3.2");
            await expect(rn.onDidReceiveMessage({ command: "unknown_command" })).resolves.toBeUndefined();
        });
    });

    describe("Notes extraction", () => {
        it("should extract all notes for 3.2.x versions", () => {
            const rn = new ReleaseNotes(context, "3.2");
            const notes = rn.extractCurrentVersionNotes(changelog);
            expect(notes).toContain("Patch for 3.2.2");
            expect(notes).toContain("Patch for 3.2.1");
            expect(notes).toContain("Added feature");
            expect(notes).not.toContain("Patch for 3.1.1");
            expect(notes).not.toContain("Old stuff");
        });

        it("should handle missing changelog entries gracefully", () => {
            const rn = new ReleaseNotes(context, "4.0");
            const notes = rn.extractCurrentVersionNotes(changelog);
            expect(notes).toContain("No changelog entries found for this version.");
        });

        it("should return extracted notes when changelog file is read successfully", async () => {
            const rn = new ReleaseNotes(context, "3.2");
            const extractSpy = jest.spyOn(rn, "extractCurrentVersionNotes").mockReturnValue("some notes");
            const result = await rn.getChangelog();
            expect(result).toBe("some notes");
            expect(extractSpy).toHaveBeenCalled();
        });

        it("should return error message and logs error if changelog file cannot be read", async () => {
            const rn = new ReleaseNotes(context, "3.2");
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fsMock = require("fs/promises");
            fsMock.readFile.mockRejectedValueOnce(new Error("File not found"));
            const loggerSpy = jest.spyOn(ZoweLogger, "error").mockImplementation(() => {});
            const result = await rn.getChangelog();
            expect(result).toBe("No changelog entries found for this version.");
            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("Error reading changelog file: Error: File not found"));
        });

        it("should handle missing release notes entries gracefully", () => {
            const rn = new ReleaseNotes(context, "4.0");
            const notes = rn.extractCurrentVersionNotes("## `3.2.0`\n- Added feature release\n\n## `3.1.0`\n- Old stuff release");
            expect(notes).toContain("No changelog entries found for this version.");
        });
    });

    describe("Send notes functionality", () => {
        it("should read and send the correct release notes for the version", async () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS_KEYS.ALWAYS);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);

            ReleaseNotes.show(context, false);
            assignPanelToInstance();

            const rn = new ReleaseNotes(context, "3.2");
            (rn as any).panel = panelMock;
            await rn.sendReleaseNotes();

            // Should include all 3.2.x release notes, not 3.1.x
            expect(postMessageMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    releaseNotes: expect.stringContaining("Patch for 3.2.2"),
                })
            );
            expect(postMessageMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    releaseNotes: expect.stringContaining("Patch for 3.2.1"),
                })
            );
            expect(postMessageMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    releaseNotes: expect.stringContaining("Added feature"),
                })
            );
            expect(postMessageMock).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    releaseNotes: expect.stringContaining("Patch for 3.1.1"),
                })
            );
        });

        it("should return error message if release notes file is missing", async () => {
            const version = "4.0";
            // Simulate file not found
            (fs.readFile as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error("File not found")));
            const rn = new ReleaseNotes(context, version);
            const loggerSpy = jest.spyOn(ZoweLogger, "error").mockImplementation(() => {});
            const notes = await rn.getReleaseNotes();
            expect(notes).toMatch(/No release notes found for this version/);
            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("[ReleaseNotes] Error reading release notes file: Error: File not found"));
        });

        it("should call getAllMajorMinorVersions and include versionOptions in sendReleaseNotes postMessage", async () => {
            const version = "3.2";
            const rn = new ReleaseNotes(context, version);
            (rn as any).panel = panelMock;
            const versionOpts = ["3.2", "3.1", "4.0"];
            const getAllMajorMinorVersionsSpy = jest.spyOn(rn, "getAllMajorMinorVersions").mockResolvedValueOnce(versionOpts);

            jest.spyOn(rn, "getReleaseNotes").mockResolvedValueOnce("release notes content");
            jest.spyOn(rn, "getChangelog").mockResolvedValueOnce("changelog content");

            await rn.sendReleaseNotes();

            expect(getAllMajorMinorVersionsSpy).toHaveBeenCalled();
            expect(postMessageMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    versionOptions: versionOpts,
                    releaseNotes: "release notes content",
                    changelog: "changelog content",
                    version: version,
                })
            );
        });
    });

    describe("getAllMajorMinorVersions", () => {
        it("should always include the extension's original version in version options, even after switching dropdown", async () => {
            // Simulate extension version is 3.3, changelog only has 3.2 and 3.1, and dropdown is switched to 3.2
            context.extension.packageJSON.version = "3.3.0";
            (fs.readFile as jest.Mock).mockResolvedValueOnce(changelog);
            const rn = new ReleaseNotes(context, "3.2");
            const versions = await rn.getAllMajorMinorVersions();
            expect(versions).toContain("3.3"); // extension's original version
            expect(versions).toContain("3.2"); // currently selected version
            expect(versions).toContain("3.1");
        });

        it("should include both extension version and selected version if both are missing from changelog", async () => {
            // Simulate extension version is 4.0, selected version is 5.0, changelog only has 3.2 and 3.1
            context.extension.packageJSON.version = "4.0.0";
            (fs.readFile as jest.Mock).mockResolvedValueOnce(changelog);
            const rn = new ReleaseNotes(context, "5.0");
            const versions = await rn.getAllMajorMinorVersions();
            expect(versions).toContain("4.0"); // extension's original version
            expect(versions).toContain("5.0"); // currently selected version
            expect(versions).toContain("3.2");
            expect(versions).toContain("3.1");
        });

        it("should not duplicate extension version or selected version if already present in changelog", async () => {
            // Simulate extension version is 3.2, selected version is 3.2, changelog has 3.2 and 3.1
            context.extension.packageJSON.version = "3.2.3";
            (fs.readFile as jest.Mock).mockResolvedValueOnce(changelog);
            const rn = new ReleaseNotes(context, "3.2");
            const versions = await rn.getAllMajorMinorVersions();
            expect(versions.filter((v) => v === "3.2").length).toBe(1);
        });

        it("should return empty array and log error if changelog cannot be read in getAllMajorMinorVersions", async () => {
            (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error("File not found"));
            const rn = new ReleaseNotes(context, "3.2");
            const loggerSpy = jest.spyOn(ZoweLogger, "error").mockImplementation(() => {});
            const versions = await rn.getAllMajorMinorVersions();
            expect(versions).toEqual([]);
            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("Error parsing changelog for versions: Error: File not found"));
        });
    });
});
