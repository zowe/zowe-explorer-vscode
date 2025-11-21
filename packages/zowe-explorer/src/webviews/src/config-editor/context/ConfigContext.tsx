import { createContext, useContext, ReactNode } from "react";
import { useConfigState } from "../hooks/useConfigState";

type ConfigState = ReturnType<typeof useConfigState>;

const ConfigContext = createContext<ConfigState | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
  vscodeApi: any;
}

export function ConfigProvider({ children, vscodeApi }: ConfigProviderProps) {
  const configState = useConfigState(vscodeApi);

  return <ConfigContext.Provider value={configState}>{children}</ConfigContext.Provider>;
}

export function useConfigContext() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfigContext must be used within a ConfigProvider");
  }
  return context;
}
