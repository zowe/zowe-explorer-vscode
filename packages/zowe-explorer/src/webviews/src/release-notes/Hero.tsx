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

import { JSXInternal } from "preact/src/jsx";
import * as l10n from "@vscode/l10n";

interface HeroProps {
  version: string | null;
}

export function Hero({ version }: HeroProps): JSXInternal.Element {
  return (
    <header className="heroBanner">
      <img className="heroLogo" src="webviews/dist/resources/zowe-icon-color.png" alt="Zowe Logo" />
      <h1 className="heroTitle">{l10n.t("What's New in Zowe Explorer {0}", version ?? "")}</h1>
      <p className="heroSubtitle">{l10n.t("Here you can find the latest updates and features.")}</p>
    </header>
  );
}
