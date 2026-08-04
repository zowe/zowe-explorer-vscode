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

import { useState, useRef, useCallback, useLayoutEffect, useEffect, useMemo } from "react";
import * as l10n from "@vscode/l10n";
import { useConfigContext } from "../context/ConfigContext";

interface TutorialStep {
  title: string;
  description: string;
  // CSS selectors (scoped to the active panel) for the element(s) this step is talking about.
  // Their bounding boxes are unioned into a single spotlight cutout in the backdrop.
  targetSelectors?: string[];
  // When true, if no profile is currently selected, the first profile visible in the list is
  // auto-selected on entering this step so the spotlighted panel isn't empty.
  autoSelectFirstProfile?: boolean;
  // Force the Profiles/Defaults sections open (if collapsed) while this step is shown, so the
  // spotlighted content is actually visible. Restored to the pre-tutorial state on close.
  expandProfiles?: boolean;
  expandDefaults?: boolean;
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
      targetSelectors: ['.panel.active [data-tutorial-id="profiles-heading"]', '.panel.active [data-tutorial-id="profiles-list"]'],
      expandProfiles: true,
    },
    {
      title: l10n.t("Profile Properties"),
      description: l10n.t(
        "Fields shown here map directly to your zowe.config.json. Click the \u24D8 icon next to a field name for a description and default value."
      ),
      targetSelectors: ['.panel.active [data-tutorial-id="profile-details-panel"]'],
      autoSelectFirstProfile: true,
    },
    {
      title: l10n.t("Defaults"),
      description: l10n.t("The Defaults section lets you choose which profile is the default for each connection type (zosmf, ssh, etc.)."),
      targetSelectors: ['.panel.active [data-tutorial-id="defaults-section"]'],
      expandDefaults: true,
    },
    {
      title: l10n.t("Saving Changes"),
      description: l10n.t(
        "After editing, click Save to write your changes to disk. Use Refresh to discard unsaved changes and reload from the file."
      ),
      targetSelectors: ['.panel.active [data-tutorial-id="save-refresh-footer"]'],
    },
    {
      title: l10n.t("You're all set!"),
      description: l10n.t("Start by selecting a profile on the left."),
    },
  ];
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 8;
const MODAL_GAP = 16;
const VIEWPORT_MARGIN = 12;

function unionRects(rects: DOMRect[]): Rect | null {
  if (rects.length === 0) {
    return null;
  }
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { top, left, width: right - left, height: bottom - top };
}

function getTargetRect(selectors?: string[]): Rect | null {
  if (!selectors || selectors.length === 0) {
    return null;
  }
  const rects: DOMRect[] = [];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        rects.push(rect);
      }
    }
  }
  return unionRects(rects);
}

interface TutorialOverlayProps {
  onClose: () => void;
  selectedProfileKey: string | null;
  onSelectProfile: (profileKey: string) => void;
}

