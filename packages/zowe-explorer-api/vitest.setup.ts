import { vi } from "vitest";

vi.mock("vscode", () => {
    return import("./__mocks__/vscode.ts");
});
