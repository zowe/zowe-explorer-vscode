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
import {
    handleConfigurationsMessage,
    handleInitialSelectionMessage,
    type MessageHandlerProps,
} from "../../../../src/webviews/src/config-editor/handlers/messageHandlers";

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
        handleRefresh: vi.fn(),
        handleSave: vi.fn(),
        handleChange: vi.fn(),
        vscodeApi: { postMessage: vi.fn() },
        ...overrides,
    } as unknown as MessageHandlerProps;
}

const EMPTY_CONTENTS: any[] = [];

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

    it("calls setTutorialSeen(false) AND setShowTutorial(true) on first open (tutorialSeen=false, not isNewConfig)", () => {
        const props = makeProps();
        handleConfigurationsMessage({ contents: EMPTY_CONTENTS, tutorialSeen: false }, props);
        expect(props.setTutorialSeen).toHaveBeenCalledWith(false);
        expect(props.setShowTutorial).toHaveBeenCalledWith(true);
    });

    it("does NOT auto-show tutorial when tutorialSeen=false but isNewConfig=true (isNewConfig branch handles it)", () => {
        const props = makeProps();
        handleConfigurationsMessage({ contents: EMPTY_CONTENTS, tutorialSeen: false, isNewConfig: true }, props);
        expect(props.setTutorialSeen).toHaveBeenCalledWith(false);
        // setShowTutorial is still called — but via the isNewConfig branch, not the tutorialSeen branch
        // Verify it is called exactly once (from isNewConfig path only)
        expect(props.setShowTutorial).toHaveBeenCalledTimes(1);
        expect(props.setShowTutorial).toHaveBeenCalledWith(true);
    });

    it("calls setShowTutorial(true) when isNewConfig=true regardless of tutorialSeen", () => {
        const props = makeProps();
        handleConfigurationsMessage({ contents: EMPTY_CONTENTS, tutorialSeen: true, isNewConfig: true }, props);
        expect(props.setShowTutorial).toHaveBeenCalledWith(true);
    });

    it("calls setShowTutorial(true) when isNewConfig=true and tutorialSeen is undefined", () => {
        const props = makeProps();
        handleConfigurationsMessage({ contents: EMPTY_CONTENTS, isNewConfig: true }, props);
        expect(props.setShowTutorial).toHaveBeenCalledWith(true);
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
