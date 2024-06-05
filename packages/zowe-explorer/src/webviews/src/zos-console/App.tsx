import { Dropdown, Option, TextArea, TextField } from "@vscode/webview-ui-toolkit";
import { VSCodeDropdown, VSCodeTextArea, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { useEffect } from "preact/hooks";

declare const vscode: any;

export function App() {
  useEffect(() => {
    window.addEventListener("message", (event) => {
      const message = event.data;
      switch (message.type) {
        case "commandResult":
          const consoleResponse = document.getElementById("output") as TextArea;
          consoleResponse!.value += `> ${message.cmd} (${message.profile})\n`;
          consoleResponse!.value += message.result;
          consoleResponse!.control.scrollTop = consoleResponse!.control.scrollHeight;
          break;
        case "optionsList":
          const profileList = document.getElementById("systems") as Option;
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
  });

  const sendCommand = (e: KeyboardEvent) => {
    const consoleField = document.getElementById("command-input") as TextField;
    const consoleResponse = document.getElementById("output") as TextArea;
    const profileList = document.getElementById("systems") as Dropdown;
    if (e.key === "Enter") {
      if (consoleField!.value === "clear") {
        consoleResponse.value = "";
        consoleResponse.control.scrollTop = 0;
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
    <div>
      <VSCodeDropdown id="systems" style={{ float: "right" }}></VSCodeDropdown>
      <VSCodeTextArea
        id="output"
        readonly
        rows="8"
        resize="vertical"
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          display: "block",
          "font-family": "monospace",
        }}
      ></VSCodeTextArea>
      <VSCodeTextField
        id="command-input"
        name="command-input"
        type="text"
        onKeyDown={(e: KeyboardEvent) => sendCommand(e)}
        style={{
          width: "100%",
          "font-family": "monospace",
        }}
      >
        <span slot="start" class="codicon codicon-chevron-right"></span>
      </VSCodeTextField>
    </div>
  );
}
