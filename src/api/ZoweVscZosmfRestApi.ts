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

import * as zowe from "@brightside/core";
import * as imperative from "@brightside/imperative";

import { IZoweVscUssApi } from "./IZoweVscRestApis";

export class ZoweVscZosmfUssRestApi implements IZoweVscUssApi {

    public getProfileTypeName(): string {
        return "zosmf";
    }
    public createSession(profile: imperative.IProfile): imperative.Session {
        return zowe.ZosmfSession.createBasicZosmfSession(profile);
    }

    public async fileList(session: imperative.Session, path: string): Promise<zowe.IZosFilesResponse> {
        return zowe.List.fileList(session, path);
    }

    public async create(session: imperative.Session, ussPath: string, type: string, mode?: string): Promise<string> {
        return zowe.Create.uss(session, ussPath, type);
    }
}
