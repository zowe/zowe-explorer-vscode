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

import * as l10n from "@vscode/l10n";
import type { RefObject } from "react";
import { useConfigContext } from "../context/ConfigContext";
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";
import type { useProfileClipboard } from "../hooks/useProfileClipboard";
import type { ProfileContextMenuState } from "../hooks/useProfileContextMenu";

type ProfileContextMenuProps = ReturnType<typeof useProfileClipboard> & {
  contextMenu: ProfileContextMenuState;
  contextMenuRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onProfileSelect: (profileKey: string) => void;
  onDeleteProfile?: (profileKey: string) => void;
};

export function ProfileContextMenu({
  contextMenu,
  contextMenuRef,
  onClose,
  onProfileSelect,
  onDeleteProfile,
  profileClipboard,
  copyProfile,
  duplicateProfile,
  pasteProfile,
}: ProfileContextMenuProps) {
  const { setRenameProfileModalOpen } = useConfigContext();
  const { isProfileAffectedByDragDrop } = useUtilityHelpers();
  return (
    <div ref={contextMenuRef} className="tab-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
      {contextMenu.profileKey !== null ? (
        <>
          <div
            className="tab-context-menu-item"
            onClick={() => {
              copyProfile(contextMenu.profileKey!, true);
              onClose();
            }}
          >
            <span className="codicon codicon-screen-cut codicon-tab-menu-icon"></span>
            <span>{l10n.t("Cut")}</span>
          </div>
          <div
            className="tab-context-menu-item"
            onClick={() => {
              copyProfile(contextMenu.profileKey!, false);
              onClose();
            }}
          >
            <span className="codicon codicon-copy codicon-tab-menu-icon"></span>
            <span>{l10n.t("Copy")}</span>
          </div>
          {profileClipboard ? (
            <>
              <div
                className="tab-context-menu-item"
                id="context-menu-paste-child-profile"
                onClick={() => {
                  pasteProfile(contextMenu.profileKey);
                  onClose();
                }}
              >
                <span className="codicon codicon-clippy codicon-tab-menu-icon"></span>
                <span>{l10n.t("Paste as Child")}</span>
              </div>
              <div
                className="tab-context-menu-item"
                id="context-menu-paste-root-profile"
                onClick={() => {
                  pasteProfile(null);
                  onClose();
                }}
              >
                <span className="codicon codicon-clippy codicon-tab-menu-icon"></span>
                <span>{l10n.t("Paste at Root Level")}</span>
              </div>
            </>
          ) : (
            <div className="tab-context-menu-item disabled" id="context-menu-paste-profile">
              <span className="codicon codicon-clippy codicon-tab-menu-icon"></span>
              <span>{l10n.t("Paste")}</span>
            </div>
          )}
          <div
            className="tab-context-menu-item"
            onClick={() => {
              duplicateProfile(contextMenu.profileKey!);
              onClose();
            }}
          >
            <span className="codicon codicon-files codicon-tab-menu-icon"></span>
            <span>{l10n.t("Duplicate")}</span>
          </div>
          <div
            className={`tab-context-menu-item ${isProfileAffectedByDragDrop(contextMenu.profileKey) ? "disabled" : ""}`}
            id="context-menu-rename-profile"
            title={
              isProfileAffectedByDragDrop(contextMenu.profileKey)
                ? l10n.t("Cannot rename: This profile or a related profile has been moved via drag-and-drop. Save and refresh to enable renaming.")
                : undefined
            }
            onClick={() => {
              if (!isProfileAffectedByDragDrop(contextMenu.profileKey!)) {
                onProfileSelect(contextMenu.profileKey!);
                setRenameProfileModalOpen(true);
                onClose();
              }
            }}
          >
            <span className="codicon codicon-edit codicon-tab-menu-icon"></span>
            <span>{l10n.t("Rename")}</span>
          </div>
          {onDeleteProfile && (
            <div
              className="tab-context-menu-item"
              onClick={() => {
                onDeleteProfile(contextMenu.profileKey!);
                onClose();
              }}
            >
              <span className="codicon codicon-trash codicon-tab-menu-icon"></span>
              <span>{l10n.t("Delete")}</span>
            </div>
          )}
        </>
      ) : (
        <div
          className={`tab-context-menu-item ${!profileClipboard ? "disabled" : ""}`}
          id="context-menu-paste-root"
          onClick={() => {
            if (profileClipboard) {
              pasteProfile(null);
            }
            onClose();
          }}
        >
          <span className="codicon codicon-clippy codicon-tab-menu-icon"></span>
          <span>{l10n.t("Paste")}</span>
        </div>
      )}
    </div>
  );
}
