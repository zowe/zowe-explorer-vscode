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
    const actual = (await importActual());
    return {
        ...actual as typeof import("node:fs"),
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

        it.each([
            ["win32", "arm64", "win32-arm64-msvc"],
            ["darwin", "x64", "darwin-x64"],
            ["linux", "x64", "linux-x64-gnu"],
            ["linux", "arm64", "linux-arm64-gnu"],
        ])("should resolve the %s-%s triple (%s) when downloading", async (platform, arch, triple) => {
            setPlatform(platform, arch);
            vi.spyOn(fs, "existsSync").mockReturnValue(false);
            vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined as never);
            vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined as never);

            handleNativeSshSettings(fakeContext);
            await flush();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(String(fetchMock.mock.calls[0][0])).toContain(triple);
        });

        it("should warn when the platform is supported but the architecture is not (arch lookup misses)", async () => {
            // Exercises the `NATIVE_TRIPLES[platform]?.[arch]` arch-miss branch (distinct from an
            // entirely unknown platform): win32 is known, but "mips" has no entry.
            setPlatform("win32", "mips");
            const warnSpy = vi.spyOn(vscode.window, "showWarningMessage").mockReturnValue(undefined);
            vi.spyOn(fs, "existsSync").mockReturnValue(false);

            handleNativeSshSettings(fakeContext);
            await flush();

            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(String(warnSpy.mock.calls[0][0])).toContain("No native SSH binary available for win32-mips");
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("ensureNativeBinary timeout handling", () => {
        beforeEach(() => {
            mockFlag(true);
            vi.spyOn(imperative.Logger, "getAppLogger").mockReturnValue({ info: vi.fn(), error: vi.fn() } as any);
            setPlatform("darwin", "arm64");
            vi.spyOn(fs, "existsSync").mockReturnValue(false);
            vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined as never);
            vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined as never);
        });

        it("should clear the abort timeout after a successful fetch", async () => {
            fetchMock.mockResolvedValue({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });
            const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

            handleNativeSshSettings(fakeContext);
            await flush();

            // The `finally { clearTimeout(timeoutId) }` arm must run on the success path.
            expect(clearTimeoutSpy).toHaveBeenCalled();
        });

        it("should abort the request and surface an error when the timeout elapses", async () => {
            vi.useFakeTimers();
            try {
                const abortSpy = vi.spyOn(AbortController.prototype, "abort");
                // fetch only settles when its AbortSignal fires, so advancing the timer triggers the reject.
                fetchMock.mockImplementation(
                    (_url: string, opts: { signal: AbortSignal }) =>
                        new Promise((_resolve, reject) => {
                            opts.signal.addEventListener("abort", () => reject(new Error("The operation was aborted")));
                        })
                );
                const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);

                handleNativeSshSettings(fakeContext);
                // SSH_TIMEOUT is 60_000ms; advancing past it fires the controller.abort() callback.
                await vi.advanceTimersByTimeAsync(60_000);

                expect(abortSpy).toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalledTimes(1);
                expect(String(errorSpy.mock.calls[0][0])).toContain("Failed to download native SSH binary");
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
