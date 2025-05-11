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
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";
import { marked } from "marked";
import DOMPurify from "dompurify";

export function App(): JSXInternal.Element {
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [showAfterUpdate, setShowAfterUpdate] = useState<boolean>(true);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      if (!event.data) {
        return;
      }

      const releaseNotes = event.data["releaseNotes"];
      if (releaseNotes) {
        setReleaseNotes(releaseNotes);
      }
    });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "ready" });
  }, []);

  const handleCheckboxChange = (event: JSXInternal.TargetedEvent<HTMLInputElement>) => {
    const isChecked = event.currentTarget.checked;
    setShowAfterUpdate(isChecked);

    if (!isChecked) {
      PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "disable" });
    }
  };

  const renderMarkdown = (markdown: string) => {
    // @ts-expect-error marked may return a Promise, but I know it can't be here
    const rawHtml: string = marked(markdown);
    return DOMPurify.sanitize(rawHtml);
  };

  return (
    <div>
      <h1>What's New</h1>
      <p>Here you can find the latest updates and features.</p>
      <label>
        <input type="checkbox" checked={showAfterUpdate} onChange={handleCheckboxChange} />
        Show release notes after an update
      </label>
      {releaseNotes ? (
        <div>
          <h2>Release Notes</h2>
          {/* This is ok as the changelog html has been sanitized first */}
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(releaseNotes) }} />
        </div>
      ) : (
        <p>Loading release notes...</p>
      )}
    </div>
  );
}
