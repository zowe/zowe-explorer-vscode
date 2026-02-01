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

import { createContext, useContext, ReactNode } from "react";
import { useProfileWizard } from "../hooks/useProfileWizard";
import { useProfileUtils } from "../hooks/useProfileUtils";
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";
import { useConfigContext } from "./ConfigContext";
import { stringifyValueByType } from "../utils";

const WizardContext = createContext<
  | (ReturnType<typeof useProfileWizard> & {
      utilityHelpers: ReturnType<typeof useUtilityHelpers>;
      stringifyValueByType: (value: any, type?: string) => string;
      vscodeApi: any;
      getAvailableProfiles: () => string[];
      secureValuesAllowed: boolean;
    })
  | undefined
>(undefined);

interface WizardProviderProps {
  children: ReactNode;
  vscodeApi: any;
}

export function WizardProvider({ children, vscodeApi }: WizardProviderProps) {
  const {
    selectedTab,
    configurations,
    schemaValidations,
    pendingChanges,
    setPendingChanges,
    setSelectedProfileKey,
    secureValuesAllowed,
    renames,
  } = useConfigContext();

  const { formatPendingChanges, getAvailableProfiles } = useProfileUtils();
  const utilityHelpers = useUtilityHelpers();

  const wizardState = useProfileWizard({
    selectedTab,
    configurations,
    schemaValidations,
    pendingChanges,
    setPendingChanges,
    setSelectedProfileKey,
    vscodeApi,
    formatPendingChanges,
    getAvailableProfiles,
    secureValuesAllowed,
    renames,
  });

  return (
    <WizardContext.Provider
      value={{ ...wizardState, utilityHelpers, stringifyValueByType, vscodeApi, getAvailableProfiles, secureValuesAllowed }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizardContext() {
  const context = useContext(WizardContext);
  if (context === undefined) {
    throw new Error("useWizardContext must be used within a WizardProvider");
  }
  return context;
}
