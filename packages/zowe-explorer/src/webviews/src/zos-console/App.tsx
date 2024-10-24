import { Dropdown, Option, TextArea, TextField } from "@vscode/webview-ui-toolkit";
import { VSCodeDropdown, VSCodeTextArea, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { useEffect, useState } from "preact/hooks";
import * as l10n from "@vscode/l10n";
import { isSecureOrigin } from "../utils";

declare const vscode: any;

/**
 *
 * @deprecated
 */
export function App() {
  const [consoleContent, setConsoleContent] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  useEffect(() => {
    window.addEventListener("message", (event) => {
      // Prevent users from sending data into webview outside of extension/webview context
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      const message = event.data;
      const profileList = document.getElementById("systems") as Option;

      switch (message.type) {
        case "commandResult":
          setConsoleContent(consoleContent + `> ${message.cmd} (${message.profile})\n${message.result}`);
          break;
        case "optionsList":
          for (const profile in message.profiles) {
            const option = document.createElement("vscode-option");
            option.textContent = message.profiles[profile];
            if (message.profiles[profile] === message.defaultProfile) {
              option.setAttribute("selected", "true");
            }
            profileList.appendChild(option);
          }
          break;
        case "GET_LOCALIZATION": {
          const { contents } = event.data;
          l10n.config({
            contents: contents,
          });
          setPlaceholder(l10n.t("Enter Command here..."));
          break;
        }
      }
    });
    const consoleResponse = document.getElementById("output") as TextArea;
    consoleResponse.control.scrollTop = consoleResponse.control.scrollHeight;
    vscode.postMessage({ command: "GET_LOCALIZATION" });
  });

  const sendCommand = (e: KeyboardEvent) => {
    const consoleField = document.getElementById("command-input") as TextField;
    const profileList = document.getElementById("systems") as Dropdown;
    if (e.key === "Enter") {
      if (consoleField!.value === "clear") {
        setConsoleContent("");
      } else {
        vscode.postMessage({
          command: "opercmd",
          profile: profileList.options[profileList.selectedIndex].text,
          text: consoleField.value,
        });
      }
      consoleField.value = "";
    }
  };

  return (
    <div className="box">
      <div style="display: flex; align-items: center; gap: 10px;">
        <VSCodeTextField
          id="command-input"
          name="command-input"
          type="text"
          placeholder={placeholder}
          onKeyDown={sendCommand}
          style={{
            width: "100%",
            "font-family": "Consolas,monospace",
          }}
        >
          <span slot="start" className="codicon codicon-chevron-right"></span>
        </VSCodeTextField>
        <VSCodeDropdown id="systems"></VSCodeDropdown>
      </div>
      <VSCodeTextArea
        id="output"
        readonly
        resize="none"
        value={consoleContent}
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          display: "flex",
          "font-family": "Consolas,monospace",
        }}
      ></VSCodeTextArea>
    </div>
  );
}
