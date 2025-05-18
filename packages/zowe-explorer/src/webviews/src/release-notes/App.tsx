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
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      if (!event.data) {
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
    <div
      style={{
        minHeight: "100vh",
        background: "var(--vscode-editor-background)",
        padding: "32px 0",
        fontFamily: "Segoe UI, Arial, sans-serif",
        color: "var(--vscode-editor-foreground)",
      }}
    >
      <div
        style={{
          maxWidth: 620,
          margin: "0 auto",
          background: "var(--vscode-sideBar-background)",
          borderRadius: 8,
          border: "1px solid var(--vscode-panel-border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          padding: "28px 32px 32px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* <img
          src={require("../../../resources/zowe-icon-color.png")}
          alt="Zowe Logo"
          style={{ width: 56, height: 56, marginBottom: 18, marginTop: 2 }}
        /> */}
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            margin: "0 0 6px 0",
            color: "var(--vscode-editor-foreground)",
            textAlign: "center",
            letterSpacing: 0.2,
          }}
        >
          {l10n.t("What's New in Zowe Explorer {0}", version ?? "")}
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--vscode-descriptionForeground)",
            margin: "0 0 18px 0",
            textAlign: "center",
          }}
        >
          {l10n.t("Here you can find the latest updates and features.")}
        </p>
        <label style={{ width: "100%", marginBottom: 18 }}>
          <span
            style={{
              fontWeight: 500,
              color: "var(--vscode-editor-foreground)",
              fontSize: 14,
            }}
          >
            {l10n.t("When would you like release notes to show?")}
          </span>
          <br />
          <VSCodeDropdown
            value={showOption}
            onChange={handleDropdownChange}
            style={{
              marginTop: 7,
              width: "100%",
              fontSize: 14,
              background: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border)",
              borderRadius: 4,
            }}
          >
            {Object.values(dropdownOptions).map((label) => (
              <VSCodeOption value={label} key={label}>
                {label}
              </VSCodeOption>
            ))}
          </VSCodeDropdown>
        </label>
        <hr
          style={{
            width: "100%",
            border: "none",
            borderTop: "1px solid var(--vscode-panel-border)",
            margin: "10px 0 18px 0",
          }}
        />
        <div
          style={{
            width: "100%",
            marginTop: 0,
          }}
        >
          {releaseNotes ? (
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--vscode-editor-foreground)",
                  margin: "0 0 10px 0",
                }}
              >
                {l10n.t("Release Notes")}
              </h2>
              <div
                style={{
                  background: "var(--vscode-editor-background)",
                  borderRadius: 6,
                  padding: "14px 16px",
                  color: "var(--vscode-editor-foreground)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  border: "1px solid var(--vscode-panel-border)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(releaseNotes) }}
              />
            </div>
          ) : (
            <p style={{ color: "var(--vscode-descriptionForeground)", fontStyle: "italic" }}>{l10n.t("Loading release notes...")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
