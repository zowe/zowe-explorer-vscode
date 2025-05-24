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
      const profileList = document.getElementById("systems") as HTMLSelectElement;

      switch (message.type) {
        case "commandResult":
          setConsoleContent(consoleContent + `> ${message.cmd} (${message.profile})\n${message.result}`);
          break;
        case "optionsList":
          for (const profile in message.profiles) {
            const option = document.createElement("option");
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
          setPlaceholder(l10n.t("Enter command here..."));
          break;
        }
      }
    });
    const consoleResponse = document.getElementById("output") as HTMLTextAreaElement;
    consoleResponse.scrollTop = consoleResponse.scrollHeight;
    vscode.postMessage({ command: "GET_LOCALIZATION" });
  });

  const sendCommand = (e: KeyboardEvent) => {
    const consoleField = document.getElementById("command-input") as HTMLInputElement;
    const profileList = document.getElementById("systems") as HTMLSelectElement;
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
    <div className="box vscode-panel">
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ position: "relative", width: "calc(100% - 170px)" }}>
          <span
            className="codicon codicon-chevron-right"
            style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          ></span>
          <input
            id="command-input"
            name="command-input"
            type="text"
            placeholder={placeholder}
            onKeyDown={sendCommand}
            style={{
              width: "100%",
              paddingLeft: "30px",
              fontFamily: "Consolas,monospace",
              backgroundColor: "var(--vscode-editor-background)",
              color: "var(--vscode-editor-foreground)",
              border: "none",
              outline: "none",
            }}
          />
        </div>
        <select
          id="systems"
          style={{
            width: "150px",
            marginLeft: "20px",
            backgroundColor: "var(--vscode-editor-background)",
            color: "var(--vscode-editor-foreground)",
            border: "none",
            outline: "none",
          }}
        ></select>
      </div>
      <textarea
        id="output"
        readOnly
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          display: "flex",
          fontFamily: "Consolas,monospace",
          backgroundColor: "var(--vscode-editor-background)",
          color: "var(--vscode-editor-foreground)",
          border: "none",
          outline: "none",
        }}
        value={consoleContent}
      ></textarea>
    </div>
  );
}
