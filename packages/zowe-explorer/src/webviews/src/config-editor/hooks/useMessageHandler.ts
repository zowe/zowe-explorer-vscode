import { useEffect, MutableRefObject, useRef } from "react";
import { isSecureOrigin } from "../../utils";
import { handleMessage, MessageHandlerProps } from "../handlers/messageHandlers";

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
        vscodeApi,
        selectedProfileKeyRef,
    } = props;

    useEffect(() => {
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

        vscodeApi.postMessage({ command: "GET_PROFILES" });
        vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });

        const handleWindowFocus = () => {
            if (!selectedProfileKeyRef.current) {
                vscodeApi.postMessage({ command: "GET_PROFILES" });
                vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
                vscodeApi.postMessage({ command: "GET_KEYBINDS" });
            }
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                if (!selectedProfileKeyRef.current) {
                    vscodeApi.postMessage({ command: "GET_PROFILES" });
                    vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
                }
            }
        };

        const handleBeforeUnload = () => {};

        const handleLoad = () => {
            setTimeout(() => {
                vscodeApi.postMessage({ command: "GET_PROFILES" });
                vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
            }, 100);
        };

        const handleDOMContentLoaded = () => {
            vscodeApi.postMessage({ command: "GET_PROFILES" });
            vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
        };

        window.addEventListener("focus", handleWindowFocus);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("load", handleLoad);
        document.addEventListener("DOMContentLoaded", handleDOMContentLoaded);

        return () => {
            window.removeEventListener("message", messageListener);
            window.removeEventListener("focus", handleWindowFocus);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.removeEventListener("load", handleLoad);
            document.removeEventListener("DOMContentLoaded", handleDOMContentLoaded);
        };
    }, []);
}
