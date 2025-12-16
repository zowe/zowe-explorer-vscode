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

import * as path from "path";
import * as vscode from "vscode";
import { Gui, FsAbstractUtils } from "@zowe/zowe-explorer-api";
import { DatasetFSProvider } from "./DatasetFSProvider";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { SharedContext } from "../shared/SharedContext";
import type { IZoweDatasetTreeNode } from "@zowe/zowe-explorer-api";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";

export type MoveTarget = {
    writeUri: vscode.Uri;
    displayName: string; // DSN or PDS(member) for messages
    kind: "pds" | "member" | "sequential";
    pdsName?: string;
    memberName?: string;
    dsName?: string;
};

type DatasetAttrs = Record<string, unknown>;


/**
 * DatasetMoveUtils
 * ----------------
 * Encapsulates all low-level logic required to move MVS datasets across profiles / LPARs
 *
 * This class operates purely on dataset tree nodes, URIs, and z/OSMF / FS provider APIs
 *
 * Responsibilities:
 * - Resolve destination (PDS vs member vs sequential) from URIs
 * - Ensure destination datasets exist (including allocating PDSes using source attributes)
 * - Perform recursive PDS moves by iterating members
 * - Copy data contents
 * - Delete source when appropriate
 * - Surface user-visible error messages for failures
 *
 * note:
 * Returns `boolean` for many operations instead of throwing so callers can
 * continue batch moves and present partial-success results.
 */
