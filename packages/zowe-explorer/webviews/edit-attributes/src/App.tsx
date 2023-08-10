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
import isEqual from "lodash.isequal";

const vscodeApi = acquireVsCodeApi();
//const replaceCharAt = (str: string, char: string, index: number) => str.substring(0, index) + char + str.substring(index + 1);

export function App() {
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [attributes, setAttributes] = useState<Record<"current" | "initial", FileAttributes | null>>({
    current: null,
    initial: null,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [timestamp, setTimestamp] = useState<Date | null>();

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
      const permString = Object.values(attributes.current.perms).reduce((all, perm) => {
        const read = perm.read ? "r" : "-";
        const write = perm.write ? "w" : "-";
        const execute = perm.execute ? "x" : "-";
        return all.concat(read, write, execute);
      }, `${attributes.current.directory ? "d" : "-"}`);
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
      if (!event.origin || !event.origin.startsWith("vscode-webview://")) {
        return;
      }

      if (!event.data) {
        return;
      }

      if ("updated" in event.data) {
        setIsUpdating(false);
        setTimestamp(new Date());
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
      const [group, user, other] = perms.match(/.{1,3}/g);
      let attrs: FileAttributes = {
        directory: isDirectory,
        name: name,
        group: attributes.group,
        owner: attributes.owner,
        perms: [group, user, other].reduce((all, permGroup, i) => {
          let key: string = "";
          switch (i) {
            case 0:
              key = "group";
              break;
            case 1:
              key = "user";
              break;
            case 2:
              key = "all";
              break;
          }

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
      };

      setAttributes({
        initial: attrs,
        current: attrs,
      });
    });
    // signal to extension that webview is ready for data; prevents race condition during initialization
    vscodeApi.postMessage({ command: "ready" });
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
        <h1>File properties</h1>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {timestamp && <p style={{ fontStyle: "italic", marginRight: "1em" }}>Last refreshed: {timestamp.toLocaleString(navigator.language)}</p>}
          <VSCodeButton
            appearance="secondary"
            onClick={() => {
              vscodeApi.postMessage({ command: "refresh" });
              setTimestamp(new Date());
            }}
          >
            <span style={{ marginRight: "0.5em" }}>⟳</span>Refresh
          </VSCodeButton>
        </div>
      </div>
      <strong>
        <pre style={{ fontSize: "1.25em" }}>{attributes.current.name}</pre>
      </strong>
      <VSCodeDivider />
      <div style={{ marginTop: "1em" }}>
        <div style={{ maxWidth: "fit-content" }}>
          <div style={{ display: "flex", marginLeft: "1em" }}>
            <VSCodeTextField value={attributes.current.owner} onInput={(e: any) => updateFileAttributes("owner", e.target.value)}>
              Owner
            </VSCodeTextField>
            <VSCodeTextField
              style={{ marginLeft: "1em" }}
              onInput={(e: any) => updateFileAttributes("group", e.target.value)}
              value={attributes.current.group}
            >
              Group
            </VSCodeTextField>
          </div>
          {attributes.current.perms ? (
            <VSCodeDataGrid style={{ marginTop: "1em" }}>
              <VSCodeDataGridRow>
                <VSCodeDataGridCell cellType="columnheader" gridColumn="1">
                  Permission
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cellType="columnheader" gridColumn="2">
                  Group
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cellType="columnheader" gridColumn="3">
                  Owner
                </VSCodeDataGridCell>
                <VSCodeDataGridCell cellType="columnheader" gridColumn="4">
                  All
                </VSCodeDataGridCell>
              </VSCodeDataGridRow>
              {PERMISSION_TYPES.map((perm) => {
                const capitalizedPerm = perm.charAt(0).toUpperCase() + perm.slice(1);
                return (
                  <VSCodeDataGridRow>
                    <VSCodeDataGridCell cellType="rowheader" gridColumn="1">
                      {capitalizedPerm}
                    </VSCodeDataGridCell>
                    {PERMISSION_GROUPS.map((group, i) => (
                      <VSCodeDataGridCell gridColumn={(i + 2).toString()}>
                        <VSCodeCheckbox
                          checked={attributes.current!.perms[group][perm]}
                          onChange={(e: any) => updatePerm(group, perm, e.target.checked)}
                        />
                      </VSCodeDataGridCell>
                    ))}
                  </VSCodeDataGridRow>
                );
              })}
            </VSCodeDataGrid>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", marginLeft: "1em", marginTop: "1em" }}>
            <VSCodeButton
              disabled={!allowUpdate}
              onClick={() => {
                applyAttributes();
              }}
            >
              Apply changes
            </VSCodeButton>
            {isUpdating && <VSCodeProgressRing style={{ marginLeft: "1em" }} />}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>File properties</h1>
        <VSCodeProgressRing style={{ marginLeft: "1em" }} />
      </div>
      <VSCodeDivider />
      <p style={{ fontStyle: "italic" }}>Waiting for data from extension...</p>
    </div>
  );
}
