import { useEffect, useRef } from "react";
import { isSecureOrigin } from "../../utils";
import { handleMessage, MessageHandlerProps } from "../handlers/messageHandlers";
import { postProfilesAndEnv } from "../utils/extensionRequests";

// selectedProfileKeyRef is now part of MessageHandlerProps; no extra fields needed here.
type UseMessageHandlerProps = MessageHandlerProps;

export function useMessageHandler(props: UseMessageHandlerProps) {
    const propsRef = useRef(props);

    useEffect(() => {
        propsRef.current = props;
    });

    const {
        setConfigurations,
        setSelectedTab,
        setSelectedProfileKey,
        setFlattenedConfig,
        setFlattenedDefaults,
        setMergedProperties,
        setPendingChanges,
        setDeletions,
        setPendingDefaults,
        setDefaultsDeletions,
        setProfileSearchTerm,
        setProfileFilterType,
        setHasPromptedForZeroConfigs,
        setConfigParseErrors,
        vscodeApi,
        selectedProfileKeyRef,
    } = props;

    useEffect(() => {
        setConfigParseErrors([]);
        setConfigurations([]);
        setSelectedTab(null);
        setSelectedProfileKey(null);
        setFlattenedConfig({});
        setFlattenedDefaults({});
        setMergedProperties(null);
        setPendingChanges({});
        setDeletions({});
        setPendingDefaults({});
        setDefaultsDeletions({});
        setProfileSearchTerm("");
        setProfileFilterType(null);
        setHasPromptedForZeroConfigs(false);

        const messageListener = (event: MessageEvent) => {
            if (!isSecureOrigin(event.origin)) {
                return;
            }

            handleMessage(event, propsRef.current);
        };

        window.addEventListener("message", messageListener);

        // Only request env information on initial mount — the extension already sends
        // CONFIGURATIONS via initializeWebview() in the constructor, so a GET_PROFILES
        // here would race with that and cause a second CONFIGURATIONS_READY that consumes
        // this.initialSelection before INITIAL_SELECTION can be applied.
        vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });

        const handleWindowFocus = () => {
            if (!selectedProfileKeyRef.current) {
                // On re-focus (e.g. user switched away and back), refresh profiles and env.
                postProfilesAndEnv(vscodeApi);
                vscodeApi.postMessage({ command: "GET_KEYBINDS" });
            }
        };

        const handleVisibilityChange = () => {
            if (!document.hidden && !selectedProfileKeyRef.current) {
                postProfilesAndEnv(vscodeApi);
            }
        };

        window.addEventListener("focus", handleWindowFocus);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("message", messageListener);
            window.removeEventListener("focus", handleWindowFocus);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);
}