export class DatasetMoveUtils {
    /**
     * Converts a dataset URI path segment (after the profile portion) into a DSN-style name.
     * Example: "/profile/HLQ/TEST/DATA" -> "HLQ.TEST.DATA"
     *
     * @param uri - Target dataset URI
     * @param slashAfterProfilePos - Index of the slash that ends the profile segment in the URI path
     * @returns Dataset name in dotted DSN form
     */
    private uriToDsn(uri: vscode.Uri, slashAfterProfilePos: number): string {
        return uri.path.substring(slashAfterProfilePos + 1).replace(/\//g, ".");
    }

    /**
     * Returns the raw dataset path portion after the profile segment, preserving slashes.
     *
     * @param uri - Target dataset URI
     * @param slashAfterProfilePos - Index of the slash that ends the profile segment in the URI path
     * @returns Raw dataset path after the profile segment Example: "HLQ/TEST/PDS/MEMBER" -> "MEMBER"
     */
    private uriToRawDatasetPath(uri: vscode.Uri, slashAfterProfilePos: number): string {
        // returns the raw path after the profile segment, preserving slashes
        return uri.path.substring(slashAfterProfilePos + 1);
    }

    /**
     * Given a raw dataset path (after the profile segment), derives the PDS name portion only.
     * Example: "HLQ/TEST/PDS/MEMBER" -> "HLQ.TEST.PDS"
     *
     * @param rawPathAfterProfile - Raw dataset path after profile (may include a member segment)
     * @returns PDS name in dotted DSN form
     */
    private rawPathToPdsName(rawPathAfterProfile: string): string {
        const lastSlash = rawPathAfterProfile.lastIndexOf("/");
        const pdsRaw = lastSlash === -1 ? rawPathAfterProfile : rawPathAfterProfile.substring(0, lastSlash);
        return pdsRaw.replace(/\//g, ".");
    }

    /**
     * Returns a URI representing the parent path of the given URI.
     * Used to derive the destination PDS URI when creating or checking member destinations.
     *
     * @param uri - A dataset or member URI
     * @returns Parent URI (one path segment up)
     */
    private parentUri(uri: vscode.Uri): vscode.Uri {
        const idx = uri.path.lastIndexOf("/");
        return idx > 0 ? uri.with({ path: uri.path.substring(0, idx) }) : uri;
    }

    /**
     * Builds a normalized "move target" from a source node and destination URI.
     * This determines:
     * - what kind of object is being moved (PDS, member, or sequential)
     * - what the user-facing display name should be
     * - which URI should actually be written to for the move
     *
     * @param sourceNode - The dataset tree node being moved
     * @param destUri - Destination URI (may represent container or member path depending on caller)
     * @param destinationInfo - Parsed URI info (profile, slash positions, etc.)
     * @returns A MoveTarget containing write URI and display name details
     */
    private buildMoveTarget(
        sourceNode: IZoweDatasetTreeNode,
        destUri: vscode.Uri,
        destinationInfo: ReturnType<typeof FsAbstractUtils.getInfoForUri>
    ): MoveTarget {
        if (SharedContext.isPds(sourceNode)) {
            const destPdsName = this.uriToRawDatasetPath(destUri, destinationInfo.slashAfterProfilePos);
            return { kind: "pds", writeUri: destUri, displayName: destPdsName };
        }

        if (SharedContext.isDsMember(sourceNode)) {
            const memberLabel = sourceNode.label as string;
            const memberName = path.parse(memberLabel).name;

            const fullPathAfterProfile = this.uriToRawDatasetPath(destUri, destinationInfo.slashAfterProfilePos);
            const lastSlash = fullPathAfterProfile.lastIndexOf("/");
            const pdsName =
                lastSlash !== -1
                    ? fullPathAfterProfile.substring(0, lastSlash).replace(/\//g, ".")
                    : fullPathAfterProfile.replace(/\//g, ".");

            const displayName = `${pdsName}(${memberName})`;

            const writeUri = destUri.with({
                path: destUri.path.substring(0, destUri.path.lastIndexOf("/")) + "/" + memberLabel,
            });

            return { kind: "member", writeUri, displayName, pdsName, memberName };
        }

        const dsName = this.uriToDsn(destUri, destinationInfo.slashAfterProfilePos);
        return { kind: "sequential", writeUri: destUri, displayName: dsName, dsName };
    }

    /**
     * Reads dataset attributes for a given source dataset and transforms them into options
     * suitable for allocation on the destination host.
     *
     * Notes:
     * - Drops the dsname field from z/OSMF response
     * - Uses zos-files Copy.generateDatasetOptions to normalize options
     * - Adjusts "primary" allocation from tracks to cylinders when present
     *
     * @param sourceInfo - Parsed URI info for the source (includes profile/session data)
     * @param sourceName - Dataset name to query attributes for (must be DSN, not PDS(member))
     * @returns Allocation attributes to use when creating the destination dataset
     */
    private async getTransformedDatasetAttrs(
        sourceInfo: ReturnType<typeof FsAbstractUtils.getInfoForUri>,
        sourceName: string
    ): Promise<DatasetAttrs> {
        const sourceAttrsResp = await ZoweExplorerApiRegister.getMvsApi(sourceInfo.profile).dataSet(sourceName, {
            attributes: true,
            responseTimeout: sourceInfo.profile?.profile?.responseTimeout,
        });

        const { dsname: _ignored, ...rest } = sourceAttrsResp.apiResponse.items[0];
        const transformedAttrs = (zosfiles.Copy as any).generateDatasetOptions({}, rest);

        // tracks -> cylinders adjustment
        const TRACKS_PER_CYLINDER = 15;
        const primary = Number((transformedAttrs as any).primary);
        if (!isNaN(primary) && primary > 0) {
            (transformedAttrs as any).primary = Math.ceil(primary / TRACKS_PER_CYLINDER);
        }

        return transformedAttrs as DatasetAttrs;
    }

    /**
     * Checks whether a dataset exists on the destination host.
     * Uses the destination MVS API and interprets a successful non-empty response as "exists".
     *
     * @param destApi - Destination MVS API instance (from ZoweExplorerApiRegister.getMvsApi)
     * @param dsName - DSN to check on the destination host
     * @returns True if the dataset exists, otherwise false
     */
    private async doesRemoteDataSetExist(destApi: any, dsName: string): Promise<boolean> {
        try {
            const resp = await destApi.dataSet(dsName, { attributes: false });
            return (
                resp?.success === true &&
                (Array.isArray(resp.apiResponse) ? resp.apiResponse.length > 0 : (resp.apiResponse?.items?.length ?? 0) > 0)
            );
        } catch {
            return false;
        }
    }

    /**
     * Ensures the destination PDS exists, creating it if needed using allocation
     * attributes derived from the *source* PDS.
     *
     * Also ensures the DatasetFSProvider has a corresponding directory entry so subsequent
     * writes/creates behave consistently in the virtual file system.
     *
     * @param destApi - Destination MVS API instance
     * @param destPdsName - Destination PDS DSN (dotted form)
     * @param destPdsUri - Destination PDS URI (directory/container path)
     * @param sourceInfo - Parsed URI info for the source (used to query allocation attrs)
     * @param sourcePdsNameForAttrs - Source PDS DSN to read allocation attrs from
     * @param errorDisplayName - Friendly name to show in error messages
     * @returns True if destination PDS exists or was created successfully; false if a handled error occurred
     */
    private async ensurePdsExistsUsingSourceAttrs(
        destApi: any,
        destPdsName: string,
        destPdsUri: vscode.Uri,
        sourceInfo: ReturnType<typeof FsAbstractUtils.getInfoForUri>,
        sourcePdsNameForAttrs: string,
        errorDisplayName: string
    ): Promise<boolean> {
        if (await this.doesRemoteDataSetExist(destApi, destPdsName)) {
            if (!DatasetFSProvider.instance.exists(destPdsUri)) {
                DatasetFSProvider.instance.createDirectory(destPdsUri);
            }
            return true;
        }

        const attrs = await this.getTransformedDatasetAttrs(sourceInfo, sourcePdsNameForAttrs);

        try {
            await destApi.createDataSet(zosfiles.CreateDataSetTypeEnum.DATA_SET_BLANK, destPdsName, attrs);
        } catch (err) {
            const code = (err as any)?.errorCode?.toString?.();
            if ((code === "404" || code === "500") && err instanceof Error) {
                Gui.errorMessage(vscode.l10n.t("Failed to move {0}: {1}", errorDisplayName, err.message));
                return false;
            }
            throw err;
        }

        DatasetFSProvider.instance.createDirectory(destPdsUri);
        return true;
    }

    /**
     * Ensures that the destination container/object needed for the move exists before writing.
     * Handles the three move target types:
     * - PDS: ensure the PDS exists using source attributes
     * - Member: ensure destination PDS exists, then ensure the member exists
     * - Sequential: create the destination dataset if it does not exist
     *
     * @param target - Computed move target descriptor (kind, display name, write URI, etc.)
     * @param sourceUri - URI of the source object being moved
     * @param sourceInfo - Parsed URI info for the source
     * @param destinationInfo - Parsed URI info for the destination
     * @param destUri - Destination URI (container/member path depending on target)
     * @returns True if destination exists or was created successfully; false if a handled error occurred
     */
    private async ensureDestinationExists(
        target: MoveTarget,
        sourceUri: vscode.Uri,
        sourceInfo: ReturnType<typeof FsAbstractUtils.getInfoForUri>,
        destinationInfo: ReturnType<typeof FsAbstractUtils.getInfoForUri>,
        destUri: vscode.Uri
    ): Promise<boolean> {
        const destApi = ZoweExplorerApiRegister.getMvsApi(destinationInfo.profile);

        if (target.kind === "pds") {
            // always derive PDS name from raw path (safe even if uri contains a member segment)
            const sourceRawAfterProfile = this.uriToRawDatasetPath(sourceUri, sourceInfo.slashAfterProfilePos);
            const sourcePdsNameForAttrs = this.rawPathToPdsName(sourceRawAfterProfile);

            return this.ensurePdsExistsUsingSourceAttrs(
                destApi,
                target.displayName,
                destUri,
                sourceInfo,
                sourcePdsNameForAttrs,
                target.displayName
            );
        }

        if (target.kind === "member") {
            // attrs must come from the SOURCE PDS
            const sourceRawAfterProfile = this.uriToRawDatasetPath(sourceUri, sourceInfo.slashAfterProfilePos);
            const sourcePdsNameForAttrs = this.rawPathToPdsName(sourceRawAfterProfile);

            const destPdsUri = this.parentUri(destUri);

            const ok = await this.ensurePdsExistsUsingSourceAttrs(
                destApi,
                target.pdsName!,
                destPdsUri,
                sourceInfo,
                sourcePdsNameForAttrs,
                target.displayName
            );
            if (!ok) return false;

            try {
                await destApi.createDataSetMember(target.displayName, {});
            } catch (err) {
                const code = (err as any)?.errorCode?.toString?.();
                if ((code === "404" || code === "500") && err instanceof Error) {
                    Gui.errorMessage(
                        vscode.l10n.t(
                            "Failed to move {0}: The target PDS does not exist on the host: {1}",
                            target.displayName,
                            err.message
                        )
                    );
                    return false;
                }
                throw err;
            }

            return true;
        }

        // sequential
        try {
            const entry = await DatasetFSProvider.instance.fetchDatasetAtUri(destUri);
            if (entry == null) {
                await destApi.createDataSet(zosfiles.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, target.dsName!, {});
            }
            return true;
        } catch (err) {
            const code = (err as any)?.errorCode?.toString?.();
            if ((code === "404" || code === "500") && err instanceof Error) {
                Gui.errorMessage(vscode.l10n.t("Failed to move {0}: {1}", target.displayName, err.message));
                return false;
            }
            throw err;
        }
    }

    /**
     * Writes file contents to the destination URI, preserving the source node's encoding behavior.
     * Uses query parameters to force upload and to select the correct encoding (binary or codepage).
     *
     * @param sourceNode - Source node providing encoding metadata (binary vs text/codepage)
     * @param writeUri - The URI to write to (already resolved to correct destination path)
     * @param contents - Bytes read from the source URI
     */
    private async writeWithEncodingQuery(sourceNode: IZoweDatasetTreeNode, writeUri: vscode.Uri, contents: Uint8Array): Promise<void> {
        const encodingInfo = await sourceNode.getEncoding();
        const queryString =
            `forceUpload=true` +
            (encodingInfo?.kind === "binary"
                ? "&encoding=binary"
                : encodingInfo?.kind === "other"
                    ? "&encoding=" + encodingInfo.codepage
                    : "");

        await DatasetFSProvider.instance.writeFile(writeUri.with({ query: queryString }), contents, {
            create: true,
            overwrite: true,
        });
    }

    /**
     * Deletes the source object after a successful move when appropriate.
     * For recursive PDS moves, children are deleted as part of the top-level recursive delete,
     * so only delete at the outermost call.
     *
     * @param sourceUri - Source URI to delete
     * @param recursiveCall - True when invoked as part of a recursive PDS move
     */
    private async deleteSourceAfterMove(sourceUri: vscode.Uri, recursiveCall: boolean): Promise<void> {
        if (!recursiveCall) {
            await vscode.workspace.fs.delete(sourceUri, { recursive: false });
        }
    }

    /**
     * Performs a cross-profile / cross-LPAR move from a source dataset tree node to a destination URI.
     * Handles:
     * - PDS moves by recursively moving members, then deleting the source PDS
     * - Member and sequential moves by ensuring destination exists, copying contents, and deleting source
     *
     * Returns a boolean instead of throwing for many failures so the caller can continue
     * moving other items and present aggregated results to the user.
     *
     * @param sourceNode - Source dataset tree node being moved (PDS, member, or sequential)
     * @param sourceUri - Source URI (used for reads and delete)
     * @param destUri - Destination URI (container/member path depending on move)
     * @param recursiveCall - True when invoked from a recursive PDS move (suppresses per-child deletes)
     * @returns True if the move succeeded; false if a handled error occurred
     */
    public async crossLparMove(
        sourceNode: IZoweDatasetTreeNode,
        sourceUri: vscode.Uri,
        destUri: vscode.Uri,
        recursiveCall: boolean
    ): Promise<boolean> {
        const destinationInfo = FsAbstractUtils.getInfoForUri(destUri, Profiles.getInstance());
        const sourceInfo = FsAbstractUtils.getInfoForUri(sourceUri, Profiles.getInstance());

        try {
            if (SharedContext.isPds(sourceNode)) {
                const target = this.buildMoveTarget(sourceNode, destUri, destinationInfo);

                const ok = await this.ensureDestinationExists(target, sourceNode, sourceUri, sourceInfo, destinationInfo, destUri);
                if (!ok) return false;

                const children = await sourceNode.getChildren();
                for (const child of children) {
                    const label = child.label as string;

                    const childSourceUri = sourceUri.with({ path: path.posix.join(sourceUri.path, label) });
                    const childDestUri = destUri.with({ path: path.posix.join(destUri.path, label) });

                    const childOk = await this.crossLparMove(child, childSourceUri, childDestUri, true);
                    if (!childOk) return false;
                }

                await vscode.workspace.fs.delete(sourceUri, { recursive: true });
                return true;
            }

            const target = this.buildMoveTarget(sourceNode, destUri, destinationInfo);

            const ok = await this.ensureDestinationExists(target, sourceNode, sourceUri, sourceInfo, destinationInfo, destUri);
            if (!ok) return false;

            const contents = await DatasetFSProvider.instance.readFile(sourceUri);

            try {
                await this.writeWithEncodingQuery(sourceNode, target.writeUri, contents);
                await this.deleteSourceAfterMove(sourceUri, recursiveCall);
                return true;
            } catch (err) {
                if (err instanceof Error) {
                    Gui.errorMessage(vscode.l10n.t("Failed to move {0}: {1}", target.displayName, err.message));
                }
                return false;
            }
        } catch (err) {
            if (err instanceof Error) {
                Gui.errorMessage(vscode.l10n.t("Failed to move: {0}", err.message));
            }
            return false;
        }
    }
}
