import { LOCAL_STORAGE_KEYS } from "../App";
import { useConfigEditorActions } from "../store";

export function updateShowMergedProperties(value: boolean, vscodeApi: any) {
    const { setShowMergedProperties, setSortOrderVersion } = useConfigEditorActions();
    setShowMergedProperties(value);
    vscodeApi.postMessage({
        command: "SET_LOCAL_STORAGE_VALUE",
        key: LOCAL_STORAGE_KEYS.SHOW_MERGED_PROPERTIES,
        value,
    });
    setSortOrderVersion((prev: any) => prev + 1);
}
