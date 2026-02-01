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

import { useEffect, useCallback } from "react";
import { ProfileWizardModal } from "./modals/ProfileWizardModal";
import { useWizardContext } from "../context/WizardContext";
import { useConfigContext } from "../context/ConfigContext";

export function WizardManager() {
  const { selectedTab } = useConfigContext();
  const {
    wizardModalOpen,
    wizardRootProfile,
    wizardSelectedType,
    setWizardMergedProperties,
    setWizardNewPropertyValue,
    setWizardProperties,
    requestWizardMergedProperties,
  } = useWizardContext();

  const onWizardMergedProperties = useCallback(
    (data: any) => {
      const mergedPropsData: { [key: string]: any } = {};
      if (Array.isArray(data.mergedArgs)) {
        data.mergedArgs.forEach((item: any) => {
          if (item.argName && item.argValue !== undefined) {
            let correctValue = item.argValue;
            if (item.dataType === "boolean") {
              correctValue = typeof item.argValue === "string" ? item.argValue.toLowerCase() === "true" : Boolean(item.argValue);
            } else if (item.dataType === "number") {
              const num = Number(item.argValue);
              correctValue = typeof item.argValue === "string" && isNaN(num) ? item.argValue : num;
            }
            mergedPropsData[item.argName] = {
              value: correctValue,
              dataType: item.dataType,
              secure: item.secure,
              argLoc: item.argLoc,
            };
          }
        });
      }
      setWizardMergedProperties(mergedPropsData);
    },
    [setWizardMergedProperties]
  );

  const onFileSelected = useCallback(
    (data: any) => {
      if (data.filePath) {
        if (data.isNewProperty && data.source === "wizard") {
          setWizardNewPropertyValue(data.filePath);
        } else {
          const propertyIndex = data.propertyIndex;
          if (propertyIndex !== undefined && propertyIndex >= 0) {
            setWizardProperties((prev) => {
              const updated = [...prev];
              updated[propertyIndex] = { ...updated[propertyIndex], value: data.filePath };
              return updated;
            });
          }
        }
      }
    },
    [setWizardNewPropertyValue, setWizardProperties]
  );

  useEffect(() => {
    if (wizardModalOpen && selectedTab !== null && (wizardRootProfile || wizardSelectedType)) {
      const timeoutId = setTimeout(() => {
        requestWizardMergedProperties();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [wizardRootProfile, wizardSelectedType, wizardModalOpen, selectedTab, requestWizardMergedProperties]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === "WIZARD_MERGED_PROPERTIES") {
        onWizardMergedProperties(event.data);
      } else if (event.data.command === "FILE_SELECTED") {
        onFileSelected(event.data);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onWizardMergedProperties, onFileSelected]);

  return <ProfileWizardModal key={`wizard-${wizardModalOpen}`} />;
}
