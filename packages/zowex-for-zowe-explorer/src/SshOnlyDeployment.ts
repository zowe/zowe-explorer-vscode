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
import { promptInsufficientSpace } from "./ServerDeployment";
import { SshErrorHandler } from "./SshErrorHandler";

type NodeSSH = Awaited<ReturnType<SessionContext["getSsh"]>>;

const SERVER_PAX_FILE = "server.pax.Z";
const RECEIVE_SCRIPT_FILE = ".zowe-receive-pax.sh";
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
 * Script installed on z/OS to receive the PAX over a plain SSH exec channel.
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
async function execWithStdin(ssh: NodeSSH, command: string, input: Iterable<string>, onStderrLine?: (line: string) => boolean): Promise<ExecResult> {
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

function* base64Chunks(data: Uint8Array): Generator<string> {
    for (let offset = 0; offset < data.length; offset += RAW_CHUNK_BYTES) {
        yield Buffer.from(data.subarray(offset, offset + RAW_CHUNK_BYTES))
            .toString("base64")
            .replace(new RegExp(`.{1,${BASE64_LINE_WIDTH}}`, "g"), "$&\n");
    }
}

export interface ISshOnlyCallbacks extends ISshCallbacks {
    /** Reports a short human-readable description of the current step (and upload percentage). */
    onStatus?: (message: string) => void;
}

export class SshOnlyDeployment {
    /**
     * Deploy the server PAX using only SSH exec channels (no SFTP, no SCP).
     * Mirrors ZSshUtils.installServer: mkdir -p, space check, upload, `pax -rzf`, cleanup, verify.
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
        const tempFiles = `${ZSshUtils.quotePath(remotePax)} ${ZSshUtils.quotePath(remoteScript)}`;
        const dirExistedBefore = (await ZSshUtils.pathExists(ssh, remoteDir)).exists;
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

            const available = await ZSshUtils.getAvailableMb(ssh, remoteDir);
            if (
                available.mb < ZSshClient.REQUIRED_DEPLOY_SIZE_MB &&
                !((await callbacks.onInsufficientSpaceWarning?.(available.mb, ZSshClient.REQUIRED_DEPLOY_SIZE_MB)) ?? true)
            ) {
                logger.info(`[SshOnlyDeployment] User declined to deploy to '${remoteDir}' due to lack of available space`);
                return false;
            }

            logger.info(`[SshOnlyDeployment] Step 2/6: Installing receive script ${remoteScript}`);
            const scriptInstall = await execWithStdin(ssh, `cat > ${ZSshUtils.quotePath(remoteScript)}`, [RECEIVE_SCRIPT]);
            if (scriptInstall.code !== 0) {
                return fail(
                    "Failed to create the upload helper script on the remote system.",
                    `cat > ${remoteScript} RC=${scriptInstall.code}: ${scriptInstall.stderr}`,
                    "upload"
                );
            }
            callbacks.onStatus?.(vscode.l10n.t("Uploading server..."));
            logger.info(`[SshOnlyDeployment] Step 3/6: Uploading ${SERVER_PAX_FILE} as base64 to ${remotePax}`);
            const pax = await vscode.workspace.fs.readFile(vscode.Uri.file(localPaxPath));
            let lastPercent = 0;
            const onRemoteProgress = (line: string): boolean => {
                if (!line.startsWith(PROGRESS_PREFIX)) {
                    return false;
                }
                const percent = Math.min(PERCENT, Math.floor((Number(line.slice(PROGRESS_PREFIX.length)) / pax.length) * PERCENT));
                if (percent > lastPercent) {
                    callbacks.onProgress?.(percent - lastPercent);
                    callbacks.onStatus?.(vscode.l10n.t({ message: "Uploading server... {0}%", args: [percent], comment: ["Upload percentage"] }));
                    lastPercent = percent;
                }
                return true;
            };
            const upload = await execWithStdin(
                ssh,
                `sh ${ZSshUtils.quotePath(remoteScript)} ${ZSshUtils.quotePath(remotePax)} ${pax.length}`,
                base64Chunks(pax),
                onRemoteProgress
            );
            if (upload.code !== 0) {
                return fail(
                    "Failed to upload the server binary to the remote system.",
                    `Upload ${SERVER_PAX_FILE} RC=${upload.code}: ${upload.stderr}`,
                    "upload"
                );
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
                if (!dirExistedBefore) {
                    await ssh.execCommand(`rmdir ${quotedDir}`);
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
                onInsufficientSpaceWarning: (remaining, recommended) => promptInsufficientSpace(serverPath, remaining, recommended),
            })
    );
}
