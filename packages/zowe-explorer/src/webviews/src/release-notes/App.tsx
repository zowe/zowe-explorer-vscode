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
import { VSCodeDropdown, VSCodeOption, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";
import { marked } from "marked";
import DOMPurify from "dompurify";
import * as l10n from "@vscode/l10n";
import "./style.css";

export function App(): JSX.Element {
  const RESOURCES_BASE = "webviews/dist/resources/release-notes";
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [displayAfterUpdate, setDisplayAfterUpdate] = useState<boolean>(true);
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string>>({});
  const [versionOptions, setVersionOptions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"releaseNotes" | "changelog">("releaseNotes");
  const [l10nReady, setL10nReady] = useState<boolean>(false);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      if (!event.data) {
        return;
      }

      if (event.data.command === "GET_LOCALIZATION") {
        const { contents } = event.data;
        if (contents) {
          l10n.config({ contents });
        }
        setL10nReady(true);
        return;
      }

      const { releaseNotes, changelog, version, showAfterUpdate, versionOptions } = event.data;

      if (releaseNotes !== undefined) {
        setReleaseNotes(releaseNotes);
      }
      if (changelog !== undefined) {
        setChangelog(changelog);
      }
      if (version !== undefined) {
        setVersion(version);
      }
      if (showAfterUpdate !== undefined) {
        setDisplayAfterUpdate(showAfterUpdate);
      }
      if (dropdownOptions !== undefined) {
        setDropdownOptions(dropdownOptions);
      }
      if (versionOptions !== undefined) {
        setVersionOptions(versionOptions);
      }
    });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "GET_LOCALIZATION" });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "ready" });
  }, []);

  const handleDisplayAfterUpdateChange = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    const checked = event.currentTarget.checked;
    setDisplayAfterUpdate(checked);
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "toggleDisplayAfterUpdate", checked });
  };

  const handleVersionChange = (event: JSX.TargetedEvent<HTMLSelectElement>) => {
    const selectedVersion = event.currentTarget.value;
    setVersion(selectedVersion);
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "selectVersion", version: selectedVersion });
  };

  const rewriteImageUrls = (markdown: string) =>
    markdown.replace(/!\[([^\]]*)\]\(\.\/resources\/release-notes\/([^)]+)\)/g, `![$1](${RESOURCES_BASE}/$2)`);

  const cleanTextForL10n = (text: string): string => {
    return text
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // Remove images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove link URLs but keep text
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/`([^`]+)`/g, "$1") // Remove inline code backticks but keep content
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  };

  /**
   * Basically does the same thing as parseMarkdown in generateReleaseNotesL10n.js
   * but it just inserts the localized strings into the correct markdown content
   */
  const localizeMarkdown = (markdown: string): string => {
    if (!l10nReady) {
      return markdown;
    }

    const lines = markdown.split("\n");
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === "" || /^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
        result.push(line);
        continue;
      }

      const sectionMatch = trimmed.match(/^### (.+)$/);
      if (sectionMatch) {
        const originalText = sectionMatch[1];
        const cleanedText = cleanTextForL10n(originalText);
        const localizedText = l10n.t(cleanedText);
        result.push(`### ${localizedText}`);
        continue;
      }

      const listMatch = trimmed.match(/^([-*])\s+(.+)$/);
      if (listMatch) {
        const indent = line.match(/^\s*/)?.[0] ?? "";
        const bullet = listMatch[1];
        const originalText = listMatch[2];
        const cleanedText = cleanTextForL10n(originalText);
        const localizedText = l10n.t(cleanedText);
        result.push(`${indent}${bullet} ${localizedText}`);
        continue;
      }

      if (trimmed && !trimmed.startsWith("##")) {
        const cleanedText = cleanTextForL10n(trimmed);
        if (cleanedText) {
          const localizedText = l10n.t(cleanedText);
          result.push(localizedText);
          continue;
        }
      }

      result.push(line);
    }

    return result.join("\n");
  };

  const renderMarkdown = (markdown: string) => {
    const localized = localizeMarkdown(markdown);
    const withResources = rewriteImageUrls(localized);
    // @ts-expect-error marked may return a Promise, but I know it can't be here
    const rawHtml: string = marked(withResources);
    return DOMPurify.sanitize(rawHtml);
  };

  return (
    <div className="releaseNotesRoot">
      <header className="heroBanner">
        <h1 className="heroTitle">{l10n.t("What's New in Zowe Explorer {0}", version ?? "")}</h1>
        <p className="heroSubtitle">{l10n.t("You can find the latest updates and features here.")}</p>
      </header>
      <div className="releaseNotesCard">
        <div className="releaseNotesDropdownsLabelsRow">
          <div className="releaseNotesDropdownLabelText"></div>
          <div className="releaseNotesDropdownLabelText">{l10n.t("Select the version to display release notes for")}</div>
        </div>
        <div className="releaseNotesDropdownsRow">
          <div className="releaseNotesDropdownCol">
            <VSCodeCheckbox checked={displayAfterUpdate} onChange={handleDisplayAfterUpdateChange}>
              <span className="releaseNotesDropdownLabelText">{l10n.t("Display release notes after an update")}</span>
            </VSCodeCheckbox>
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
