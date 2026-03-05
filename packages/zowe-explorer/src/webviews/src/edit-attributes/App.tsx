import { useEffect, useState } from "preact/hooks";
import { FileAttributes, FilePermissions, PERMISSION_GROUPS, PERMISSION_TYPES, PermissionSet } from "./types";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeDivider,
  VSCodeProgressRing,
  VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";
import { isEqual } from "es-toolkit";
import * as l10n from "@vscode/l10n";
import { isSecureOrigin } from "../utils";

const vscodeApi = acquireVsCodeApi();

export function App() {
  const notSupported = "NOT SUPPORTED";
  const [readonly, setReadonly] = useState(false);
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [attributes, setAttributes] = useState<Record<"current" | "initial", FileAttributes | null>>({
    current: null,
    initial: null,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [timestamp, setTimestamp] = useState<Date | null>();

  const localizedPermissionTypes = [
    { key: "read", localized: l10n.t("Read") },
    { key: "write", localized: l10n.t("Write") },
    { key: "execute", localized: l10n.t("Execute") },
  ];

  const localizedPermissionGroups = [
    { key: "user", localized: l10n.t("User") },
    { key: "group", localized: l10n.t("Group") },
    { key: "all", localized: l10n.t("All") },
  ];

  const updateButtons = (newAttributes: FileAttributes) => setAllowUpdate(!isEqual(attributes.initial, newAttributes));

  const updateFileAttributes = (key: keyof FileAttributes, value: unknown) => {
    if (attributes.current && attributes.current[key] != value) {
      setAttributes((prev) => {
        const newAttrs = { ...(prev ?? {}), current: { ...prev.current, [key]: value } as FileAttributes };
        updateButtons(newAttrs.current);
        return newAttrs;
      });
    }
  };

  const applyAttributes = () => {
    setIsUpdating(true);
    if (attributes.current) {
      // convert perm booleans to string
      const permString = Object.values(attributes.current.perms).reduce(
        (all, perm) => {
          const read = perm.read ? "r" : "-";
          const write = perm.write ? "w" : "-";
          const execute = perm.execute ? "x" : "-";
          return all.concat(read, write, execute);
        },
        attributes.current.directory ? "d" : "-"
      );
      vscodeApi.postMessage({
        command: "update-attributes",
        attrs: { ...attributes.current, perms: permString },
      });
      setAllowUpdate(false);
      setAttributes((prev) => ({ ...prev, initial: attributes.current }));
    }
  };

  useEffect(() => {
    window.addEventListener("message", (event) => {
      // Prevent users from sending data into webview outside of extension/webview context
      if (!isSecureOrigin(event.origin)) {
        return;
      }
      if (!event.data) {
        return;
      }

      if (event.data.command === "GET_LOCALIZATION") {
        const { contents } = event.data;
        l10n.config({
          contents: contents,
        });
      }

      if ("readonly" in event.data && event.data.readonly) {
        setReadonly(true);
      }

      if ("updated" in event.data) {
        setIsUpdating(false);
        if (!event.data.updated) {
          setAllowUpdate(true);
        } else {
          setTimestamp(new Date());
        }
        return;
      }

      if (!("name" in event.data && "attributes" in event.data)) {
        return;
      }
      const { name, attributes } = event.data;

      const isDirectory = attributes.perms.charAt(0) == "d";
      // remove directory flag from perms string
      const perms = attributes.perms.substring(1);
      // split into 3 groups:
      const [user, group, other] = perms.match(/.{1,3}/g);
      let attrs: FileAttributes = {
        directory: isDirectory,
        name: name,
        group: attributes.group,
        owner: attributes.owner,
        perms: [user, group, other].reduce((all, permGroup, i) => {
          const key = PERMISSION_GROUPS[i];

          all = {
            ...all,
            [key]: {
              read: permGroup.charAt(0) === "r",
              write: permGroup.charAt(1) === "w",
              execute: permGroup.charAt(2) === "x",
            },
          };
          return all;
        }, {}),
        tag: attributes.tag ?? notSupported,
      };

      setAttributes({
        initial: attrs,
        current: attrs,
      });
      setAllowUpdate(false);
      setTimestamp(new Date());
    });
    // signal to extension that webview is ready for data; prevents race condition during initialization
    vscodeApi.postMessage({ command: "ready" });
    vscodeApi.postMessage({ command: "GET_LOCALIZATION" });
  }, []);

  const updatePerm = (group: keyof FilePermissions, perm: keyof PermissionSet, value: boolean) => {
    if (attributes.current) {
      setAttributes((prev) => {
        const newAttrs = {
          ...(prev ?? {}),
          current: {
            ...prev.current,
            perms: { ...prev.current!.perms, [group]: { ...prev.current!.perms[group], [perm]: value } },
          } as FileAttributes,
        };
        updateButtons(newAttrs.current);
        return newAttrs;
      });
    }
  };

  return attributes.current ? (
    <div role="main" aria-label={l10n.t("File Properties Editor")}>
      <header role="banner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 id="page-title">{l10n.t("File Properties")}</h1>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} role="group" aria-label={l10n.t("Page actions")}>
            {timestamp && (
              <p style={{ fontStyle: "italic", marginRight: "1em" }} aria-live="polite" aria-atomic="true" role="status">
                {l10n.t("Last refreshed:")} {timestamp.toLocaleString(navigator.language)}
              </p>
            )}
            <VSCodeButton
              appearance="secondary"
              onClick={() => vscodeApi.postMessage({ command: "refresh" })}
              aria-label={l10n.t("Refresh file properties")}
              aria-describedby="page-title"
            >
              <span style={{ marginRight: "0.5em" }} aria-hidden="true">
                ⟳
              </span>
              {l10n.t("Refresh")}
            </VSCodeButton>
          </div>
        </div>
      </header>
      <div role="region" aria-labelledby="file-path-label">
        <span id="file-path-label" className="visually-hidden">
          {l10n.t("File path")}
        </span>
        <pre style={{ fontSize: "1.25em", fontWeight: "bold" }} aria-label={l10n.t("File path: {0}", attributes.current.name)}>
          {attributes.current.name}
        </pre>
      </div>
      <VSCodeDivider role="separator" aria-hidden="true" />
      {attributes.initial?.directory ?? false ? null : (
        <section style={{ marginTop: "1em", display: "flex", marginLeft: "1em" }} role="region" aria-labelledby="tag-section-label">
          <span id="tag-section-label" className="visually-hidden">
            {l10n.t("File tag section")}
          </span>
          <VSCodeTextField
            readonly={attributes.current.tag === notSupported}
            value={attributes.current.tag}
            onInput={(e: any) => updateFileAttributes("tag", e.target.value)}
            aria-label={l10n.t("Tag")}
            aria-readonly={attributes.current.tag === notSupported}
            aria-describedby={attributes.current.tag === notSupported ? "tag-not-supported" : undefined}
          >
            {l10n.t("Tag")}
          </VSCodeTextField>
          {attributes.current.tag === notSupported && (
            <span id="tag-not-supported" className="visually-hidden">
              {l10n.t("Tag editing is not supported for this file")}
            </span>
          )}
        </section>
      )}
      <section style={{ marginTop: "1em" }} role="region" aria-labelledby="attributes-section-label">
        <h2 id="attributes-section-label" className="visually-hidden">
          {l10n.t("File attributes and permissions")}
        </h2>
        <div style={{ maxWidth: "fit-content" }}>
          <div style={{ display: "flex", marginLeft: "1em" }} role="group" aria-labelledby="ownership-label">
            <span id="ownership-label" className="visually-hidden">
              {l10n.t("File ownership")}
            </span>
            <VSCodeTextField
              value={attributes.current.owner}
              onInput={(e: any) => updateFileAttributes("owner", e.target.value)}
              aria-label={l10n.t("Owner")}
              aria-required="true"
            >
              {l10n.t("Owner")}
            </VSCodeTextField>
            <VSCodeTextField
              style={{ marginLeft: "1em" }}
              onInput={(e: any) => updateFileAttributes("group", e.target.value)}
              value={attributes.current.group}
              aria-label={l10n.t("Group")}
              aria-required="true"
            >
              {l10n.t("Group")}
            </VSCodeTextField>
          </div>
          {attributes.current.perms ? (
            <div role="region" aria-labelledby="permissions-table-label">
              <h3 id="permissions-table-label" className="visually-hidden">
                {l10n.t("File permissions table")}
              </h3>
              <VSCodeDataGrid
                style={{ marginTop: "1em" }}
                aria-label={l10n.t("File permissions")}
                aria-describedby="permissions-description"
                role="grid"
              >
                <VSCodeDataGridRow row-type="header" role="row">
                  <VSCodeDataGridCell cellType="columnheader" gridColumn="1" role="columnheader" aria-sort="none">
                    {l10n.t("Permission Group")}
                  </VSCodeDataGridCell>
                  {localizedPermissionTypes.map(({ key, localized }, i) => {
                    return (
                      <VSCodeDataGridCell
                        cellType="columnheader"
                        gridColumn={(i + 2).toString()}
                        key={`${key}-header`}
                        role="columnheader"
                        aria-sort="none"
                      >
                        {localized}
                      </VSCodeDataGridCell>
                    );
                  })}
                </VSCodeDataGridRow>
                {localizedPermissionGroups.map(({ key, localized }) => {
                  return (
                    <VSCodeDataGridRow key={`${key}-row`} row-type="data" role="row" aria-label={l10n.t("{0} permissions", localized)}>
                      <VSCodeDataGridCell cellType="rowheader" gridColumn="1" row-type="header" role="rowheader">
                        {localized}
                      </VSCodeDataGridCell>
                      {PERMISSION_TYPES.map((perm, i) => {
                        const permLabel = localizedPermissionTypes.find((p) => p.key === perm)?.localized || perm;
                        const isChecked = attributes.current!.perms[key as keyof FilePermissions][perm];
                        return (
                          <VSCodeDataGridCell gridColumn={(i + 2).toString()} key={`${key}-${perm}-checkbox`} row-type="data" role="gridcell">
                            <VSCodeCheckbox
                              checked={isChecked}
                              onChange={(e: any) => updatePerm(key as keyof FilePermissions, perm, e.target.checked)}
                              aria-label={l10n.t("{0} {1} permission", localized, permLabel)}
                              aria-checked={isChecked}
                              role="checkbox"
                            />
                          </VSCodeDataGridCell>
                        );
                      })}
                    </VSCodeDataGridRow>
                  );
                })}
              </VSCodeDataGrid>
              <span id="permissions-description" className="visually-hidden">
                {l10n.t("Use checkboxes to toggle read, write, and execute permissions for user, group, and all users")}
              </span>
            </div>
          ) : null}
          <div
            style={{ display: "flex", alignItems: "center", marginLeft: "1em", marginTop: "1em", marginBottom: "1em" }}
            role="group"
            aria-labelledby="actions-label"
          >
            <span id="actions-label" className="visually-hidden">
              {l10n.t("Actions")}
            </span>
            <VSCodeButton
              disabled={!allowUpdate || readonly}
              onClick={() => {
                applyAttributes();
              }}
              aria-label={l10n.t("Apply changes to file attributes")}
              aria-disabled={!allowUpdate || readonly}
              aria-describedby={!allowUpdate ? "no-changes-message" : readonly ? "readonly-message" : undefined}
            >
              {l10n.t("Apply changes")}
            </VSCodeButton>
            {!allowUpdate && !readonly && (
              <span id="no-changes-message" className="visually-hidden">
                {l10n.t("No changes to apply")}
              </span>
            )}
            {isUpdating && (
              <VSCodeProgressRing style={{ marginLeft: "1em" }} aria-label={l10n.t("Updating file attributes")} role="status" aria-live="polite" />
            )}
          </div>
          <div role="note" aria-labelledby="info-note-label">
            <span id="info-note-label" className="visually-hidden">
              {l10n.t("Information")}
            </span>
            <p style={{ marginLeft: "1em" }}>
              <strong>{l10n.t("Note:")}</strong>{" "}
              {l10n.t(
                "To update permissions, use the checkboxes to select or change the required access. Any changes you make will apply only to the file that is currently selected. These updates will not affect other files, even if they have the same permissions or attributes."
              )}
            </p>
          </div>
          {readonly && (
            <div role="alert" aria-live="polite" aria-atomic="true">
              <span id="readonly-message" style={{ marginLeft: "1em", color: "var(--vscode-editorLightBulb-foreground)" }}>
                {l10n.t("The API does not support updating attributes for this")} {attributes.initial?.directory ?? false ? "directory" : "file"}.
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  ) : (
    <div role="main" aria-label={l10n.t("File Properties Editor")} aria-busy="true">
      <header role="banner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 id="loading-title">{l10n.t("File Properties")}</h1>
          <VSCodeProgressRing style={{ marginLeft: "1em" }} aria-label={l10n.t("Loading file properties")} role="status" aria-live="polite" />
        </div>
      </header>
      <VSCodeDivider role="separator" aria-hidden="true" />
      <div role="status" aria-live="polite" aria-atomic="true">
        <p style={{ fontStyle: "italic" }}>{l10n.t("Waiting for data from extension...")}</p>
      </div>
    </div>
  );
}
