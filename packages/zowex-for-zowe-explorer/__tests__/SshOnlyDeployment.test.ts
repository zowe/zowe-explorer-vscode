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
import { SessionContext } from "@zowe/zowex-for-zowe-sdk";
import { parseSections, posixCksum, PROBE_DATA, RECEIVE_SCRIPT, SshOnlyDeployment } from "../src/SshOnlyDeployment";

vi.mock("@zowe/zowex-for-zowe-sdk", () => {
    class SessionContext {
        public constructor(public readonly session: any) {}
        public getSsh = vi.fn();
        public [Symbol.dispose] = vi.fn();
    }
    return {
        SessionContext,
        ZSshClient: { BIN_NAME: "zo", REQUIRED_DEPLOY_SIZE_MB: 20 },
        ZSshUtils: { quotePath: (p: string) => p },
    };
});

/** Fake ssh2 exec channel that records stdin and closes with the exit code chosen for the command once stdin ends. */
function fakeConnection(exitCode: (command: string) => number = () => 0) {
    const calls: { command: string; chunks: Buffer[]; readonly stdin: Buffer }[] = [];
    const connection = {
        exec: vi.fn((command: string, cb: (err: Error | undefined, stream: any) => void) => {
            const stream: any = new EventEmitter();
            stream.stderr = new EventEmitter();
            const call = {
                command,
                chunks: [] as Buffer[],
                get stdin(): Buffer {
                    return Buffer.concat(this.chunks);
                },
            };
            calls.push(call);
            stream.write = (data: string | Uint8Array, writeCb?: () => void) => {
                call.chunks.push(Buffer.from(data));
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
                    stream.emit("close", exitCode(command));
                });
            cb(undefined, stream);
        }),
    };
    return { connection, calls };
}

/** Formats bytes the way `od -An -tx1 -v` prints them. */
function od(data: Buffer): string {
    return `${data
        .toString("hex")
        .replace(/(..)/g, " $1")
        .replace(/(.{48})/g, "$1\n")}\n`;
}

const ok = (stdout = "") => Promise.resolve({ code: 0, stdout, stderr: "" });

