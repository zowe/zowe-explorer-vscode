import { render } from "preact";
import { App } from "./App";

console.log("test");
render(<App />, document.getElementById("webviewRoot")!);
