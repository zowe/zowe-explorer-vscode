import { useEffect, useState } from "preact/hooks";
import { FileAttributes, FilePermissions, PERMISSION_GROUPS, PERMISSION_TYPES, PermissionSet } from "./types";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeDivider,
  VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";
import isEqual from "lodash.isequal";

const vscodeApi = acquireVsCodeApi();
//const replaceCharAt = (str: string, char: string, index: number) => str.substring(0, index) + char + str.substring(index + 1);

export function App() {
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [allowUndo, setAllowUndo] = useState(false);
  const [fileAttributes, setFileAttributes] = useState<FileAttributes | null>(null);
  const [initialAttributes, setInitialAttributes] = useState<FileAttributes | null>(null);

  const updateButtons = () => {
    if (!isEqual(initialAttributes, fileAttributes)) {
      setAllowUpdate(true);
      setAllowUndo(true);
    } else {
      setAllowUpdate(false);
      setAllowUndo(false);
    }
  };

  useEffect(() => {
    updateButtons();
  }, [fileAttributes]);

  const updateFileAttributes = (key: keyof FileAttributes, value: unknown) => {
    if (fileAttributes && fileAttributes[key] != value) {
      setFileAttributes((prev) => ({ ...(prev ?? {}), [key]: value } as FileAttributes));
    }
  };

  const applyAttributes = () => {
    if (fileAttributes) {
      // convert perm booleans to string
      const permString = Object.values(fileAttributes.perms).reduce((all, perm) => {
        const read = perm.read ? "r" : "-";
        const write = perm.write ? "w" : "-";
        const execute = perm.execute ? "x" : "-";
        return all.concat(read, write, execute);
      }, `${fileAttributes.directory ? "d" : ""}`);
      vscodeApi.postMessage({
        command: "update-attributes",
        attrs: { ...fileAttributes, perms: permString },
      });
      setAllowUpdate(false);
    }
  };

  useEffect(() => {
    window.addEventListener("message", (event) => {
      const message = event.data;

      const isDirectory = message.perms.charAt(0) == "d";
      // remove directory flag from perms string
      const perms = message.perms.substring(1);
      console.log(perms);
      // split into 3 groups:
      const [group, user, other] = perms.match(/.{1,3}/g);
      let attrs: FileAttributes = {
        directory: isDirectory,
        name: message.name,
        gid: message.gid,
        group: message.group,
        owner: message.owner,
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

      setFileAttributes({ ...attrs });
      setInitialAttributes({ ...attrs });
      setAllowUndo(false);
    });
    // signal to extension that webview is ready for data; prevents race condition during initialization
    vscodeApi.postMessage({ command: "ready" });
  }, []);

  const updatePerm = (group: keyof FilePermissions, perm: keyof PermissionSet, value: boolean) => {
    if (fileAttributes) {
      updateFileAttributes("perms", { ...fileAttributes.perms, [group]: { ...fileAttributes.perms[group], [perm]: value } });
    }
  };

  return (
    fileAttributes && (
      <div>
        <h1>File properties</h1>
        <h3>{fileAttributes.name}</h3>
        <VSCodeDivider />
        <div style={{ marginTop: "1em" }}>
          <div style={{ maxWidth: "fit-content" }}>
            <div style={{ display: "flex", marginLeft: "1em" }}>
              <VSCodeTextField value={fileAttributes.owner} onInput={(e: any) => updateFileAttributes("owner", e.target.value)}>
                Owner
              </VSCodeTextField>
              <VSCodeTextField
                style={{ marginLeft: "1em" }}
                onInput={(e: any) => updateFileAttributes("group", e.target.value)}
                value={fileAttributes.group}
              >
                Group
              </VSCodeTextField>
              <VSCodeTextField
                style={{ marginLeft: "1em" }}
                onInput={(e: any) => updateFileAttributes("gid", e.target.value)}
                value={fileAttributes.gid}
              >
                Group ID
              </VSCodeTextField>
            </div>
            {fileAttributes.perms ? (
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
                            checked={fileAttributes.perms[group][perm]}
                            onChange={(e: any) => updatePerm(group, perm, e.target.checked)}
                          />
                        </VSCodeDataGridCell>
                      ))}
                    </VSCodeDataGridRow>
                  );
                })}
              </VSCodeDataGrid>
            ) : null}
            <div style={{ display: "flex", marginLeft: "1em", marginTop: "1em" }}>
              <VSCodeButton disabled={!allowUpdate} onClick={() => applyAttributes()}>
                Apply changes
              </VSCodeButton>
              {initialAttributes && (
                <VSCodeButton
                  disabled={!allowUndo}
                  style={{ marginLeft: "1em" }}
                  onClick={() => {
                    setFileAttributes({ ...initialAttributes });
                  }}
                >
                  Undo
                </VSCodeButton>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  );
}
