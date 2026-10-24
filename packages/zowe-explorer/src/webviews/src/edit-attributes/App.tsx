import { useEffect, useState } from "preact/hooks";
import { FileAttributes, FilePermissions, PERMISSION_GROUPS, PERMISSION_TYPES, PermissionSet } from "./types";
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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{l10n.t("File Properties")}</h1>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} aria-label={l10n.t("Header actions")}>
          {timestamp && (
            <p style={{ fontStyle: "italic", marginRight: "1em" }}>
              {l10n.t("Last refreshed:")} {timestamp.toLocaleString(navigator.language)}
            </p>
          )}
          <vscode-button
            secondary
            icon="refresh"
            aria-label={l10n.t("Refresh File Properties")}
            onClick={() => vscodeApi.postMessage({ command: "refresh" })}
          >
            {l10n.t("Refresh")}
          </vscode-button>
        </div>
      </div>
      <strong>
        <pre style={{ fontSize: "1.25em" }} aria-label={l10n.t("File path")}>
          {attributes.current.name}
        </pre>
      </strong>
      <vscode-divider />
      {(attributes.initial?.directory ?? false) ? null : (
        <div style={{ marginTop: "1em", display: "flex", flexDirection: "column", marginLeft: "1em", width: "fit-content" }}>
          <vscode-label htmlFor="file-tag">{l10n.t("Tag")}</vscode-label>
          <vscode-textfield
            id="file-tag"
            readonly={attributes.current.tag === notSupported}
            value={attributes.current.tag}
            onInput={(e) => updateFileAttributes("tag", e.currentTarget.value)}
          ></vscode-textfield>
        </div>
      )}
      <div style={{ marginTop: "1em" }}>
        <div style={{ maxWidth: "fit-content" }}>
          <div
            style={{ display: "flex", marginLeft: "1em" }}
            role="group"
            aria-label={l10n.t("Owner and group information with text fields to edit them")}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <vscode-label htmlFor="file-owner">{l10n.t("Owner")}</vscode-label>
              <vscode-textfield
                id="file-owner"
                value={attributes.current.owner}
                onInput={(e) => updateFileAttributes("owner", e.currentTarget.value)}
              ></vscode-textfield>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: "1em" }}>
              <vscode-label htmlFor="file-group">{l10n.t("Group")}</vscode-label>
              <vscode-textfield
                id="file-group"
                value={attributes.current.group}
                onInput={(e) => updateFileAttributes("group", e.currentTarget.value)}
              ></vscode-textfield>
            </div>
          </div>
          {attributes.current.perms ? (
            <>
              <vscode-table
                style={{ marginTop: "1em", minWidth: "26em" }}
                aria-label={l10n.t("File permissions with checkboxes to toggle them")}
                aria-describedby="permissions-description"
              >
                <vscode-table-header slot="header">
                  <vscode-table-header-cell></vscode-table-header-cell>
                  {localizedPermissionTypes.map(({ key, localized }) => {
                    return (
                      <vscode-table-header-cell key={`${key}-header`} id={`perm-header-${key}`}>
                        {localized}
                      </vscode-table-header-cell>
                    );
                  })}
                </vscode-table-header>
                <vscode-table-body slot="body">
                  {localizedPermissionGroups.map(({ key, localized }) => {
                    return (
                      <vscode-table-row key={`${key}-row`}>
                        <vscode-table-cell id={`group-header-${key}`}>{localized}</vscode-table-cell>
                        {PERMISSION_TYPES.map((perm) => {
                          const permLabel = localizedPermissionTypes.find((p) => p.key === perm)?.localized || perm;
                          const isChecked = attributes.current!.perms[key as keyof FilePermissions][perm];
                          return (
                            <vscode-table-cell key={`${key}-${perm}-checkbox`}>
                              <vscode-checkbox
                                id={`checkbox-${key}-${perm}`}
                                checked={isChecked}
                                onChange={(e) => updatePerm(key as keyof FilePermissions, perm, e.currentTarget.checked)}
                              >
                                <span style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}>
                                  {l10n.t("{0} {1}", localized, permLabel)}
                                </span>
                              </vscode-checkbox>
                            </vscode-table-cell>
                          );
                        })}
                      </vscode-table-row>
                    );
                  })}
                </vscode-table-body>
              </vscode-table>
              <span id="permissions-description" style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}>
                {l10n.t("Use checkboxes to toggle read, write, and execute permissions for user, group, and all users")}
              </span>
            </>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", marginLeft: "1em", marginTop: "1em", marginBottom: "1em" }}>
            <vscode-button
              disabled={!allowUpdate || readonly}
              aria-label={
                !allowUpdate || readonly
                  ? l10n.t("Apply changes button - disabled. Make changes to file properties to activate this button")
                  : l10n.t("Apply changes button - click to save your modifications")
              }
              onClick={() => {
                applyAttributes();
              }}
            >
              {l10n.t("Apply changes")}
            </vscode-button>
            {isUpdating && <vscode-progress-ring style={{ marginLeft: "1em" }} aria-label={l10n.t("Updating file properties")} />}
          </div>
          {readonly && (
            <span style={{ marginLeft: "1em", color: "var(--vscode-editorLightBulb-foreground)" }}>
              {l10n.t("The API does not support updating attributes for this")} {(attributes.initial?.directory ?? false) ? "directory" : "file"}.
            </span>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{l10n.t("File Properties")}</h1>
        <vscode-progress-ring style={{ marginLeft: "1em" }} />
      </div>
      <vscode-divider />
      <p style={{ fontStyle: "italic" }}>{l10n.t("Waiting for data from extension...")}</p>
    </div>
  );
}
