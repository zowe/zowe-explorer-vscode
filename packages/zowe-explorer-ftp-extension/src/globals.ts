import { IZoweLogger, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { join as joinPath } from "path";
import { imperative } from "@zowe/cli";
import { FtpSession } from "./ftpSession";

export const LOGGER = new IZoweLogger("Zowe Explorer FTP Extension", ZoweVsCodeExtension.customLoggingPath ?? joinPath(__dirname, "..", ".."));
export const SESSION_MAP = new Map<imperative.IProfileLoaded, FtpSession>();
