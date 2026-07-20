/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * A guided tutorial modal shown to first-time users of the Config Editor.
 */

import { useState } from "react";
import * as l10n from "@vscode/l10n";

interface TutorialStep {
  title: string;
  description: string;
}

function getSteps(): TutorialStep[] {
  return [
    {
      title: l10n.t("Welcome to the Zowe Config Editor"),
      description: l10n.t(
        "This editor lets you manage your Zowe team configuration file visually. You can add, edit, and delete profiles without manually editing JSON."
      ),
    },
    {
      title: l10n.t("Profiles Panel"),
      description: l10n.t("The left panel lists all profiles in your config. Click any profile to view and edit its properties on the right."),
    },
    {
      title: l10n.t("Profile Properties"),
      description: l10n.t(
        "Fields shown here map directly to your zowe.config.json. Click the \u24D8 icon next to a field name for a description and default value."
      ),
    },
    {
      title: l10n.t("Defaults"),
      description: l10n.t(
        "The Defaults section lets you choose which profile is the default for each connection type (zosmf, ssh, etc.)."
      ),
    },
    {
      title: l10n.t("Saving Changes"),
      description: l10n.t(
        "After editing, click Save to write your changes to disk. Use Refresh to discard unsaved changes and reload from the file."
      ),
    },
    {
      title: l10n.t("You're all set!"),
      description: l10n.t("Start by selecting a profile on the left. Click the \u24D8 icons for contextual help on any field."),
    },
  ];
}

interface TutorialOverlayProps {
  onClose: () => void;
}

export function TutorialOverlay({ onClose }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const steps = getSteps();
  const total = steps.length;
  const current = steps[step];
  const isLast = step === total - 1;

  const handleFinish = () => {
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <>
      <div className="tutorial-overlay-backdrop" onClick={handleSkip} />
      <div className="tutorial-overlay-modal" role="dialog" aria-modal="true" aria-label={l10n.t("Config Editor Tutorial")}>
        {/* Header */}
        <div className="tutorial-header">
          <h2>{current.title}</h2>
          <button className="tutorial-close-button" onClick={handleSkip} aria-label={l10n.t("Close tutorial")}>
            <span className="codicon codicon-close"></span>
          </button>
        </div>

        {/* Content */}
        <div className="tutorial-content">
          <div className="tutorial-progress-bar">
            <div className="tutorial-progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
          <p className="tutorial-progress-text">{l10n.t("Step {0} of {1}", step + 1, total)}</p>
          <div className="tutorial-description">
            <p>{current.description}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="tutorial-footer">
          <div className="tutorial-footer-left">
            <button className="tutorial-button tutorial-button-secondary" onClick={handleSkip}>
              {l10n.t("Skip")}
            </button>
          </div>
          <div className="tutorial-footer-right">
            {step > 0 && (
              <button className="tutorial-button tutorial-button-secondary" onClick={() => setStep((s) => s - 1)}>
                <span className="codicon codicon-arrow-left"></span>
                {l10n.t("Back")}
              </button>
            )}
            {isLast ? (
              <button className="tutorial-button tutorial-button-primary" onClick={handleFinish}>
                {l10n.t("Finish")}
                <span className="codicon codicon-check"></span>
              </button>
            ) : (
              <button className="tutorial-button tutorial-button-primary" onClick={() => setStep((s) => s + 1)}>
                {l10n.t("Next")}
                <span className="codicon codicon-arrow-right"></span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
