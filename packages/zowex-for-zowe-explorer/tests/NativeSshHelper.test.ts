/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import * as fs from "node:fs";
import { imperative } from "@zowe/zowe-explorer-api";
import { handleNativeSshSettings } from "../src/NativeSshHelper";

// Mock native fs operations (named imports are not configurable for spyOn under ESM).
vi.mock("node:fs", async (importActual) => {
    const actual = (await importActual()) as typeof import("node:fs");
    return {
        ...actual,
        existsSync: vi.fn(() => false),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
    };
});

// Mock global fetch used to download the native binary.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// `handleNativeSshSettings` swallows the async work via `.catch()`, so drain the
// microtask/macrotask queue fully before asserting on side effects.
async function flush(): Promise<void> {
    for (let i = 0; i < 15; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
}

describe("NativeSshHelper", () => {
    const realPlatform = process.platform;
    const realArch = process.arch;
    const fakeContext = { extensionPath: "/ext/path" } as unknown as vscode.ExtensionContext;

    afterEach(() => {
        fetchMock.mockReset();
        Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
        Object.defineProperty(process, "arch", { value: realArch, configurable: true });
    });

    // `restoreMocks` (config) unstubs the global each test, so re-stub fetch up front.
    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
    });

    function setPlatform(platform: string, arch: string): void {
        Object.defineProperty(process, "platform", { value: platform, configurable: true });
        Object.defineProperty(process, "arch", { value: arch, configurable: true });
    }

    function mockFlag(enabled: boolean): void {
        vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
            get: vi.fn(() => enabled),
            update: vi.fn(),
        } as any);
    }

    describe("handleNativeSshSettings", () => {
        it("should do nothing when the experimental native SSH setting is disabled", async () => {
            mockFlag(false);
            const warnSpy = vi.spyOn(vscode.window, "showWarningMessage").mockReturnValue(undefined);
            handleNativeSshSettings(fakeContext);
            await flush();
            expect(warnSpy).not.toHaveBeenCalled();
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("ensureNativeBinary (via handleNativeSshSettings)", () => {
        beforeEach(() => {
            mockFlag(true);
            vi.spyOn(imperative.Logger, "getAppLogger").mockReturnValue({ info: vi.fn(), error: vi.fn() } as any);
            fetchMock.mockResolvedValue({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });
        });

        it("should skip the download when the binary already exists on disk", async () => {
            vi.spyOn(fs, "existsSync").mockReturnValue(true);

            handleNativeSshSettings(fakeContext);
            await flush();
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("should download and write the native binary when missing (darwin-arm64)", async () => {
            setPlatform("darwin", "arm64");
            vi.spyOn(fs, "existsSync").mockReturnValue(false);
            const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined as never);
            const mkdirSpy = vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined as never);
            const infoSpy = vi.fn();
            vi.spyOn(imperative.Logger, "getAppLogger").mockReturnValue({ info: infoSpy, error: vi.fn() } as any);

            handleNativeSshSettings(fakeContext);
            await flush();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(String(fetchMock.mock.calls[0][0])).toContain("russh@");
            expect(String(fetchMock.mock.calls[0][0])).toContain("darwin-arm64");
            expect(mkdirSpy).toHaveBeenCalled();
            expect(writeSpy).toHaveBeenCalled();
            expect(infoSpy).toHaveBeenCalled();
        });

        it("should show an error when the download response is not ok", async () => {
            setPlatform("darwin", "arm64");
            vi.spyOn(fs, "existsSync").mockReturnValue(false);
            fetchMock.mockResolvedValue({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);

            handleNativeSshSettings(fakeContext);
            await flush();

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(String(errorSpy.mock.calls[0][0])).toContain("Failed to download native SSH binary");
        });

        it("should show an error when the fetch rejects (e.g. abort/timeout)", async () => {
            setPlatform("darwin", "arm64");
            vi.spyOn(fs, "existsSync").mockReturnValue(false);
            fetchMock.mockRejectedValue(new Error("The operation was aborted"));
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);

            handleNativeSshSettings(fakeContext);
            await flush();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(errorSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("ensureNativeBinary platform support", () => {
        beforeEach(() => {
            mockFlag(true);
            vi.spyOn(imperative.Logger, "getAppLogger").mockReturnValue({ info: vi.fn(), error: vi.fn() } as any);
            fetchMock.mockResolvedValue({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });
        });

        it("should show a warning for an unsupported platform/arch and skip download", async () => {
            setPlatform("aix", "x64");
            const warnSpy = vi.spyOn(vscode.window, "showWarningMessage").mockReturnValue(undefined);
            vi.spyOn(fs, "existsSync").mockReturnValue(false);

            handleNativeSshSettings(fakeContext);
            await flush();

            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(String(warnSpy.mock.calls[0][0])).toContain("No native SSH binary available for aix-x64");
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("should resolve the win32-x64-msvc triple when downloading", async () => {
            setPlatform("win32", "x64");
            vi.spyOn(fs, "existsSync").mockReturnValue(false);
            vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined as never);
            vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined as never);

            handleNativeSshSettings(fakeContext);
            await flush();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(String(fetchMock.mock.calls[0][0])).toContain("win32-x64-msvc");
        });

        it("should resolve the linux-arm-gnueabihf triple when downloading", async () => {
            setPlatform("linux", "arm");
            vi.spyOn(fs, "existsSync").mockReturnValue(false);
            vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined as never);
            vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined as never);

            handleNativeSshSettings(fakeContext);
            await flush();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(String(fetchMock.mock.calls[0][0])).toContain("linux-arm-gnueabihf");
        });
    });
});
