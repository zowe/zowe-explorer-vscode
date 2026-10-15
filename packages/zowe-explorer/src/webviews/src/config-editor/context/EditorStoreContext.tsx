import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand/react";
import { useShallow } from "zustand/react/shallow";
import { createEditorStore } from "../store/editorStore";
import type { ConfigEditorWebviewApi } from "../handlers/messageHandlers";
import type { EditorStore, EditorStoreState } from "../store/editorStore";

export const EditorStoreContext = createContext<EditorStore | null>(null);

export function EditorStoreProvider({ children, vscodeApi }: { children: ReactNode; vscodeApi: ConfigEditorWebviewApi }) {
  const [store] = useState(() => createEditorStore(vscodeApi));
  return <EditorStoreContext.Provider value={store}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStoreApi(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("Editor store hooks must be used within an EditorStoreProvider");
  return store;
}

export function useEditorStore<T>(selector: (state: EditorStoreState) => T): T {
  return useStore(useEditorStoreApi(), selector);
}

/** Subscribe only to the named dependencies, with stable object identity when they are unchanged. */
export function useEditorFields<K extends keyof EditorStoreState>(...keys: K[]): Pick<EditorStoreState, K> {
  return useEditorStore(useShallow((state) => Object.fromEntries(keys.map((key) => [key, state[key]])) as Pick<EditorStoreState, K>));
}
