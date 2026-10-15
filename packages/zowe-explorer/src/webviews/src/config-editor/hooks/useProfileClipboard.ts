import { useEditorFields } from "../context/EditorStoreContext";

export function useProfileClipboard() {
    return useEditorFields("profileClipboard", "copyProfile", "duplicateProfile", "pasteProfile");
}
