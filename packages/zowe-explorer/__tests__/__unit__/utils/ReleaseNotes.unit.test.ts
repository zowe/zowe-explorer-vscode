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
import { ReleaseNotes } from "../../../src/utils/ReleaseNotes";
import { ExtensionContext } from "vscode";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { Constants } from "../../../src/configuration/Constants";

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

    it("should show release notes if setting is 'always'", () => {
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS.ALWAYS_SHOW);
        jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);

        ReleaseNotes.show(context, false);
        assignPanelToInstance();
        expect(ReleaseNotes.instance).toBeDefined();
    });

    it("should not show release notes if setting is 'Never Show'", () => {
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS.NEVER_SHOW);
        jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);

        ReleaseNotes.show(context, false);
        expect(ReleaseNotes.instance).toBeUndefined();
    });

    it("should only show release notes if version changed for 'Disable for this version'", () => {
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS.DISABLE_FOR_THIS_VERSION);
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
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS.NEVER_SHOW);

        ReleaseNotes.show(context, true);
        assignPanelToInstance();
        expect(ReleaseNotes.instance).toBeDefined();
    });

    it("should send release notes and version to webview", async () => {
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(Constants.RELEASE_NOTES_OPTS.ALWAYS_SHOW);
        jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);

        ReleaseNotes.show(context, false);
        assignPanelToInstance();

        const rn = new ReleaseNotes(context, "3.2");
        (rn as any).panel = panelMock;
        await rn.sendReleaseNotes();
        expect(postMessageMock).toHaveBeenCalledWith(
            expect.objectContaining({
                releaseNotes: expect.stringContaining("Added feature"),
                version: "3.2",
                showReleaseNotesSetting: Constants.RELEASE_NOTES_OPTS.ALWAYS_SHOW,
                dropdownOptions: Constants.RELEASE_NOTES_OPTS,
            })
        );
    });

    it("should update setting on dropdown change via onDidReceiveMessage", async () => {
        jest.spyOn(SettingsConfig, "setDirectValue").mockResolvedValue(undefined as any);

        const rn = new ReleaseNotes(context, "3.2");
        await rn.onDidReceiveMessage({ command: Constants.RELEASE_NOTES_OPTS.NEVER_SHOW });
        expect(SettingsConfig.setDirectValue).toHaveBeenCalledWith(Constants.SETTINGS_SHOW_RELEASE_NOTES, Constants.RELEASE_NOTES_OPTS.NEVER_SHOW);

        await rn.onDidReceiveMessage({ command: Constants.RELEASE_NOTES_OPTS.DISABLE_FOR_THIS_VERSION });
        expect(SettingsConfig.setDirectValue).toHaveBeenCalledWith(
            Constants.SETTINGS_SHOW_RELEASE_NOTES,
            Constants.RELEASE_NOTES_OPTS.DISABLE_FOR_THIS_VERSION
        );

        await rn.onDidReceiveMessage({ command: Constants.RELEASE_NOTES_OPTS.ALWAYS_SHOW });
        expect(SettingsConfig.setDirectValue).toHaveBeenCalledWith(Constants.SETTINGS_SHOW_RELEASE_NOTES, Constants.RELEASE_NOTES_OPTS.ALWAYS_SHOW);
    });

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
        expect(notes).toContain("No changelog entries found for version 4.0.");
    });
});
