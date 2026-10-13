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

import { vi } from "vitest";
import { useConfigHandlers } from "../../../../src/webviews/src/config-editor/hooks/useConfigHandlers";
import { useConfigContext } from "../../../../src/webviews/src/config-editor/context/ConfigContext";
import { useProfileUtils } from "../../../../src/webviews/src/config-editor/hooks/useProfileUtils";
import type { Configuration } from "../../../../src/webviews/src/config-editor/types";
import {
    handleConfigurationsMessage,
    handleInitialSelectionMessage,
    type MessageHandlerProps,
} from "../../../../src/webviews/src/config-editor/handlers/messageHandlers";

vi.mock("react", () => ({ useCallback: (callback: unknown) => callback }));
vi.mock("../../../../src/webviews/src/config-editor/context/ConfigContext", () => ({ useConfigContext: vi.fn() }));
vi.mock("../../../../src/webviews/src/config-editor/hooks/useProfileUtils", () => ({ useProfileUtils: vi.fn() }));

function makeProps(overrides: Partial<MessageHandlerProps> = {}): MessageHandlerProps {
    return {
        setConfigurations: vi.fn(),
        setSelectedTab: vi.fn(),
        setSelectedProfileKey: vi.fn(),
        setFlattenedConfig: vi.fn(),
        setFlattenedDefaults: vi.fn(),
        setMergedProperties: vi.fn(),
        setPendingChanges: vi.fn(),
        setDeletions: vi.fn(),
        setPendingDefaults: vi.fn(),
        setDefaultsDeletions: vi.fn(),
        setProfileSearchTerm: vi.fn(),
        setProfileFilterType: vi.fn(),
        setHasPromptedForZeroConfigs: vi.fn(),
        setSaveModalOpen: vi.fn(),
        setPendingMergedPropertiesRequest: vi.fn(),
        setNewProfileValue: vi.fn(),
        setHasWorkspace: vi.fn(),
        setSelectedProfilesByConfig: vi.fn(),
        setConfigEditorSettings: vi.fn(),
        setSortOrderVersion: vi.fn(),
        setSecureValuesAllowed: vi.fn(),
        setSchemaValidations: vi.fn(),
        setAddConfigModalOpen: vi.fn(),
        setIsSaving: vi.fn(),
        setPendingSaveSelection: vi.fn(),
        setWizardProfileNameValidation: vi.fn(),
        setRenames: vi.fn(),
        setConfigParseErrors: vi.fn(),
        setTutorialSeen: vi.fn(),
        setShowTutorial: vi.fn(),
        setHighlightPropertyKey: vi.fn(),
        setHighlightProfileCard: vi.fn(),
        configurationsRef: { current: [] },
        mergedPropertiesLatestRequestSeqRef: { current: 0 },
        selectedProfileKeyRef: { current: null },
        pendingSaveSelection: null,
        selectedTab: null,
        selectedProfilesByConfig: {},
        hasPromptedForZeroConfigs: false,
        clearHistory: vi.fn(),
        validationRequestSeqRef: { current: 0 },
        handleRefresh: vi.fn(),
        handleSave: vi.fn(),
        handleChange: vi.fn(),
        vscodeApi: { postMessage: vi.fn() },
        ...overrides,
    };
}

const EMPTY_CONTENTS: any[] = [];

