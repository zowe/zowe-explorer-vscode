import { Dropdown, Option, TextArea, TextField } from "@vscode/webview-ui-toolkit";
import { VSCodeDropdown, VSCodeTextArea, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { useEffect, useState } from "preact/hooks";

declare const vscode: any;

export function App() {
  const [consoleContent, setConsoleContent] = useState("");
  useEffect(() => {
    window.addEventListener("message", (event) => {
      const message = event.data;
      switch (message.type) {
        case "commandResult":
          setConsoleContent(consoleContent + `> ${message.cmd} (${message.profile})\n${message.result}`);
          // const consoleResponse = document.getElementById("output") as TextArea;
          // consoleResponse.control.scrollTop = consoleResponse.control.scrollHeight;
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
    <div class="box">
      <VSCodeDropdown id="systems" style={{ "align-self": "flex-end" }}></VSCodeDropdown>
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
          "font-family": "monospace",
        }}
      ></VSCodeTextArea>
      <VSCodeTextField
        id="command-input"
        name="command-input"
        type="text"
        onKeyDown={sendCommand}
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
