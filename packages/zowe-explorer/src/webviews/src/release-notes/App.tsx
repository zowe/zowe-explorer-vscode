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
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";
import { marked } from "marked";
import DOMPurify from "dompurify";
import * as l10n from "@vscode/l10n";

export function App(): JSXInternal.Element {
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [showOption, setShowOption] = useState<string>("");
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin) || !event.data) {
        return;
      }

      const { releaseNotes, version, showReleaseNotesSetting, dropdownOptions } = event.data;

      if (releaseNotes !== undefined) {
        setReleaseNotes(releaseNotes);
      }
      if (version !== undefined) {
        setVersion(version);
      }
      if (showReleaseNotesSetting !== undefined) {
        setShowOption(showReleaseNotesSetting);
      }
      if (dropdownOptions !== undefined) {
        setDropdownOptions(dropdownOptions);
      }
    });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "ready" });
  }, []);

  const handleDropdownChange = (event: JSXInternal.TargetedEvent<HTMLSelectElement>) => {
    const selectedOption = event.currentTarget.value;
    setShowOption(selectedOption);

    // Send the selected command (which is the localised value) back to the extension
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: selectedOption });
  };

  const renderMarkdown = (markdown: string) => {
    // @ts-expect-error marked may return a Promise, but I know it can't be here
    const rawHtml: string = marked(markdown);
    return DOMPurify.sanitize(rawHtml);
  };

  return (
    <div>
      <h1>{l10n.t("What's New in Zowe Explorer {0}", version ?? "")}</h1>
      <p>{l10n.t("Here you can find the latest updates and features.")}</p>
      <label>
        <span>{l10n.t("When would you like release notes to show?")}</span>
        <br />
        <VSCodeDropdown value={showOption} onChange={handleDropdownChange}>
          {Object.values(dropdownOptions).map((label) => (
            <VSCodeOption value={label} key={label}>
              {label}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>
      </label>
      {releaseNotes ? (
        <div>
          <h2>{l10n.t("Release Notes")}</h2>
          {/* This is ok as the changelog html has been sanitized first */}
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(releaseNotes) }} />
        </div>
      ) : (
        <p>{l10n.t("Loading release notes...")}</p>
      )}
    </div>
  );
}
