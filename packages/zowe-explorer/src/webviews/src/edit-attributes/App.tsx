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
      if (!event.origin?.startsWith("vscode-webview://")) {
        return;
      }

      if (!event.data) {
        return;
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
          <VSCodeButton appearance="secondary" onClick={() => vscodeApi.postMessage({ command: "refresh" })}>
            <span style={{ marginRight: "0.5em" }}>⟳</span>Refresh
          </VSCodeButton>
        </div>
      </div>
      <strong>
        <pre style={{ fontSize: "1.25em" }}>{attributes.current.name}</pre>
      </strong>
      <VSCodeDivider />
      {attributes.initial?.directory ?? false ? null : (
        <div style={{ marginTop: "1em", display: "flex", marginLeft: "1em" }}>
          <VSCodeTextField
            readonly={attributes.current.tag === notSupported}
            value={attributes.current.tag}
            onInput={(e: any) => updateFileAttributes("tag", e.target.value)}
          >
            Tag
          </VSCodeTextField>
        </div>
      )}
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
                <VSCodeDataGridCell cellType="columnheader" gridColumn="1"></VSCodeDataGridCell>
                {PERMISSION_TYPES.map((perm, i) => {
                  const capitalizedPerm = perm.charAt(0).toUpperCase() + perm.slice(1);
                  return (
                    <VSCodeDataGridCell cellType="columnheader" gridColumn={(i + 2).toString()} key={`${perm}-header`}>
                      {capitalizedPerm}
                    </VSCodeDataGridCell>
                  );
                })}
              </VSCodeDataGridRow>
              {PERMISSION_GROUPS.map((group) => {
                const capitalizedGroup = group.charAt(0).toUpperCase() + group.slice(1);
                return (
                  <VSCodeDataGridRow key={`${group}-row`}>
                    <VSCodeDataGridCell cellType="rowheader" gridColumn="1">
                      {capitalizedGroup}
                    </VSCodeDataGridCell>
                    {PERMISSION_TYPES.map((perm, i) => (
                      <VSCodeDataGridCell gridColumn={(i + 2).toString()} key={`${group}-${perm}-checkbox`}>
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
          <div style={{ display: "flex", alignItems: "center", marginLeft: "1em", marginTop: "1em", marginBottom: "1em" }}>
            <VSCodeButton
              disabled={!allowUpdate || readonly}
              onClick={() => {
                applyAttributes();
              }}
            >
              Apply changes
            </VSCodeButton>
            {isUpdating && <VSCodeProgressRing style={{ marginLeft: "1em" }} />}
          </div>
          {readonly && (
            <span style={{ marginLeft: "1em", color: "var(--vscode-editorLightBulb-foreground)" }}>
              The API does not support updating attributes for this {attributes.initial?.directory ?? false ? "directory" : "file"}.
            </span>
          )}
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
