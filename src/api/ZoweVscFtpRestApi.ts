/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

import * as ftp from "@brightside/core";  // import the ftp plugin REST API instead
import * as imperative from "@brightside/imperative";

import { IZoweVscUssApi } from "./IZoweVscRestApis";

export class ZoweVscFtpUssRestApi implements IZoweVscUssApi {

    public getProfileTypeName(): string {
        return "zftp";
    }

    public createSession(profile: imperative.IProfile): imperative.Session {
        // ftp.FtpSession.createBasicFtpSession(profile);
        // do the mapping and return
        return undefined;
    }

    public async fileList(session: imperative.Session, path: string): Promise<ftp.IZosFilesResponse>{
        return ftp.List.fileList(session, path);
    }

    public async create(session: imperative.Session, ussPath: string, type: string, mode?: string): Promise<string> {
        return undefined;
    }
}
