import { useEffect, MutableRefObject, useRef } from "react";
import { isSecureOrigin } from "../../utils";
import { handleMessage, MessageHandlerProps } from "../handlers/messageHandlers";
import { postProfilesAndEnv } from "../utils/extensionRequests";

interface UseMessageHandlerProps extends MessageHandlerProps {
    selectedProfileKeyRef: MutableRefObject<string | null>;
}

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

        postProfilesAndEnv(vscodeApi);

        const handleWindowFocus = () => {
            if (!selectedProfileKeyRef.current) {
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
