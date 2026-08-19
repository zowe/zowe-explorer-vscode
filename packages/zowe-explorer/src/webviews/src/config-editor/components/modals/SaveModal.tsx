import { useEffect, useState } from "react";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import * as l10n from "@vscode/l10n";

interface SaveModalProps {
  isOpen: boolean;
}

// Delay before showing the spinner, so quick saves don't produce a visual flash.
const SPINNER_DELAY_MS = 500;

export function SaveModal({ isOpen }: SaveModalProps) {
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowSpinner(false);
      return;
    }

    const timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="save-modal-blocker" aria-hidden={!showSpinner}>
      {showSpinner && (
        <div className="save-modal-spinner">
          <VSCodeProgressRing aria-label={l10n.t("Saving configuration")} />
          <span>{l10n.t("Saving configuration...")}</span>
        </div>
      )}
    </div>
  );
}
