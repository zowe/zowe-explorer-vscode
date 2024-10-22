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

import { createContext } from "preact";
import { DataPanelContextType } from "../types";
import { useContext } from "preact/hooks";

export const DataPanelContext = createContext<DataPanelContextType | null>(null);

export function useDataPanelContext(): DataPanelContextType {
    const dataPanelContext = useContext(DataPanelContext);
    if (!dataPanelContext) {
        throw new Error("DataPanelContext has to be used within <DataPanelContext.Provider>");
    }
    return dataPanelContext;
}
