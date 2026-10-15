import { useEffect } from "react";
import { isSecureOrigin } from "../../utils";
import { handleMessage } from "../handlers/messageHandlers";
import { useEditorStoreApi } from "../context/EditorStoreContext";
import { postProfilesAndEnv } from "../utils/extensionRequests";
import { CONFIG_EDITOR_SETTINGS_KEY } from "../store/initialization";

/** The extension owns disk access; this hook connects its messages to the scoped store. */
export function useMessageHandler() {
    const store = useEditorStoreApi();
    useEffect(() => {
        const { vscodeApi } = store.getState();
        const onMessage = (event: MessageEvent) => {
            if (isSecureOrigin(event.origin)) handleMessage(event, store);
        };
        const onFocus = () => {
            if (!store.getState().selectedProfileKey) {
                postProfilesAndEnv(vscodeApi);
                vscodeApi.postMessage({ command: "GET_KEYBINDS" });
            }
        };
        const onVisibility = () => {
            if (!document.hidden && !store.getState().selectedProfileKey) postProfilesAndEnv(vscodeApi);
        };
        window.addEventListener("message", onMessage);
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibility);
        // CONFIGURATIONS is already sent by the extension constructor; avoid racing INITIAL_SELECTION.
        vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
        vscodeApi.postMessage({ command: "GET_LOCAL_STORAGE_VALUE", key: CONFIG_EDITOR_SETTINGS_KEY });
        return () => {
            window.removeEventListener("message", onMessage);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [store]);
}
