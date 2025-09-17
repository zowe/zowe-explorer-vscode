import { createStateVariables, LOCAL_STORAGE_KEYS, useConsolidatedState } from "../App";

const { state, setState, ...refs } = useConsolidatedState();
const { setShowMergedProperties, setSortOrderVersion } = createStateVariables(state, setState);

export function updateShowMergedProperties(value: boolean, vscodeApi: any) {
    setShowMergedProperties(value);
    vscodeApi.postMessage({
        command: "SET_LOCAL_STORAGE_VALUE",
        key: LOCAL_STORAGE_KEYS.SHOW_MERGED_PROPERTIES,
        value,
    });
    setSortOrderVersion((prev) => prev + 1);
}
