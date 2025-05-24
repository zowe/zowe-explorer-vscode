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
import { JSX } from "preact";
import { isSecureOrigin } from "../utils";
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";
import { marked } from "marked";
import DOMPurify from "dompurify";
import * as l10n from "@vscode/l10n";
import "./style.css";

export function App(): JSX.Element {
  const RESOURCES_BASE = "webviews/dist/resources/images";
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [showOption, setShowOption] = useState<string>("");
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string>>({});
  const [versionOptions, setVersionOptions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"releaseNotes" | "changelog">("releaseNotes");

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      if (!event.data) {
        return;
      }

      const { releaseNotes, changelog, version, showReleaseNotesSetting, dropdownOptions, versionOptions } = event.data;

      if (releaseNotes !== undefined) {
        setReleaseNotes(releaseNotes);
      }
      if (changelog !== undefined) {
        setChangelog(changelog);
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
      if (versionOptions !== undefined) {
        setVersionOptions(versionOptions);
      }
    });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "ready" });
  }, []);

  const handleDropdownChange = (event: JSX.TargetedEvent<HTMLSelectElement>) => {
    const selectedKey = event.currentTarget.value;
    setShowOption(selectedKey);
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: selectedKey });
  };

  const handleVersionChange = (event: JSX.TargetedEvent<HTMLSelectElement>) => {
    const selectedVersion = event.currentTarget.value;
    setVersion(selectedVersion);
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "selectVersion", version: selectedVersion });
  };

  const rewriteImageUrls = (markdown: string) => markdown.replace(/!\[([^\]]*)\]\(\.\/images\/([^)]+)\)/g, `![$1](${RESOURCES_BASE}/$2)`);

  const renderMarkdown = (markdown: string) => {
    const withResources = rewriteImageUrls(markdown);
    // @ts-expect-error marked may return a Promise, but I know it can't be here
    const rawHtml: string = marked(withResources);
    return DOMPurify.sanitize(rawHtml);
  };

  return (
    <div className="releaseNotesRoot">
      <header className="heroBanner">
        <h1 className="heroTitle">{l10n.t("What's New in Zowe Explorer {0}", version ?? "")}</h1>
        <p className="heroSubtitle">{l10n.t("Here you can find the latest updates and features.")}</p>
      </header>
      <div className="releaseNotesCard">
        <div className="releaseNotesDropdownsLabelsRow">
          <div className="releaseNotesDropdownLabelText">{l10n.t("When would you like release notes to show?")}</div>
          <div className="releaseNotesDropdownLabelText">{l10n.t("Which version would you like to show?")}</div>
        </div>
        <div className="releaseNotesDropdownsRow">
          <div className="releaseNotesDropdownCol">
            <VSCodeDropdown value={showOption} onChange={handleDropdownChange} className="releaseNotesDropdown">
              {Object.entries(dropdownOptions).map(([key, label]) => (
                <VSCodeOption value={key} key={key}>
                  {label}
                </VSCodeOption>
              ))}
            </VSCodeDropdown>
          </div>
          <div className="releaseNotesDropdownCol">
            <VSCodeDropdown value={version ?? ""} onChange={handleVersionChange} className="releaseNotesDropdown">
              {versionOptions.map((ver) => (
                <VSCodeOption value={ver} key={ver}>
                  {ver}
                </VSCodeOption>
              ))}
            </VSCodeDropdown>
          </div>
        </div>
        <div className="releaseNotesTabs">
          <button
            className={`releaseNotesTab${activeTab === "releaseNotes" ? " active" : ""}`}
            onClick={() => setActiveTab("releaseNotes")}
            type="button"
          >
            {l10n.t("Release Notes")}
          </button>
          <button className={`releaseNotesTab${activeTab === "changelog" ? " active" : ""}`} onClick={() => setActiveTab("changelog")} type="button">
            {l10n.t("Changelog")}
          </button>
        </div>
        <div className="releaseNotesTabPanel">
          {activeTab === "releaseNotes" ? (
            <div className="releaseNotesContent">
              {releaseNotes ? (
                <div>
                  <div className="releaseNotesMarkdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(releaseNotes) }} />
                </div>
              ) : (
                <p className="releaseNotesLoading">{l10n.t("Loading release notes...")}</p>
              )}
            </div>
          ) : (
            <div className="releaseNotesContent">
              {changelog ? (
                <div>
                  <div className="releaseNotesMarkdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(changelog) }} />
                </div>
              ) : (
                <p className="releaseNotesLoading">{l10n.t("Loading changelog...")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
