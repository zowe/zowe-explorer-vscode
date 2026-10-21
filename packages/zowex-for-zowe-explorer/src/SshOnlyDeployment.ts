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

import { Gui, imperative, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import { type ISshCallbacks, type SessionContext, ZSshClient, ZSshUtils } from "@zowe/zowex-for-zowe-sdk";
import * as path from "path";
import * as vscode from "vscode";
import { SshErrorHandler } from "./SshErrorHandler";

type NodeSSH = Awaited<ReturnType<SessionContext["getSsh"]>>;

const SERVER_PAX_FILE = "server.pax.Z";
const RECEIVE_SCRIPT_FILE = ".zowe-receive-pax.sh";
const PROBE_FILE = ".zowe-deploy-probe.bin";
/** EBCDIC code pages the exec-channel conversion may use; tried in order when undoing it for raw uploads. */
const ICONV_CODESETS = [
    "IBM-1047",
    "IBM-037",
    "IBM-1140",
    "IBM-500",
    "IBM-273",
    "IBM-277",
    "IBM-278",
    "IBM-280",
    "IBM-284",
    "IBM-285",
    "IBM-297",
    "IBM-871",
];
const BYTE_VALUES = 256;
const CR = 0x0d;
const LF = 0x0a;
/** Every byte value plus CR/LF runs, so a probe catches any transport that drops, merges or remaps bytes. */
export const PROBE_DATA = Buffer.from([
    ...Array(BYTE_VALUES).keys(),
    ...[CR, LF, LF, CR, CR, LF],
    ...Array.from({ length: BYTE_VALUES }, (_, i) => BYTE_VALUES - 1 - i),
]);
const BYTES_PER_KIB = 1024;
/** Raw bytes encoded per write to the SSH channel (must be a multiple of 3 so chunks concatenate to valid base64). */
const RAW_CHUNK_BYTES = 48 * BYTES_PER_KIB;
const PERCENT = 100;
const PROGRESS_PREFIX = "PROGRESS ";
const SIZE_MISMATCH_RC = 65;
/** Bytes per generated printf command; keeps each command line well under any shell arg limit. */
const PRINTF_BYTES_PER_LINE = 2048;
const BASE64_LINE_WIDTH = 76;

/**
 * Script installed on z/OS to receive the PAX over a plain SSH exec channel. This is the last-resort upload
 * method: it needs only sh, awk and wc, but decodes about 40x slower than `uudecode` or raw bytes plus `iconv`,
 * which are tried first (see {@link SshOnlyDeployment.install}).
 *
 * The z/OS SSH daemon converts exec-channel data between ASCII and EBCDIC, so raw bytes cannot be
 * piped through. Base64 survives the conversion, so the client sends base64 text and this script
 * decodes it with no external tools (z/OS USS does not ship `base64` or `openssl`): awk turns each
 * group of 4 characters into 3 bytes and emits `printf "\ooo..."` commands, and `sh` runs those to
 * write the raw bytes (awk itself cannot reliably emit NUL bytes). The decoded size is then checked.
 *
 * The base64 alphabet inside the script is converted by the same channel as the data, so awk matches
 * characters in whatever EBCDIC code page the session uses. No iconv or hard-coded code page needed.
 * The script avoids characters that differ between EBCDIC code pages (square brackets, the caret),
 * hence `test` instead of `[ ]` and string lookups (substr/index) instead of awk arrays.
 * Roughly every 64 KB written, it reports `PROGRESS <decoded bytes>` on stderr; this is the only accurate
 * progress signal, because local buffers (SSH window, sshd, pipes) swallow the first ~1.5 MB instantly.
 * Non-alphabet characters, including whatever line ends the channel produces, are ignored.
 */
export const RECEIVE_SCRIPT = [
    "#!/bin/sh",
    "# usage: receive-pax.sh <destination file> <expected decoded size in bytes>",
    'dest="$1"',
    'expected="$2"',
    "awk '",
    "BEGIN {",
    '  alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"',
    '  for (i = 0; i < 256; i++) octs = octs sprintf("%03o", i)',
    '  bs = "\\\\"',
    "}",
    "function flush() {",
    "  if (cnt > 0) {",
    '    print "printf \\"" out "\\""',
    "    decoded += cnt",
    '    out = ""',
    "    cnt = 0",
    '    if (++flushes % 32 == 0) print "echo PROGRESS " decoded " >&2"',
    "  }",
    "}",
    "function put(b) {",
    "  out = out bs substr(octs, b * 3 + 1, 3)",
    `  if (++cnt == ${PRINTF_BYTES_PER_LINE}) flush()`,
    "}",
    "{",
    "  for (k = 1; k <= length($0); k++) {",
    "    v = index(alpha, substr($0, k, 1)) - 1",
    "    if (v < 0) continue",
    "    acc = acc * 64 + v",
    "    if (++n == 4) {",
    "      put(int(acc / 65536))",
    "      put(int(acc / 256) % 256)",
    "      put(acc % 256)",
    "      acc = 0",
    "      n = 0",
    "    }",
    "  }",
    "}",
    "END {",
    "  if (n == 3) {",
    "    acc = acc * 64",
    "    put(int(acc / 65536))",
    "    put(int(acc / 256) % 256)",
    "  } else if (n == 2) {",
    "    acc = acc * 4096",
    "    put(int(acc / 65536))",
    "  }",
    "  flush()",
    "}",
    '\' | sh > "$dest" || exit $?',
    'actual=`wc -c < "$dest"`',
    "if test $actual -ne $expected; then",
    '  echo "Size mismatch: expected $expected bytes, got $actual" >&2',
    `  exit ${SIZE_MISMATCH_RC}`,
    "fi",
    "",
].join("\n");

interface ExecResult {
    code: number | null;
    stdout: string;
    stderr: string;
}

/**
 * Run a command on the remote system, feeding it the strings produced by `input` on stdin.
 * Honors channel backpressure so a large upload does not buffer entirely in memory.
 */
async function execWithStdin(
    ssh: NodeSSH,
    command: string,
    input: Iterable<string | Uint8Array>,
    onStderrLine?: (line: string) => boolean
): Promise<ExecResult> {
    const connection = ssh.connection;
    if (connection == null) {
        throw new Error("SSH connection is not established");
    }
    return new Promise<ExecResult>((resolve, reject) => {
        connection.exec(command, (err, stream) => {
            if (err) {
                reject(err);
                return;
            }
            const result: ExecResult = { code: null, stdout: "", stderr: "" };
            stream.on("data", (data: Buffer) => (result.stdout += data.toString()));
            let partialLine = "";
            stream.stderr.on("data", (data: Buffer) => {
                const lines = (partialLine + data.toString()).split("\n");
                partialLine = lines.pop() ?? "";
                for (const line of lines) {
                    // Lines claimed by the callback (progress reports) are not part of the error output
                    if (!onStderrLine?.(line)) {
                        result.stderr += `${line}\n`;
                    }
                }
            });
            stream.on("error", reject);
            stream.on("close", (code: number | null) => {
                result.stderr += partialLine;
                result.code = code;
                resolve(result);
            });
            void (async (): Promise<void> => {
                try {
                    for (const piece of input) {
                        // Wait for each write to be flushed (not just buffered) so backpressure and progress track the real transfer
                        await new Promise<void>((flushed, failed) =>
                            stream.write(piece, (writeErr?: Error | null) => (writeErr ? failed(writeErr) : flushed()))
                        );
                    }
                    stream.end();
                } catch (writeErr) {
                    reject(writeErr);
                }
            })();
        });
    });
}

/** Base64 in 76-column lines; `onSent` receives the raw bytes covered once each chunk has been flushed. */
function* base64Chunks(data: Uint8Array, onSent?: (rawBytes: number) => void): Generator<string> {
    for (let offset = 0; offset < data.length; offset += RAW_CHUNK_BYTES) {
        yield Buffer.from(data.subarray(offset, offset + RAW_CHUNK_BYTES))
            .toString("base64")
            .replace(new RegExp(`.{1,${BASE64_LINE_WIDTH}}`, "g"), "$&\n");
        onSent?.(Math.min(offset + RAW_CHUNK_BYTES, data.length));
    }
}

/** POSIX `uuencode -m` format; the base64 alphabet is invariant across EBCDIC code pages, unlike classic uuencode. */
function* uuencodeBase64(data: Uint8Array, name: string, onSent?: (rawBytes: number) => void): Generator<string> {
    yield `begin-base64 644 ${name}\n`;
    yield* base64Chunks(data, onSent);
    yield "====\n";
}

function* rawChunks(data: Uint8Array, onSent?: (rawBytes: number) => void): Generator<Uint8Array> {
    for (let offset = 0; offset < data.length; offset += RAW_CHUNK_BYTES) {
        yield data.subarray(offset, offset + RAW_CHUNK_BYTES);
        onSent?.(Math.min(offset + RAW_CHUNK_BYTES, data.length));
    }
}

const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;
const CRC_TOP_BYTE_SHIFT = 24;
const CRC_TOP_BIT = 0x80000000;
/** CRC-32 polynomial used by POSIX cksum */
const CKSUM_POLYNOMIAL = 0x04c11db7;
const CRC_TABLE = Uint32Array.from({ length: BYTE_VALUES }, (_, i) => {
    let c = i << CRC_TOP_BYTE_SHIFT;
    for (let bit = 0; bit < BITS_PER_BYTE; bit++) {
        c = c & CRC_TOP_BIT ? (c << 1) ^ CKSUM_POLYNOMIAL : c << 1;
    }
    return c >>> 0;
});

/** The CRC printed by POSIX `cksum`: CRC-32/CKSUM over the data followed by its length in bytes. */
export function posixCksum(data: Uint8Array): number {
    let crc = 0;
    const add = (byte: number): void => {
        crc = ((crc << BITS_PER_BYTE) ^ CRC_TABLE[((crc >>> CRC_TOP_BYTE_SHIFT) ^ byte) & BYTE_MASK]) >>> 0;
    };
    for (const byte of data) {
        add(byte);
    }
    for (let n = data.length; n > 0; n = Math.floor(n / BYTE_VALUES)) {
        add(n & BYTE_MASK);
    }
    return ~crc >>> 0;
}

function hexDigits(text: string | undefined): string {
    return (text ?? "").replace(/[^0-9a-f]/gi, "").toLowerCase();
}

/** Splits the output of `echo =name; command; echo =other; ...` into the text printed under each marker. */
export function parseSections(stdout: string): Map<string, string> {
    const sections = new Map<string, string>();
    let current: string | undefined;
    for (const line of stdout.split(/\r?\n/)) {
        if (line.startsWith("=")) {
            current = line.slice(1).trim();
            sections.set(current, "");
        } else if (current != null) {
            sections.set(current, `${sections.get(current)}${line}\n`);
        }
    }
    return sections;
}

interface RawProbeResult {
    /** Command that turns the bytes the channel delivers back into the bytes that were sent, if one was found */
    receiver?: string;
    /** Whether the remote `cksum` matches {@link posixCksum}, so it can verify uploads byte for byte */
    cksum: boolean;
}

/**
 * Sends {@link PROBE_DATA} as raw bytes and inspects what arrived. If the channel applies a one-to-one code page
 * conversion (z/OS sshd converts ISO8859-1 to EBCDIC), finds the iconv codeset that reverses it exactly.
 * Uses `cat`, `od`, `cksum` and `iconv`; any of them missing or misbehaving just means that path is not used.
 */
async function probeRaw(ssh: NodeSSH, probePath: string): Promise<RawProbeResult> {
    const quoted = ZSshUtils.quotePath(probePath);
    const sent = await execWithStdin(ssh, `cat > ${quoted}`, [PROBE_DATA]);
    if (sent.code !== 0) {
        return { cksum: false };
    }
    const script = [
        "echo =received",
        `od -An -tx1 -v ${quoted}`,
        "echo =cksum",
        `cksum ${quoted}`,
        ...ICONV_CODESETS.map((codeset) => `echo =${codeset}; iconv -f ${codeset} -t ISO8859-1 ${quoted} | od -An -tx1 -v`),
    ].join("; ");
    const sections = parseSections((await ssh.execCommand(script)).stdout);
    const received = Buffer.from(hexDigits(sections.get("received")), "hex");
    const [crc, size] = (sections.get("cksum") ?? "").trim().split(/\s+/);
    const cksum = received.length > 0 && crc === String(posixCksum(received)) && size === String(received.length);
    const expected = PROBE_DATA.toString("hex");
    if (received.toString("hex") === expected) {
        return { receiver: "cat", cksum };
    }
    const codeset = ICONV_CODESETS.find((cs) => hexDigits(sections.get(cs)) === expected);
    return { receiver: codeset ? `iconv -f ${codeset} -t ISO8859-1` : undefined, cksum };
}

/** Round-trips {@link PROBE_DATA} through `uudecode` and checks every byte came back. */
async function probeUudecode(ssh: NodeSSH, quotedDir: string, probePath: string): Promise<boolean> {
    const sent = await execWithStdin(ssh, `cd ${quotedDir} && rm -f ${PROBE_FILE} && uudecode`, uuencodeBase64(PROBE_DATA, PROBE_FILE));
    if (sent.code !== 0) {
        return false;
    }
    const read = await ssh.execCommand(`od -An -tx1 -v ${ZSshUtils.quotePath(probePath)}`);
    return read.code === 0 && hexDigits(read.stdout) === PROBE_DATA.toString("hex");
}

interface UploadMethod {
    name: string;
    /** Probes or installs what the method needs on the remote system; false skips it */
    prepare: () => Promise<boolean>;
    /** Remote command that reads the encoded PAX on stdin and writes the decoded file */
    command: () => string;
    encode: (data: Uint8Array, onSent: (rawBytes: number) => void) => Iterable<string | Uint8Array>;
    /** The remote command reports `PROGRESS <bytes>` on stderr (client-side flush progress runs ahead of it) */
    remoteProgress?: boolean;
}

export interface ISshOnlyCallbacks extends ISshCallbacks {
    /** Reports a short human-readable description of the current step (and upload percentage). */
    onStatus?: (message: string) => void;
}

export class SshOnlyDeployment {
    /**
     * Deploy the server PAX using only SSH exec channels (no SFTP, no SCP).
     * Mirrors ZSshUtils.installServer minus the optional pre-checks (existence, free space) so that everything runs
     * over the one SSH session: mkdir -p, upload, `pax -rzf`, cleanup, verify.
     * @param session Pre-established SSH session
     * @param serverPath USS directory to deploy into
     * @param localPaxPath Local path to server.pax.Z
     * @param callbacks Progress and error callbacks
     * @returns true if the deployment completed successfully
     */
    public static async install(session: SessionContext, serverPath: string, localPaxPath: string, callbacks: ISshOnlyCallbacks): Promise<boolean> {
        const logger = imperative.Logger.getAppLogger();
        const ssh = await session.getSsh();
        const remoteDir = serverPath.replace(/^~/, ".");
        const quotedDir = ZSshUtils.quotePath(remoteDir);
        const remotePax = path.posix.join(remoteDir, SERVER_PAX_FILE);
        const remoteScript = path.posix.join(remoteDir, RECEIVE_SCRIPT_FILE);
        const remoteProbe = path.posix.join(remoteDir, PROBE_FILE);
        const tempFiles = [remotePax, remoteScript, remoteProbe].map((file) => ZSshUtils.quotePath(file)).join(" ");
        let extractionStarted = false;

        // Reports a failed step; resolves to the retried install if the user asked to retry, else false
        const fail = async (msg: string, details: string, context: string): Promise<boolean> => {
            logger.error(`[SshOnlyDeployment] ${context} FAILED: ${details}`);
            const err = new imperative.ImperativeError({ msg, errorCode: "EDEPLOYFAIL", additionalDetails: details });
            return (await callbacks.onError?.(err, context)) ? SshOnlyDeployment.install(session, serverPath, localPaxPath, callbacks) : false;
        };

        try {
            callbacks.onStatus?.(vscode.l10n.t("Preparing remote directory..."));
            logger.info(`[SshOnlyDeployment] Step 1/6: Creating remote directory ${remoteDir}`);
            const mkdir = await ssh.execCommand(`mkdir -p ${quotedDir}`);
            if (mkdir.code !== 0) {
                return fail(
                    "Failed to create the server directory on the remote system.",
                    `mkdir -p ${remoteDir} RC=${mkdir.code}: ${mkdir.stderr}`,
                    "deploy"
                );
            }

            callbacks.onStatus?.(vscode.l10n.t("Uploading server..."));
            const pax = await vscode.workspace.fs.readFile(vscode.Uri.file(localPaxPath));
            let lastPercent = 0;
            const onBytesDone = (bytes: number): void => {
                const percent = Math.min(PERCENT, Math.floor((bytes / pax.length) * PERCENT));
                if (percent > lastPercent) {
                    callbacks.onProgress?.(percent - lastPercent);
                    callbacks.onStatus?.(vscode.l10n.t({ message: "Uploading server... {0}%", args: [percent], comment: ["Upload percentage"] }));
                    lastPercent = percent;
                }
            };
            const onRemoteProgress = (line: string): boolean => {
                if (!line.startsWith(PROGRESS_PREFIX)) {
                    return false;
                }
                onBytesDone(Number(line.slice(PROGRESS_PREFIX.length)));
                return true;
            };

            // Fastest first. Each method is probed with a known payload before use and the full upload is verified
            // afterwards, so a missing or misbehaving utility only costs a fallback; awk (sh, awk, wc) is last resort.
            logger.info("[SshOnlyDeployment] Step 2/6: Probing upload methods");
            let raw: RawProbeResult = { cksum: false };
            const methods: UploadMethod[] = [
                {
                    // Needs cksum: this path relies most on sshd converting the whole stream the way it converted the probe
                    name: "raw bytes",
                    prepare: async (): Promise<boolean> => {
                        raw = await probeRaw(ssh, remoteProbe);
                        return raw.receiver != null && raw.cksum;
                    },
                    command: () => `${raw.receiver} > ${ZSshUtils.quotePath(remotePax)}`,
                    encode: rawChunks,
                },
                {
                    name: "uudecode",
                    prepare: () => probeUudecode(ssh, quotedDir, remoteProbe),
                    command: () => `cd ${quotedDir} && rm -f ${SERVER_PAX_FILE} && uudecode`,
                    encode: (data, onSent) => uuencodeBase64(data, SERVER_PAX_FILE, onSent),
                },
                {
                    name: "awk",
                    prepare: async () => (await execWithStdin(ssh, `cat > ${ZSshUtils.quotePath(remoteScript)}`, [RECEIVE_SCRIPT])).code === 0,
                    command: () => `sh ${ZSshUtils.quotePath(remoteScript)} ${ZSshUtils.quotePath(remotePax)} ${pax.length}`,
                    encode: (data) => base64Chunks(data),
                    remoteProgress: true,
                },
            ];
            const verifyUpload = async (): Promise<string | undefined> => {
                if (raw.cksum) {
                    const check = await ssh.execCommand(`cksum ${ZSshUtils.quotePath(remotePax)}`);
                    const [crc, size] = check.stdout.trim().split(/\s+/);
                    const expected = `${posixCksum(pax)} ${pax.length}`;
                    return `${crc} ${size}` === expected ? undefined : `cksum mismatch: expected ${expected}, got ${crc} ${size}`;
                }
                const check = await ssh.execCommand(`wc -c < ${ZSshUtils.quotePath(remotePax)}`);
                const size = Number(check.stdout.trim());
                return size === pax.length ? undefined : `size mismatch: expected ${pax.length} bytes, got ${check.stdout.trim() || "none"}`;
            };

            const attempts: string[] = [];
            let uploaded = false;
            for (const method of methods) {
                try {
                    if (!(await method.prepare())) {
                        attempts.push(`${method.name}: not available`);
                        logger.info(`[SshOnlyDeployment] Upload method ${method.name} is not available on this system`);
                        continue;
                    }
                    logger.info(`[SshOnlyDeployment] Step 3/6: Uploading ${SERVER_PAX_FILE} to ${remotePax} using ${method.name}`);
                    const upload = await execWithStdin(
                        ssh,
                        method.command(),
                        method.encode(pax, method.remoteProgress ? (): void => undefined : onBytesDone),
                        method.remoteProgress ? onRemoteProgress : undefined
                    );
                    const problem = upload.code === 0 ? await verifyUpload() : `RC=${upload.code}: ${upload.stderr.trim()}`;
                    if (problem == null) {
                        uploaded = true;
                        break;
                    }
                    attempts.push(`${method.name}: ${problem}`);
                } catch (methodErr) {
                    attempts.push(`${method.name}: ${(methodErr as Error).message}`);
                }
                logger.warn(`[SshOnlyDeployment] Upload using ${method.name} failed, trying the next method: ${attempts[attempts.length - 1]}`);
            }
            if (!uploaded) {
                return fail("Failed to upload the server binary to the remote system.", attempts.join("\n"), "upload");
            }
            // Top the bar up to 100% since remote reports only arrive every ~64 KB
            callbacks.onProgress?.(PERCENT - lastPercent);
            callbacks.onStatus?.(vscode.l10n.t("Extracting server on host..."));
            logger.info(`[SshOnlyDeployment] Step 4/6: Extracting PAX archive in ${remoteDir}`);
            extractionStarted = true;
            const extract = await ssh.execCommand(`pax -rzf ${SERVER_PAX_FILE}`, { cwd: remoteDir });
            if (extract.code !== 0) {
                // Like the SDK, extraction failures abort (after cleanup) unless the callback says to continue
                const details = `pax -rzf RC=${extract.code}: ${extract.stderr}`;
                logger.error(`[SshOnlyDeployment] Step 4 FAILED: ${details}`);
                const paxErr = new imperative.ImperativeError({
                    msg: "Failed to extract the server archive on the remote system.",
                    errorCode: "EDEPLOYFAIL",
                    additionalDetails: details,
                });
                if (!(await callbacks.onError?.(paxErr, "extract"))) {
                    throw paxErr;
                }
            }
        } catch (deployErr) {
            logger.error(`Error was thrown during deployment: ${(deployErr as Error).message}. Attempting post-failure cleanup...`);
            try {
                await ssh.execCommand(`rm -f ${tempFiles}`);
                if (extractionStarted) {
                    await ssh.execCommand(`rm -f ${ZSshUtils.quotePath(path.posix.join(remoteDir, ZSshClient.BIN_NAME))}`);
                }
            } catch (cleanupErr) {
                logger.error(`Error was thrown during post-failure cleanup: ${(cleanupErr as Error).message}`);
            }
            return false;
        }

        logger.info(`[SshOnlyDeployment] Step 5/6: Cleaning up ${remotePax} and ${remoteScript}`);
        const cleanup = await ssh.execCommand(`rm -f ${tempFiles}`);
        if (cleanup.code !== 0) {
            logger.warn(`[SshOnlyDeployment] Step 5 WARNING: cleanup failed (non-fatal): ${cleanup.stderr}`);
        }
        callbacks.onStatus?.(vscode.l10n.t("Verifying server..."));
        logger.info("[SshOnlyDeployment] Step 6/6: Verifying the server binary runs");
        const verify = await ssh.execCommand(`./${ZSshClient.BIN_NAME} --version`, { cwd: remoteDir });
        if (verify.code !== 0) {
            const verifyErr = new imperative.ImperativeError({
                msg: "The server was installed but the server binary could not be run on the remote system.",
                errorCode: "EDEPLOYFAIL",
                additionalDetails: `./${ZSshClient.BIN_NAME} --version RC=${verify.code}: ${verify.stdout}\n${verify.stderr}`.trim(),
            });
            logger.error(`[SshOnlyDeployment] Step 6 FAILED: ${verifyErr.additionalDetails}`);
            if (!callbacks.onError) {
                throw verifyErr;
            }
            return callbacks.onError(verifyErr, "verify");
        }

        logger.info("[SshOnlyDeployment] install completed successfully");
        return true;
    }
}

export function deploySshOnlyWithProgress(session: SessionContext, serverPath: string, localPaxPath: string): Thenable<boolean> {
    return Gui.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: vscode.l10n.t("Deploying Zowe Remote SSH server..."),
        },
        async (progress) =>
            SshOnlyDeployment.install(session, serverPath, localPaxPath, {
                onProgress: (increment) => progress.report({ increment }),
                onStatus: (message) => progress.report({ message }),
                onError: SshErrorHandler.getInstance().createErrorCallback(ZoweExplorerApiType.All, "Server installation (without SFTP)"),
            })
    );
}
