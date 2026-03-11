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
        it("should not display release notes on first install (no previous version)", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(null);

            ReleaseNotes.display(context, false);
            expect(ReleaseNotes.instance).toBeUndefined();
        });

        it("should not display release notes if setting is false", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.1");

            ReleaseNotes.display(context, false);
            expect(ReleaseNotes.instance).toBeUndefined();
        });

        it("should display release notes if version increased and setting is true", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.1");

            ReleaseNotes.display(context, false);
            assignPanelToInstance();
            expect(ReleaseNotes.instance).toBeDefined();
        });

        it("should not display release notes if version stayed the same", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.2");

            ReleaseNotes.display(context, false);
            expect(ReleaseNotes.instance).toBeUndefined();
        });

        it("should not display release notes if version decreased", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.3");

            ReleaseNotes.display(context, false);
            expect(ReleaseNotes.instance).toBeUndefined();
        });

        it("should not display release notes for SNAPSHOT versions", () => {
            context.extension.packageJSON.version = "3.4.0-SNAPSHOT";
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.3");

            ReleaseNotes.display(context, false);
            expect(ReleaseNotes.instance).toBeUndefined();
        });

        it("should always display release notes if force=true", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);

            ReleaseNotes.display(context, true);
            assignPanelToInstance();
            expect(ReleaseNotes.instance).toBeDefined();
        });

        it("should reveal panel if ReleaseNotes.instance already exists", () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.1");

            ReleaseNotes.instance = new ReleaseNotes(context, "3.2");
            const revealSpy = jest.fn();
            (ReleaseNotes.instance as any).panel = { reveal: revealSpy, onDidDispose: jest.fn() };

            ReleaseNotes.display(context, false);
        });
    });

    describe("Version comparison", () => {
        it("should correctly compare major version increases", () => {
            expect(ReleaseNotes.compareVersions("4.0", "3.7")).toBeGreaterThan(0);
            expect(ReleaseNotes.compareVersions("3.7", "4.0")).toBeLessThan(0);
        });

        it("should correctly compare minor version increases", () => {
            expect(ReleaseNotes.compareVersions("3.7", "3.6")).toBeGreaterThan(0);
            expect(ReleaseNotes.compareVersions("3.6", "3.7")).toBeLessThan(0);
        });

        it("should return 0 for equal versions", () => {
            expect(ReleaseNotes.compareVersions("3.7", "3.7")).toBe(0);
            expect(ReleaseNotes.compareVersions("4.0", "4.0")).toBe(0);
        });
    });

    describe("Extension version extraction", () => {
        it("should extract major.minor from regular version", () => {
            context.extension.packageJSON.version = "3.2.5";
            expect(ReleaseNotes.getExtensionVersion(context)).toBe("3.2");
        });

        it("should extract major.minor from SNAPSHOT version", () => {
            context.extension.packageJSON.version = "3.4.0-SNAPSHOT";
            expect(ReleaseNotes.getExtensionVersion(context)).toBe("3.4");
        });
    });

    describe("LocalStorage behavior", () => {
        it("should update localStorage for non-SNAPSHOT versions", () => {
            const setValueSpy = jest.spyOn(ZoweLocalStorage, "setValue");
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.1");

            ReleaseNotes.shouldDisplayReleaseNotes(context);
            expect(setValueSpy).toHaveBeenCalledWith(expect.any(String), "3.2");
        });

        it("should not update localStorage for SNAPSHOT versions", () => {
            context.extension.packageJSON.version = "3.4.0-SNAPSHOT";
            const setValueSpy = jest.spyOn(ZoweLocalStorage, "setValue");
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue("3.3");

            ReleaseNotes.shouldDisplayReleaseNotes(context);
            expect(setValueSpy).not.toHaveBeenCalled();
        });

        it("should update localStorage on first install for non-SNAPSHOT versions", () => {
            const setValueSpy = jest.spyOn(ZoweLocalStorage, "setValue");
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(null);

            ReleaseNotes.shouldDisplayReleaseNotes(context);
            expect(setValueSpy).toHaveBeenCalledWith(expect.any(String), "3.2");
        });
    });

    describe("onDidReceiveMessage", () => {
        it("should update setting on checkbox change via onDidReceiveMessage", async () => {
            jest.spyOn(SettingsConfig, "setDirectValue").mockResolvedValue(undefined as any);

            const rn = new ReleaseNotes(context, "3.2");
            await rn.onDidReceiveMessage({ command: "toggleDisplayAfterUpdate", checked: false });
            expect(SettingsConfig.setDirectValue).toHaveBeenCalledWith(Constants.SETTINGS_DISPLAY_RELEASE_NOTES, false);

            await rn.onDidReceiveMessage({ command: "toggleDisplayAfterUpdate", checked: true });
            expect(SettingsConfig.setDirectValue).toHaveBeenCalledWith(Constants.SETTINGS_DISPLAY_RELEASE_NOTES, true);
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

        it("should call sendReleaseNotes if command is 'selectVersion'", async () => {
            const rn = new ReleaseNotes(context, "3.2");
            const sendSpy = jest.spyOn(rn, "sendReleaseNotes").mockResolvedValue(true);
            await rn.onDidReceiveMessage({ command: "selectVersion", version: "3.1" });
            expect(sendSpy).toHaveBeenCalled();
            expect(rn["version"]).toBe("3.1");
        });

        it("should do nothing for unknown command", async () => {
            const rn = new ReleaseNotes(context, "3.2");
            await expect(rn.onDidReceiveMessage({ command: "unknown_command" })).resolves.toBeUndefined();
        });
    });

    describe("Notes extraction", () => {
        it("should extract all notes for 3.2.x versions", () => {
            const rn = new ReleaseNotes(context, "3.2");
            const notes = rn.extractCurrentVersionNotes(changelog, "release notes");
            expect(notes).toContain("Patch for 3.2.2");
            expect(notes).toContain("Patch for 3.2.1");
            expect(notes).toContain("Added feature");
            expect(notes).not.toContain("Patch for 3.1.1");
            expect(notes).not.toContain("Old stuff");
        });

        it("should handle missing changelog entries gracefully", () => {
            const rn = new ReleaseNotes(context, "4.0");
            const notes = rn.extractCurrentVersionNotes(changelog, "changelog");
            expect(notes).toContain("No {0} entries found for this version.");
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
            const notes = rn.extractCurrentVersionNotes("## `3.2.0`\n- Added feature release\n\n## `3.1.0`\n- Old stuff release", "release notes");
            expect(notes).toBe("No {0} entries found for this version.");
        });
    });

    describe("Send notes functionality", () => {
        it("should read and send the correct release notes for the version", async () => {
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
            jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);

            ReleaseNotes.display(context, false);
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

    describe("Localization", () => {
        let originalL10n: any;

        beforeEach(() => {
            originalL10n = vscode.l10n;
        });

        afterEach(() => {
            if (originalL10n !== undefined) {
                Object.defineProperty(vscode, "l10n", { value: originalL10n, configurable: true, writable: true });
            }
        });

        it("should send localization content when command is GET_LOCALIZATION", async () => {
            const rn = new ReleaseNotes(context, "3.2");
            (rn as any).panel = panelMock;
            const l10nPath = "zowe-explorer/l10n/bundle.l10n.json";

            Object.defineProperty(vscode, "l10n", {
                value: { uri: { fsPath: l10nPath }, t: (s: string) => s, bundle: undefined },
                configurable: true,
                writable: true,
            });

            const l10nContent = JSON.stringify({ test: "content" });
            (fs.readFile as jest.Mock).mockResolvedValueOnce(l10nContent);

            await rn.onDidReceiveMessage({ command: "GET_LOCALIZATION" });

            expect(fs.readFile).toHaveBeenCalledWith(l10nPath, { encoding: "utf8" });
            expect(postMessageMock).toHaveBeenCalledWith({
                command: "GET_LOCALIZATION",
                contents: l10nContent,
            });
        });

        it("should log warning if reading localization file fails", async () => {
            const rn = new ReleaseNotes(context, "3.2");
            const l10nPath = "zowe-explorer/l10n/bundle.l10n.json";

            Object.defineProperty(vscode, "l10n", {
                value: { uri: { fsPath: l10nPath }, t: (s: string) => s, bundle: undefined },
                configurable: true,
                writable: true,
            });

            (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error("Read failed"));
            const loggerSpy = jest.spyOn(ZoweLogger, "warn").mockImplementation(() => {});

            await rn.onDidReceiveMessage({ command: "GET_LOCALIZATION" });

            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("Could not load localization file"));
        });

        it("should do nothing if l10n.uri is undefined", async () => {
            const rn = new ReleaseNotes(context, "3.2");

            Object.defineProperty(vscode, "l10n", {
                value: { uri: undefined, t: (s: string) => s, bundle: undefined },
                configurable: true,
                writable: true,
            });

            await rn.onDidReceiveMessage({ command: "GET_LOCALIZATION" });

            expect(postMessageMock).not.toHaveBeenCalled();
        });
    });
});