export function TutorialOverlay({ onClose, selectedProfileKey, onSelectProfile }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const steps = useMemo(() => getSteps(), []);
  const total = steps.length;
  const current = steps[step];
  const isLast = step === total - 1;

  const modalRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState<Rect | null>(null);
  const [modalPosition, setModalPosition] = useState<{ top: number; left: number } | null>(null);

  const { configEditorSettings, setProfilesCollapsedWithStorage, setDefaultsCollapsedWithStorage } = useConfigContext();
  const { profilesCollapsed, defaultsCollapsed } = configEditorSettings;
  const [originalProfilesCollapsed] = useState(profilesCollapsed);
  const [originalDefaultsCollapsed] = useState(defaultsCollapsed);

  useEffect(() => {
    if (current.expandProfiles && profilesCollapsed) {
      setProfilesCollapsedWithStorage(false);
    }
    if (current.expandDefaults && defaultsCollapsed) {
      setDefaultsCollapsedWithStorage(false);
    }
  }, [step, current.expandProfiles, current.expandDefaults, profilesCollapsed, defaultsCollapsed, setProfilesCollapsedWithStorage, setDefaultsCollapsedWithStorage]);

  // Restore the Profiles/Defaults collapsed state the user had before the tutorial opened.
  useEffect(() => {
    return () => {
      setProfilesCollapsedWithStorage(originalProfilesCollapsed);
      setDefaultsCollapsedWithStorage(originalDefaultsCollapsed);
    };
  }, [originalProfilesCollapsed, originalDefaultsCollapsed, setProfilesCollapsedWithStorage, setDefaultsCollapsedWithStorage]);

  useEffect(() => {
    if (!current.autoSelectFirstProfile || selectedProfileKey) {
      return;
    }
    const listContainer = document.querySelector('.panel.active [data-tutorial-id="profiles-list"]');
    const firstProfileEl = listContainer?.querySelector<HTMLElement>("[data-profile-key]");
    const firstProfileKey = firstProfileEl?.getAttribute("data-profile-key");
    if (firstProfileKey) {
      onSelectProfile(firstProfileKey);
    }
  }, [step, current.autoSelectFirstProfile, selectedProfileKey, onSelectProfile]);

  const recalculate = useCallback(() => {
    const rect = getTargetRect(current.targetSelectors);
    setSpotlight(rect);

    if (!rect) {
      setModalPosition(null);
      return;
    }

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const modalEl = modalRef.current;
    const modalWidth = modalEl?.offsetWidth ?? Math.min(600, viewportW * 0.9);
    const modalHeight = modalEl?.offsetHeight ?? 250;

    const paddedTop = rect.top - SPOTLIGHT_PADDING;
    const paddedLeft = rect.left - SPOTLIGHT_PADDING;
    const paddedBottom = rect.top + rect.height + SPOTLIGHT_PADDING;

    let top: number;
    if (paddedBottom + MODAL_GAP + modalHeight <= viewportH - VIEWPORT_MARGIN) {
      top = paddedBottom + MODAL_GAP;
    } else if (paddedTop - MODAL_GAP - modalHeight >= VIEWPORT_MARGIN) {
      top = paddedTop - MODAL_GAP - modalHeight;
    } else {
      top = Math.max(VIEWPORT_MARGIN, Math.min(viewportH - modalHeight - VIEWPORT_MARGIN, (viewportH - modalHeight) / 2));
    }

    const left = Math.max(VIEWPORT_MARGIN, Math.min(paddedLeft, viewportW - modalWidth - VIEWPORT_MARGIN));

    setModalPosition({ top, left });
  }, [current.targetSelectors]);

  useLayoutEffect(() => {
    recalculate();
  }, [recalculate, step]);

  useEffect(() => {
    const handleRecalculate = () => recalculate();
    window.addEventListener("resize", handleRecalculate);
    window.addEventListener("scroll", handleRecalculate, true);

    const resizeObserver = new ResizeObserver(handleRecalculate);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener("resize", handleRecalculate);
      window.removeEventListener("scroll", handleRecalculate, true);
      resizeObserver.disconnect();
    };
  }, [recalculate]);

  const handleFinish = () => {
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  const renderBackdrop = () => {
    if (!spotlight) {
      return <div className="tutorial-overlay-backdrop" onClick={handleSkip} />;
    }

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const top = Math.max(0, spotlight.top - SPOTLIGHT_PADDING);
    const left = Math.max(0, spotlight.left - SPOTLIGHT_PADDING);
    const right = Math.min(viewportW, spotlight.left + spotlight.width + SPOTLIGHT_PADDING);
    const bottom = Math.min(viewportH, spotlight.top + spotlight.height + SPOTLIGHT_PADDING);

    return (
      <>
        <div className="tutorial-overlay-backdrop-segment" style={{ top: 0, left: 0, width: viewportW, height: top }} onClick={handleSkip} />
        <div
          className="tutorial-overlay-backdrop-segment"
          style={{ top: bottom, left: 0, width: viewportW, height: Math.max(0, viewportH - bottom) }}
          onClick={handleSkip}
        />
        <div
          className="tutorial-overlay-backdrop-segment"
          style={{ top, left: 0, width: left, height: bottom - top }}
          onClick={handleSkip}
        />
        <div
          className="tutorial-overlay-backdrop-segment"
          style={{ top, left: right, width: Math.max(0, viewportW - right), height: bottom - top }}
          onClick={handleSkip}
        />
        <div className="tutorial-spotlight-outline" style={{ top, left, width: right - left, height: bottom - top }} />
      </>
    );
  };

  return (
    <>
      {renderBackdrop()}
      <div
        ref={modalRef}
        className="tutorial-overlay-modal"
        style={modalPosition ? { top: modalPosition.top, left: modalPosition.left, transform: "none" } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={l10n.t("Config Editor Tutorial")}
      >
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
