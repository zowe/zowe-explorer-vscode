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

import { imperative, IZoweLogger, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { join as joinPath } from "path";
import { FtpSession } from "./ftpSession";

export const LOGGER = new IZoweLogger("Zowe Explorer FTP Extension", ZoweVsCodeExtension.customLoggingPath ?? joinPath(__dirname, "..", ".."));
export const SESSION_MAP = new Map<imperative.IProfileLoaded, FtpSession>();
