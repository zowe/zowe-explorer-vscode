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

import { useEffect, useState } from "preact/hooks";
import { JSXInternal } from "preact/src/jsx";
import { isSecureOrigin } from "../utils";
import { ErrorInfo, ErrorInfoProps, isNetworkErrorInfo } from "./components/ErrorInfo";

export function App(): JSXInternal.Element {
  const [errorInfo, setErrorInfo] = useState<ErrorInfoProps>();

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      if (!event.data) {
        return;
      }

      const errorInfo = event.data["error"];

      if (isNetworkErrorInfo(errorInfo)) {
        setErrorInfo(errorInfo);
      }
    });
  }, []);

  return (
    <div>
      <h1>Troubleshooting</h1>
      {errorInfo ? <ErrorInfo {...errorInfo} /> : null}
    </div>
  );
}
