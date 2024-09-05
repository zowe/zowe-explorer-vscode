import { Dropdown, Option, TextArea, TextField } from "@vscode/webview-ui-toolkit";
import { VSCodeDropdown, VSCodeTextArea, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { useEffect, useState } from "preact/hooks";

declare const vscode: any;

/**
 *
 * @deprecated
 */
export function App() {
  const [consoleContent, setConsoleContent] = useState("");
  useEffect(() => {
    window.addEventListener("message", (event) => {
      // Prevent users from sending data into webview outside of extension/webview context
      const eventUrl = new URL(event.origin);
      const isWebUser =
        (eventUrl.protocol === document.location.protocol && eventUrl.hostname === document.location.hostname) ||
        eventUrl.hostname.endsWith(".github.dev");
      const isLocalVSCodeUser = eventUrl.protocol === "vscode-webview:";

      if (!isWebUser && !isLocalVSCodeUser) {
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
      }
    });
    const consoleResponse = document.getElementById("output") as TextArea;
    consoleResponse.control.scrollTop = consoleResponse.control.scrollHeight;
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
          placeholder="Enter command here..."
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