describe("SshOnlyDeployment", () => {
    const pax = Buffer.from(Array.from({ length: 100_000 }, (_, i) => i % 256));
    /** What z/OS sshd delivers for the probe: a one-to-one remapping of every byte, like ISO8859-1 to IBM-1047 */
    const converted = Buffer.from(PROBE_DATA.map((b) => b ^ 0x55));
    const paxCksum = `${posixCksum(pax)} ${pax.length} /srv/zowe/server.pax.Z`;
    let ssh: any;
    let execCalls: ReturnType<typeof fakeConnection>["calls"];
    let context: SessionContext;

    /** Responds to the raw probe's read-back script with the given sections. */
    const rawProbeOutput = (received: Buffer, cksum: string, iconv1047?: Buffer) =>
        `=received\n${od(received)}=cksum\n${cksum}\n=IBM-037\n${od(received)}` + (iconv1047 ? `=IBM-1047\n${od(iconv1047)}` : "");
    const findCall = (prefix: string) => execCalls.find((c) => c.command.startsWith(prefix));

    beforeEach(() => {
        const fake = fakeConnection();
        execCalls = fake.calls;
        // By default no probe reads anything back, so only the awk fallback is usable
        ssh = {
            connection: fake.connection,
            execCommand: vi.fn((cmd: string) => ok(cmd.startsWith("wc -c") ? `${pax.length}\n` : "")),
        };
        context = new SessionContext({} as any);
        vi.mocked(context.getSsh).mockResolvedValue(ssh);
        vi.spyOn(vscode.workspace.fs, "readFile").mockResolvedValue(pax);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should fall back to the awk script when the probes fail, then extract, clean up, and verify", async () => {
        const onProgress = vi.fn();
        const onStatus = vi.fn();
        const result = await SshOnlyDeployment.install(context, "~/.zowe-server", "/local/server.pax.Z", { onProgress, onStatus });

        expect(result).toBe(true);
        const commands = ssh.execCommand.mock.calls.map((c: any[]) => c[0]);
        expect(commands[0]).toBe("mkdir -p ./.zowe-server");
        expect(commands).toContain("pax -rzf server.pax.Z");
        expect(commands).toContain("rm -f .zowe-server/server.pax.Z .zowe-server/.zowe-receive-pax.sh .zowe-server/.zowe-deploy-probe.bin");
        expect(commands[commands.length - 1]).toBe("./zo --version");

        expect(findCall("cat > .zowe-server/.zowe-receive-pax.sh")?.stdin.toString()).toBe(RECEIVE_SCRIPT);
        const upload = findCall("sh ");
        expect(upload?.command).toBe(`sh .zowe-server/.zowe-receive-pax.sh .zowe-server/server.pax.Z ${pax.length}`);
        expect(Buffer.from(upload!.stdin.toString(), "base64").equals(pax)).toBe(true);
        expect(commands).toContain("wc -c < .zowe-server/server.pax.Z");
        expect(onProgress.mock.calls.reduce((sum, c) => sum + c[0], 0)).toBe(100);
        expect(onStatus).toHaveBeenCalledWith(expect.stringContaining("Uploading"));
        expect(onStatus).toHaveBeenCalledWith(expect.stringContaining("Extracting"));
    });

    it("should send raw bytes through the iconv codeset that undoes the channel conversion", async () => {
        ssh.execCommand.mockImplementation((cmd: string) => {
            if (cmd.startsWith("echo =received")) {
                return ok(rawProbeOutput(converted, `${posixCksum(converted)} ${converted.length} probe`, PROBE_DATA));
            }
            return ok(cmd.startsWith("cksum ") ? paxCksum : "");
        });
        const onProgress = vi.fn();

        const result = await SshOnlyDeployment.install(context, "/srv/zowe", "/local/server.pax.Z", { onProgress });

        expect(result).toBe(true);
        expect(findCall("cat > /srv/zowe/.zowe-deploy-probe.bin")?.stdin.equals(PROBE_DATA)).toBe(true);
        const upload = findCall("iconv ");
        expect(upload?.command).toBe("iconv -f IBM-1047 -t ISO8859-1 > /srv/zowe/server.pax.Z");
        expect(upload?.stdin.equals(pax)).toBe(true);
        expect(findCall("cd /srv/zowe && rm -f .zowe-deploy-probe.bin && uudecode")).toBeUndefined();
        expect(findCall("sh ")).toBeUndefined();
        expect(onProgress.mock.calls.reduce((sum, c) => sum + c[0], 0)).toBe(100);
    });

    it("should fall back to uudecode when the raw upload fails verification", async () => {
        let paxChecks = 0;
        ssh.execCommand.mockImplementation((cmd: string) => {
            if (cmd.startsWith("echo =received")) {
                return ok(rawProbeOutput(converted, `${posixCksum(converted)} ${converted.length} probe`, PROBE_DATA));
            }
            if (cmd.startsWith("od -An -tx1 -v /srv/zowe/.zowe-deploy-probe.bin")) {
                return ok(od(PROBE_DATA));
            }
            if (cmd.startsWith("cksum ")) {
                return ok(++paxChecks === 1 ? `1 ${pax.length} f` : paxCksum);
            }
            return ok();
        });

        const result = await SshOnlyDeployment.install(context, "/srv/zowe", "/local/server.pax.Z", {});

        expect(result).toBe(true);
        expect(findCall("iconv ")).toBeDefined();
        const upload = findCall("cd /srv/zowe && rm -f server.pax.Z && uudecode");
        const text = upload!.stdin.toString();
        expect(text.startsWith("begin-base64 644 server.pax.Z\n")).toBe(true);
        expect(text.endsWith("\n====\n")).toBe(true);
        expect(Buffer.from(text.split("\n").slice(1, -2).join(""), "base64").equals(pax)).toBe(true);
        expect(findCall("sh ")).toBeUndefined();
    });

    it("should not send raw bytes when cksum cannot verify them", async () => {
        ssh.execCommand.mockImplementation((cmd: string) => {
            if (cmd.startsWith("echo =received")) {
                return ok(rawProbeOutput(PROBE_DATA, ""));
            }
            if (cmd.startsWith("od -An -tx1 -v")) {
                return ok(od(PROBE_DATA));
            }
            return ok(cmd.startsWith("wc -c") ? `${pax.length}\n` : "");
        });

        const result = await SshOnlyDeployment.install(context, "/srv/zowe", "/local/server.pax.Z", {});

        expect(result).toBe(true);
        expect(findCall("cat > /srv/zowe/server.pax.Z")).toBeUndefined();
        expect(findCall("cd /srv/zowe && rm -f server.pax.Z && uudecode")).toBeDefined();
        expect(ssh.execCommand.mock.calls.map((c: any[]) => c[0])).toContain("wc -c < /srv/zowe/server.pax.Z");
    });

    it("should report every method's failure when no upload method works", async () => {
        const fake = fakeConnection((cmd) => (cmd.startsWith("sh ") ? 65 : 0));
        ssh.connection = fake.connection;
        const onError = vi.fn().mockResolvedValue(false);

        const result = await SshOnlyDeployment.install(context, "/srv/zowe", "/local/server.pax.Z", { onError });

        expect(result).toBe(false);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "EDEPLOYFAIL" }), "upload");
        const details: string = onError.mock.calls[0][0].additionalDetails;
        expect(details).toContain("raw bytes: not available");
        expect(details).toContain("uudecode: not available");
        expect(details).toContain("awk: RC=65");
        const commands = ssh.execCommand.mock.calls.map((c: any[]) => c[0]);
        expect(commands).not.toContain("pax -rzf server.pax.Z");
    });

    it("should report extraction failure and remove partial files", async () => {
        ssh.execCommand.mockImplementation(async (cmd: string) => ({
            code: cmd.startsWith("pax") ? 1 : 0,
            stdout: cmd.startsWith("wc -c") ? `${pax.length}\n` : "",
            stderr: "bad archive",
        }));
        const onError = vi.fn().mockResolvedValue(false);

        const result = await SshOnlyDeployment.install(context, "/srv/zowe", "/local/server.pax.Z", { onError });

        expect(result).toBe(false);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "EDEPLOYFAIL" }), "extract");
        const commands = ssh.execCommand.mock.calls.map((c: any[]) => c[0]);
        expect(commands).toContain("rm -f /srv/zowe/zo");
    });

    it("should split probe output into sections", () => {
        expect(parseSections("ignored\n=a\n 01 02\n=b\n\n=c\nx\ny\n")).toEqual(
            new Map([
                ["a", " 01 02\n"],
                ["b", "\n"],
                ["c", "x\ny\n\n"],
            ])
        );
    });

    it.skipIf(process.platform === "win32")("should compute the same CRC as the system cksum", () => {
        for (const data of [Buffer.alloc(0), Buffer.from("123456789"), PROBE_DATA, pax]) {
            const [crc, size] = execFileSync("cksum", { input: data }).toString().trim().split(/\s+/);
            expect(`${posixCksum(data)} ${data.length}`).toBe(`${crc} ${size}`);
        }
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
