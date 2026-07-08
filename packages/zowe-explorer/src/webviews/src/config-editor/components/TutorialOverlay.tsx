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
import { markTutorialCompleted, markTutorialSkipped } from "../utils/FirstTimeUserDetector";

interface TutorialStep {
  title: string;
  description: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to the Config Editor",
    description:
      "This editor lets you manage your Zowe team configuration file visually. " +
      "You can add, edit, and delete profiles without manually editing JSON.",
  },
  {
    title: "Profiles Panel",
    description: "The left panel lists all profiles in your config. " + "Click any profile to view and edit its properties on the right.",
  },
  {
    title: "Profile Properties",
    description:
      "Fields shown here map directly to your zowe.config.json. " + "Click the ⓘ icon next to a field name for a description and example values.",
  },
  {
    title: "Defaults",
    description: "The Defaults section lets you choose which profile is the default for each connection type (zosmf, ssh, rse, etc.).",
  },
  {
    title: "Saving Changes",
    description: "After editing, click Save to write your changes to disk. " + "Use Refresh to discard unsaved changes and reload from the file.",
  },
  {
    title: "You're all set!",
    description: "Start by selecting a profile on the left. Click the ⓘ icons for contextual help on any field.",
  },
];

interface TutorialOverlayProps {
  onClose: () => void;
}

export function TutorialOverlay({ onClose }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const handleFinish = () => {
    markTutorialCompleted();
    onClose();
  };

  const handleSkip = () => {
    markTutorialSkipped();
    onClose();
  };

  return (
    <>
      <div className="tutorial-overlay-backdrop" onClick={handleSkip} />
      <div className="tutorial-overlay-modal" role="dialog" aria-modal="true" aria-label="Config Editor Tutorial">
        {/* Header */}
        <div className="tutorial-header">
          <h2>{current.title}</h2>
          <button className="tutorial-close-button" onClick={handleSkip} aria-label="Close tutorial">
            <span className="codicon codicon-close"></span>
          </button>
        </div>

        {/* Content */}
        <div className="tutorial-content">
          <div className="tutorial-progress-bar">
            <div className="tutorial-progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
          <p className="tutorial-progress-text">
            Step {step + 1} of {total}
          </p>
          <div className="tutorial-description">
            <p>{current.description}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="tutorial-footer">
          <div className="tutorial-footer-left">
            <button className="tutorial-button tutorial-button-secondary" onClick={handleSkip}>
              Skip
            </button>
          </div>
          <div className="tutorial-footer-right">
            {step > 0 && (
              <button className="tutorial-button tutorial-button-secondary" onClick={() => setStep((s) => s - 1)}>
                <span className="codicon codicon-arrow-left"></span>
                Back
              </button>
            )}
            {isLast ? (
              <button className="tutorial-button tutorial-button-primary" onClick={handleFinish}>
                Finish
                <span className="codicon codicon-check"></span>
              </button>
            ) : (
              <button className="tutorial-button tutorial-button-primary" onClick={() => setStep((s) => s + 1)}>
                Next
                <span className="codicon codicon-arrow-right"></span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
