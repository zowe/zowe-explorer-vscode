import { useEffect, useState } from "preact/hooks";

const vscodeApi = acquireVsCodeApi();

export function App() {
  const [certPath, setCertPath] = useState("");
  const [certKeyPath, setCertKeyPath] = useState("");
  const [localizationState, setLocalizationState] = useState(null);

  useEffect(() => {
    window.addEventListener("message", (event) => {});
  }, [localizationState]);

  return <div>Hello World!</div>;
}