describe("Config Editor selection after a layer refresh", () => {
    const team: Configuration = {
        configPath: "/mock/team.json",
        properties: { profiles: {}, defaults: { base: "team-base" } },
        secure: [],
    };
    const user: Configuration = {
        configPath: "/mock/user.json",
        properties: { profiles: {}, defaults: { base: "user-base" } },
        secure: [],
    };

    afterEach(() => vi.useRealTimers());

    it.each([
        { name: "removing the layer before the selected file", previous: [user, team], contents: [team], selected: 1, expected: 0 },
        { name: "reordering layers", previous: [user, team], contents: [team, user], selected: 1, expected: 0 },
        { name: "removing the selected file", previous: [user, team], contents: [team], selected: 0, expected: 0 },
        { name: "adding a layer", previous: [team], contents: [user, team], selected: 0, expected: 0 },
        { name: "removing all layers", previous: [team], contents: [], selected: 0, expected: null },
    ])("selects a valid layer after $name", ({ previous, contents, selected, expected }) => {
        const props = makeProps({ configurationsRef: { current: previous }, selectedTab: selected });
        handleConfigurationsMessage({ contents }, props);
        const update = vi.mocked(props.setSelectedTab).mock.calls[0][0];
        expect(typeof update === "function" ? update(selected) : update).toBe(expected);
        if (contents.length) {
            expect(props.setFlattenedDefaults).toHaveBeenCalledWith({
                base: { value: contents[expected!].properties.defaults.base, path: ["defaults", "base"] },
            });
        }
    });

    it("restores the saved file after its index changes", () => {
        const props = makeProps({
            configurationsRef: { current: [user, team] },
            selectedTab: 1,
            pendingSaveSelection: { tab: 1, profile: "team-base" },
        });
        handleConfigurationsMessage({ contents: [team] }, props);
        expect(props.setSelectedTab).toHaveBeenCalledWith(0);
        expect(props.setSelectedProfileKey).toHaveBeenCalledWith("team-base");
    });

    it("does not restore an obsolete tab index after a fast refresh response", () => {
        vi.useFakeTimers();
        const props = makeProps({ configurationsRef: { current: [user, team] }, selectedTab: 1 });
        let selectedTab: number | null = 1;
        vi.mocked(props.setSelectedTab).mockImplementation((update) => {
            selectedTab = typeof update === "function" ? update(selectedTab) : update;
        });
        vi.mocked(useConfigContext).mockReturnValue({
            ...props,
            configurations: [user, team],
            selectedProfileKey: null,
            pendingChanges: {},
            deletions: {},
            pendingDefaults: {},
            defaultsDeletions: {},
            autostoreChanges: {},
            renames: {},
            dragDroppedProfiles: {},
            setAutostoreChanges: vi.fn(),
            setDragDroppedProfiles: vi.fn(),
            setHiddenItems: vi.fn(),
            configEditorSettings: { profilesWidthPercent: 35 },
        } as ReturnType<typeof useConfigContext>);
        vi.mocked(useProfileUtils).mockReturnValue({
            doesProfileExist: vi.fn(),
            doesSavedProfileExist: vi.fn(),
        } as ReturnType<typeof useProfileUtils>);
        vi.mocked(props.vscodeApi.postMessage).mockImplementation((message) => {
            if ("command" in message && message.command === "GET_PROFILES") handleConfigurationsMessage({ contents: [team] }, props);
        });

        useConfigHandlers({ setPendingProfileDeletion: vi.fn(), setPendingPropertyDeletion: vi.fn() }).handleRefresh();
        vi.runAllTimers();

        expect(selectedTab).toBe(0);
        expect(props.vscodeApi.postMessage).toHaveBeenCalledWith({ command: "GET_PROFILES" });
    });
});

describe("handleConfigurationsMessage — tutorial visibility logic", () => {
    beforeEach(() => vi.clearAllMocks());

    it("does not call setTutorialSeen or setShowTutorial when tutorialSeen is undefined", () => {
        const props = makeProps();
        handleConfigurationsMessage({ contents: EMPTY_CONTENTS }, props);
        expect(props.setTutorialSeen).not.toHaveBeenCalled();
        expect(props.setShowTutorial).not.toHaveBeenCalled();
    });

    it("calls setTutorialSeen(true) and does NOT show tutorial when tutorialSeen is true", () => {
        const props = makeProps();
        handleConfigurationsMessage({ contents: EMPTY_CONTENTS, tutorialSeen: true }, props);
        expect(props.setTutorialSeen).toHaveBeenCalledWith(true);
        expect(props.setShowTutorial).not.toHaveBeenCalled();
    });

    it("calls setTutorialSeen(false) AND setShowTutorial(true) on first open", () => {
        const props = makeProps();
        handleConfigurationsMessage({ contents: EMPTY_CONTENTS, tutorialSeen: false }, props);
        expect(props.setTutorialSeen).toHaveBeenCalledWith(false);
        expect(props.setShowTutorial).toHaveBeenCalledWith(true);
    });

    it("does NOT auto-show the tutorial for a newly-created config once it has been seen globally", () => {
        // tutorialSeen is the single source of truth now — creating a new config file no longer
        // forces the tutorial open on its own.
        const props = makeProps();
        handleConfigurationsMessage({ contents: EMPTY_CONTENTS, tutorialSeen: true }, props);
        expect(props.setShowTutorial).not.toHaveBeenCalled();
    });
});

