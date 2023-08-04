import { useEffect, useState } from "preact/hooks";
import { FileAttributes } from "./types";
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
  VSCodeDivider,
  VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";
import { isEqual } from "lodash.isequal";

const vscodeApi = acquireVsCodeApi();
//const replaceCharAt = (str: string, char: string, index: number) => str.substring(0, index) + char + str.substring(index + 1);

export function App() {
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [allowUndo, setAllowUndo] = useState(false);
  const [fileAttributes, setFileAttributes] = useState<FileAttributes>({});
  const [initialAttributes, setInitialAttributes] = useState<FileAttributes>({});

  const updateUndo = () => {
    if (!isEqual(initialAttributes, fileAttributes)) {
      setAllowUndo(true);
    } else {
      setAllowUndo(false);
    }
  };

  const updateFileAttributes = (key: keyof FileAttributes, value: unknown) => {
    if (fileAttributes[key] != value) {
      setFileAttributes({ ...fileAttributes, [key]: value });
    }
    if (!allowUpdate) {
      setAllowUpdate(true);
    }
    updateUndo();
  };

  const applyAttributes = () => {
    // convert perm booleans to string
    const permString = fileAttributes?.perms?.reduce((all, perm) => {
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
        perms: [group, user, other].reduce((all, permGroup) => {
          all.push({
            read: permGroup.charAt(0) === "r",
            write: permGroup.charAt(1) === "w",
            execute: permGroup.charAt(2) === "x",
          });
          return all;
        }, []),
      };
      console.log("Attributes:", attrs);

      setFileAttributes(attrs);
      setInitialAttributes(attrs);
      setAllowUndo(false);
    });
  }, []);

  return (
    <div>
      <h1>File properties</h1>
      <h3>{fileAttributes?.name ?? "Unknown file name"}</h3>
      <VSCodeDivider />
      <div style={{ marginTop: "1em" }}>
        <div style={{ maxWidth: "fit-content" }}>
          <div style={{ display: "flex", marginLeft: "1em" }}>
            <VSCodeTextField value={fileAttributes?.owner} onInput={(e: any) => updateFileAttributes("owner", e.target.value)}>
              Owner
            </VSCodeTextField>
            <VSCodeTextField
              style={{ marginLeft: "1em" }}
              onInput={(e: any) => updateFileAttributes("group", e.target.value)}
              value={fileAttributes?.group}
            >
              Group
            </VSCodeTextField>
            <VSCodeTextField
              style={{ marginLeft: "1em" }}
              onInput={(e: any) => updateFileAttributes("gid", e.target.value)}
              value={fileAttributes?.gid}
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
              {["read", "write", "execute"].map((perm) => {
                const capitalizedPerm = perm.charAt(0).toUpperCase() + perm.slice(1);
                return (
                  <VSCodeDataGridRow>
                    <VSCodeDataGridCell cellType="rowheader" gridColumn="1">
                      {capitalizedPerm}
                    </VSCodeDataGridCell>
                    <VSCodeDataGridCell gridColumn="2">
                      <VSCodeCheckbox
                        checked={fileAttributes.perms![0][perm]}
                        onChange={(e: any) => {
                          let newAttrs = { ...fileAttributes };
                          newAttrs.perms![0][perm] = e.target.checked;
                          setFileAttributes(newAttrs);
                          updateUndo();
                        }}
                      />
                    </VSCodeDataGridCell>
                    <VSCodeDataGridCell gridColumn="3">
                      <VSCodeCheckbox
                        checked={fileAttributes.perms![1][perm]}
                        onChange={(e: any) => {
                          let newAttrs = { ...fileAttributes };
                          newAttrs.perms![1][perm] = e.target.checked;
                          setFileAttributes(newAttrs);
                          updateUndo();
                        }}
                      />
                    </VSCodeDataGridCell>
                    <VSCodeDataGridCell gridColumn="4">
                      <VSCodeCheckbox
                        checked={fileAttributes.perms![2][perm]}
                        onChange={(e: any) => {
                          let newAttrs = { ...fileAttributes };
                          newAttrs.perms![2][perm] = e.target.checked;
                          setFileAttributes(newAttrs);
                          updateUndo();
                        }}
                      />
                    </VSCodeDataGridCell>
                  </VSCodeDataGridRow>
                );
              })}
            </VSCodeDataGrid>
          ) : null}
          <div style={{ display: "flex", marginLeft: "1em", marginTop: "1em" }}>
            <VSCodeButton disabled={!allowUpdate} onClick={() => applyAttributes()}>
              Apply changes
            </VSCodeButton>
            <VSCodeButton
              disabled={!allowUndo}
              style={{ marginLeft: "1em" }}
              onClick={() => {
                setFileAttributes({ ...initialAttributes });
                updateUndo();
              }}
            >
              Undo
            </VSCodeButton>
          </div>
        </div>
      </div>
    </div>
  );
}
