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

import { execFileSync } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { SessionContext, ZSshUtils } from "@zowe/zowex-for-zowe-sdk";
import { RECEIVE_SCRIPT, SshOnlyDeployment } from "../src/SshOnlyDeployment";

vi.mock("@zowe/zowex-for-zowe-sdk", () => {
    class SessionContext {
        public constructor(public readonly session: any) {}
        public getSsh = vi.fn();
        public [Symbol.dispose] = vi.fn();
    }
    return {
        SessionContext,
        ZSshClient: { BIN_NAME: "zo", REQUIRED_DEPLOY_SIZE_MB: 20 },
        ZSshUtils: { quotePath: (p: string) => p, pathExists: vi.fn(), getAvailableMb: vi.fn() },
    };
});

/** Fake ssh2 exec channel that records stdin and closes with the given exit code once stdin ends. */
function fakeConnection(exitCodes: number[]) {
    const calls: { command: string; stdin: string }[] = [];
    const connection = {
        exec: vi.fn((command: string, cb: (err: Error | undefined, stream: any) => void) => {
            const stream: any = new EventEmitter();
            stream.stderr = new EventEmitter();
            const call = { command, stdin: "" };
            calls.push(call);
            stream.write = (data: string, writeCb?: () => void) => {
                call.stdin += data;
                setImmediate(() => writeCb?.());
                return true;
            };
            stream.end = () =>
                setImmediate(() => {
                    // Simulate the receive script's progress reports on stderr, split mid-line to test buffering
                    if (command.startsWith("sh ")) {
                        stream.stderr.emit("data", Buffer.from("PROGRESS 50000\nPROGR"));
                        stream.stderr.emit("data", Buffer.from("ESS 100000\nreal error text\n"));
                    }
                    stream.emit("close", exitCodes.shift() ?? 0);
                });
            cb(undefined, stream);
        }),
    };
    return { connection, calls };
}