// ─── handleInitialSelectionMessage — highlight logic ────────────────────────

describe("handleInitialSelectionMessage — profile card vs property highlight", () => {
    const CONFIG_PATH = "/path/to/zowe.config.json";

    beforeEach(() => vi.clearAllMocks());

    function makePropsWithConfig(overrides: Partial<MessageHandlerProps> = {}): MessageHandlerProps {
        return makeProps({
            configurationsRef: { current: [{ configPath: CONFIG_PATH } as any] },
            ...overrides,
        });
    }

    it("blinks the whole profile card (and not a property) when navigating to a profile with no propertyKey", () => {
        const props = makePropsWithConfig();
        handleInitialSelectionMessage({ profileName: "zosmf", configPath: CONFIG_PATH }, props);
        expect(props.setHighlightProfileCard).toHaveBeenCalledWith(true);
        expect(props.setHighlightPropertyKey).not.toHaveBeenCalled();
    });

    it("blinks only the property row (not the card) when navigating with a propertyKey", () => {
        const props = makePropsWithConfig();
        handleInitialSelectionMessage({ profileName: "zosmf", configPath: CONFIG_PATH, propertyKey: "host" }, props);
        expect(props.setHighlightProfileCard).not.toHaveBeenCalled();
        expect(props.setHighlightPropertyKey).toHaveBeenCalledWith("host");
    });

    it("still highlights the property key even when the config path is not found", () => {
        const props = makeProps({
            configurationsRef: { current: [] },
        });
        handleInitialSelectionMessage({ profileName: "zosmf", configPath: CONFIG_PATH, propertyKey: "port" }, props);
        // setHighlightProfileCard must NOT be called (no config found → profile block skipped)
        expect(props.setHighlightProfileCard).not.toHaveBeenCalled();
        // propertyKey highlight runs unconditionally after the config-tab block
        expect(props.setHighlightPropertyKey).toHaveBeenCalledWith("port");
    });

    it("selects the correct tab and profile when config path matches", () => {
        const props = makePropsWithConfig();
        handleInitialSelectionMessage({ profileName: "myprof", configPath: CONFIG_PATH }, props);
        expect(props.setSelectedTab).toHaveBeenCalledWith(0);
        expect(props.setSelectedProfileKey).toHaveBeenCalledWith("myprof");
    });

    it("normalises path separators when matching config paths", () => {
        const windowsPath = "C:\\Users\\user\\zowe.config.json";
        const props = makeProps({
            configurationsRef: {
                current: [{ configPath: windowsPath } as any],
            },
        });
        handleInitialSelectionMessage({ profileName: "zosmf", configPath: "C:/Users/user/zowe.config.json" }, props);
        expect(props.setSelectedTab).toHaveBeenCalledWith(0);
        expect(props.setHighlightProfileCard).toHaveBeenCalledWith(true);
    });

    it("does nothing when the config path is not found in the loaded configs", () => {
        const props = makePropsWithConfig();
        handleInitialSelectionMessage({ profileName: "zosmf", configPath: "/other/path.json" }, props);
        expect(props.setSelectedTab).not.toHaveBeenCalled();
        expect(props.setHighlightProfileCard).not.toHaveBeenCalled();
    });
});

describe("handleConfigurationsMessage — flattenedDefaults path prefix", () => {
    beforeEach(() => vi.clearAllMocks());

    it("ensures flattenedDefaults paths are prefixed with 'defaults'", () => {
        const props = makeProps({ selectedTab: 0 });
        const contents = [
            {
                configPath: "/mock/zowe.config.json",
                properties: {
                    profiles: {},
                    defaults: {
                        zosmf: "my_zosmf",
                        nested: {
                            sub: "val",
                        },
                    },
                },
            } as any,
        ];

        handleConfigurationsMessage({ contents }, props);

        expect(props.setFlattenedDefaults).toHaveBeenCalledWith(
            expect.objectContaining({
                zosmf: expect.objectContaining({
                    path: ["defaults", "zosmf"],
                }),
                "nested.sub": expect.objectContaining({
                    path: ["defaults", "nested", "sub"],
                }),
            })
        );
    });
});
