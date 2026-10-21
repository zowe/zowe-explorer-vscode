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

/**
 * Helpers that change resources on the test system *without* going through Zowe Explorer.
 *
 * The file change events under test are only interesting for changes the extension did not make
 * itself, so these talk to z/OSMF directly rather than through the file system provider (as
 * `datasetUtils.writeDsContent` does) - otherwise the provider would already know about the change.
 */

import { AbstractSession, ProfileInfo } from "@zowe/imperative";
import { Delete, Upload } from "@zowe/zos-files-for-zowe-sdk";

let sessionPromise: Promise<AbstractSession> | undefined;

/**
 * Builds a session from the same Zowe config the extension under test is using, since `wdio.conf.ts`
 * points `ZOWE_CLI_HOME` at `ZOWE_TEST_DIR`. Cached, as every call would otherwise re-read the config.
 */
function sessionForTestProfile(): Promise<AbstractSession> {
    sessionPromise ??= (async (): Promise<AbstractSession> => {
        const profileName = process.env.ZE_TEST_PROFILE_NAME;
        const profInfo = new ProfileInfo("zowe");
        await profInfo.readProfilesFromDisk();

        const profAttrs = profInfo.getAllProfiles("zosmf").find((prof) => prof.profName === profileName);
        if (profAttrs == null) {
            throw new Error(`Could not find a "zosmf" profile named "${profileName}" in the Zowe config used by the e2e tests.`);
        }

        return ProfileInfo.createSession(profInfo.mergeArgsForProfile(profAttrs, { getSecureVals: true }).knownArgs);
    })();

    return sessionPromise;
}

/**
 * Creates an empty PDS member on the test system, bypassing Zowe Explorer.
 *
 * @param pdsName The PDS to create the member in
 * @param memberName The member to create
 */
export async function createPdsMemberOutsideZowe(pdsName: string, memberName: string): Promise<void> {
    await Upload.bufferToDataSet(await sessionForTestProfile(), Buffer.from(""), `${pdsName}(${memberName})`);
}

/**
 * Deletes a PDS member from the test system, bypassing Zowe Explorer. Never throws, so it is safe to
 * call from cleanup hooks where the member may already be gone.
 *
 * @param pdsName The PDS holding the member
 * @param memberName The member to delete
 */
export async function deletePdsMemberOutsideZowe(pdsName: string, memberName: string): Promise<void> {
    try {
        await Delete.dataSet(await sessionForTestProfile(), `${pdsName}(${memberName})`);
    } catch {
        // Nothing to clean up.
    }
}

/**
 * @returns A member name that is unique to this run, so leftovers from an earlier run cannot mask a failure
 */
export function uniqueMemberName(): string {
    return `M${Date.now().toString(36).slice(-7).toUpperCase()}`;
}

/**
 * Creates an empty USS file on the test system, bypassing Zowe Explorer.
 *
 * @param ussPath Absolute USS path of the file to create
 */
export async function createUssFileOutsideZowe(ussPath: string): Promise<void> {
    await Upload.bufferToUssFile(await sessionForTestProfile(), ussPath, Buffer.from(""));
}

/**
 * Deletes a USS file from the test system, bypassing Zowe Explorer. Never throws, so it is safe to
 * call from cleanup hooks where the file may already be gone.
 *
 * @param ussPath Absolute USS path of the file to delete
 */
export async function deleteUssFileOutsideZowe(ussPath: string): Promise<void> {
    try {
        await Delete.ussFile(await sessionForTestProfile(), ussPath);
    } catch {
        // Nothing to clean up.
    }
}

/**
 * @returns A USS file name that is unique to this run, so leftovers from an earlier run cannot mask a failure
 */
export function uniqueUssFileName(): string {
    return `ze-e2e-${Date.now().toString(36)}.txt`;
}