describe("SshOnlyDeployment", () => {
    const pax = Buffer.from(Array.from({ length: 100_000 }, (_, i) => i % 256));
    let ssh: any;
    let execCalls: ReturnType<typeof fakeConnection>["calls"];
    let context: SessionContext;

    beforeEach(() => {
        const fake = fakeConnection([0, 0]);
        execCalls = fake.calls;
        ssh = { connection: fake.connection, execCommand: vi.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" }) };
        context = new SessionContext({} as any);
        vi.mocked(context.getSsh).mockResolvedValue(ssh);
        vi.mocked(ZSshUtils.pathExists).mockResolvedValue({ exists: false, stderr: "" });
        vi.mocked(ZSshUtils.getAvailableMb).mockResolvedValue({ mb: 500, stderr: "" });
        vi.spyOn(vscode.workspace.fs, "readFile").mockResolvedValue(pax);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should mkdir, send the script and base64 PAX over stdin, extract, clean up, and verify", async () => {
        const onProgress = vi.fn();
        const onStatus = vi.fn();
        const result = await SshOnlyDeployment.install(context, "~/.zowe-server", "/local/server.pax.Z", { onProgress, onStatus });

        expect(result).toBe(true);
        const commands = ssh.execCommand.mock.calls.map((c: any[]) => c[0]);
        expect(commands[0]).toBe("mkdir -p ./.zowe-server");
        expect(commands).toContain("pax -rzf server.pax.Z");
        expect(commands).toContain("rm -f .zowe-server/server.pax.Z .zowe-server/.zowe-receive-pax.sh");
        expect(commands[commands.length - 1]).toBe("./zo --version");

        expect(execCalls[0].command).toContain("cat > .zowe-server/.zowe-receive-pax.sh");
        expect(execCalls[0].stdin).toBe(RECEIVE_SCRIPT);
        expect(execCalls[1].command).toBe(`sh .zowe-server/.zowe-receive-pax.sh .zowe-server/server.pax.Z ${pax.length}`);
        expect(Buffer.from(execCalls[1].stdin, "base64").equals(pax)).toBe(true);
        expect(onProgress.mock.calls.reduce((sum, c) => sum + c[0], 0)).toBe(100);
        expect(onStatus).toHaveBeenCalledWith(expect.stringContaining("Uploading"));
        expect(onStatus).toHaveBeenCalledWith(expect.stringContaining("Extracting"));
    });

    it("should stop and clean up when the upload exits non-zero", async () => {
        const fake = fakeConnection([0, 65]);
        ssh.connection = fake.connection;
        const onError = vi.fn().mockResolvedValue(false);

        const result = await SshOnlyDeployment.install(context, "/srv/zowe", "/local/server.pax.Z", { onError });

        expect(result).toBe(false);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "EDEPLOYFAIL" }), "upload");
        const commands = ssh.execCommand.mock.calls.map((c: any[]) => c[0]);
        expect(commands).not.toContain("pax -rzf server.pax.Z");
    });

    it("should not upload when the user declines the low disk space warning", async () => {
        vi.mocked(ZSshUtils.getAvailableMb).mockResolvedValue({ mb: 1, stderr: "" });
        const result = await SshOnlyDeployment.install(context, "/srv/zowe", "/local/server.pax.Z", {
            onInsufficientSpaceWarning: vi.fn().mockResolvedValue(false),
        });

        expect(result).toBe(false);
        expect(ssh.connection.exec).not.toHaveBeenCalled();
    });

    it("should report extraction failure and remove partial files", async () => {
        ssh.execCommand.mockImplementation(async (cmd: string) => ({ code: cmd.startsWith("pax") ? 1 : 0, stdout: "", stderr: "bad archive" }));
        const onError = vi.fn().mockResolvedValue(false);

        const result = await SshOnlyDeployment.install(context, "/srv/zowe", "/local/server.pax.Z", { onError });

        expect(result).toBe(false);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "EDEPLOYFAIL" }), "extract");
        const commands = ssh.execCommand.mock.calls.map((c: any[]) => c[0]);
        expect(commands).toContain("rm -f /srv/zowe/zo");
        expect(commands).toContain("rmdir /srv/zowe");
    });

    it("should avoid EBCDIC code-page-variant characters in the receive script", () => {
        expect(RECEIVE_SCRIPT).not.toMatch(/[[\]^]/);
    });

    // Runs the real script with the host's sh/awk; ASCII hosts only exercise the decoding logic, not EBCDIC conversion
    describe.skipIf(process.platform === "win32")("RECEIVE_SCRIPT decoding", () => {
        let tmp: string;
        beforeEach(() => {
            tmp = fs.mkdtempSync(path.join(os.tmpdir(), "receive-pax-"));
        });
        afterEach(() => {
            fs.rmSync(tmp, { recursive: true, force: true });
        });

        it.each([0, 1, 2, 3, 4, 100, 100_000])("should decode %d bytes of binary data (including NULs and high bytes)", (size) => {
            const data = Buffer.from(Array.from({ length: size }, (_, i) => (i * 7 + (i >> 8)) % 256));
            const script = path.join(tmp, "receive.sh");
            const dest = path.join(tmp, "out.bin");
            fs.writeFileSync(script, RECEIVE_SCRIPT);
            const b64 = data.toString("base64").replace(/.{1,76}/g, "$&\n");

            execFileSync("sh", [script, dest, String(size)], { input: b64 });

            expect(fs.readFileSync(dest).equals(data)).toBe(true);
        });

        it("should exit with the size mismatch code when the decoded size differs", () => {
            const script = path.join(tmp, "receive.sh");
            fs.writeFileSync(script, RECEIVE_SCRIPT);
            expect(() => execFileSync("sh", [script, path.join(tmp, "out.bin"), "99"], { input: "AAAA\n", stdio: "pipe" })).toThrow(
                expect.objectContaining({ status: 65 })
            );
        });
    });
});
