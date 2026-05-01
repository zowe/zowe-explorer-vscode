import { vi } from "vitest";

vi.mock("vscode", () => {
    return import("./__mocks__/vscode.ts");
});

vi.mock("crypto", () => ({
    randomUUID: vi.fn(() => "test-uuid-1234-5678-9abc"),
}));
