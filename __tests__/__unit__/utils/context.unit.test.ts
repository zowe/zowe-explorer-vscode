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

import { TreeItem } from "vscode";
import * as context from "../../../src/utils/context";
import * as extension from "../../../src/extension";

describe.only("Context helper tests", () => {
    const INFORMATION_CONTEXT = "information";
    const FAVORITE_CONTEXT = "favorite";
    const DS_FAV_CONTEXT = "ds_fav";
    const PDS_FAV_CONTEXT = "pds_fav";
    const DS_SESSION_CONTEXT = "session";
    const DS_PDS_CONTEXT = "pds";
    const DS_DS_CONTEXT = "ds";
    const DS_MEMBER_CONTEXT = "member";
    const DS_TEXT_FILE_CONTEXT = "textFile";
    const DS_FAV_TEXT_FILE_CONTEXT = "textFile_fav";
    const DS_BINARY_FILE_CONTEXT = "binaryFile";
    const DS_FAV_BINARY_FILE_CONTEXT = "binaryFile_fav";
    const DS_MIGRATED_FILE_CONTEXT = "migr";
    const USS_SESSION_CONTEXT = "uss_session";
    const USS_DIR_CONTEXT = "directory";
    const USS_FAV_DIR_CONTEXT = "directory_fav";
    const JOBS_SESSION_CONTEXT = "server";
    const JOBS_JOB_CONTEXT = "job";
    const JOBS_SPOOL_CONTEXT = "spool";
    const ICON_STATE_OPEN = "open";
    const ICON_STATE_CLOSED = "closed";
    const JOBS_JOB_FAVORITE1 = "job_fav";
    const JOBS_JOB_FAVORITE2 = "job_fav_rc=cc 000";
    const JOBS_JOB_FAVORITE3 = "job_rc=cc 000_fav";
    const JOBS_SESSION_CONTEXT_FAV = "server_fav";
    const USS_SESSION_CONTEXT_FAV = "uss_session_fav";
    const DS_SESSION_CONTEXT_FAV = "session_fav";

    const testList: string[] = [
        INFORMATION_CONTEXT, FAVORITE_CONTEXT, DS_FAV_CONTEXT, PDS_FAV_CONTEXT, DS_SESSION_CONTEXT, DS_PDS_CONTEXT, DS_DS_CONTEXT, DS_MEMBER_CONTEXT,
        DS_TEXT_FILE_CONTEXT, DS_FAV_TEXT_FILE_CONTEXT, DS_BINARY_FILE_CONTEXT, DS_MIGRATED_FILE_CONTEXT, USS_SESSION_CONTEXT, USS_DIR_CONTEXT,
        USS_FAV_DIR_CONTEXT, JOBS_SESSION_CONTEXT, JOBS_JOB_CONTEXT, JOBS_SPOOL_CONTEXT, ICON_STATE_OPEN, ICON_STATE_CLOSED, JOBS_JOB_FAVORITE1,
        JOBS_JOB_FAVORITE2, JOBS_JOB_FAVORITE3
    ];

    const testListA: string[] = [
        DS_FAV_CONTEXT, PDS_FAV_CONTEXT, DS_FAV_TEXT_FILE_CONTEXT, USS_FAV_DIR_CONTEXT, JOBS_JOB_FAVORITE3
    ];
    const testListB: string[] = [
        DS_SESSION_CONTEXT, DS_PDS_CONTEXT, DS_DS_CONTEXT, DS_MEMBER_CONTEXT,
        DS_TEXT_FILE_CONTEXT, DS_BINARY_FILE_CONTEXT, DS_MIGRATED_FILE_CONTEXT, USS_SESSION_CONTEXT, USS_DIR_CONTEXT
    ];

    const treeItem = new TreeItem("Test", 0);

    it("Test USS", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case USS_FAV_DIR_CONTEXT:
                case USS_DIR_CONTEXT:
                    expect(context.isUssDirectory(treeItem)).toBe(true);
                    expect(context.isUssSession(treeItem)).toBe(false);
                    break;
                case USS_SESSION_CONTEXT:
                    expect(context.isUssSession(treeItem)).toBe(true);
                    expect(context.isUssDirectory(treeItem)).toBe(false);
                    break;
                default:
                    expect(context.isUssSession(treeItem)).toBe(false);
                    expect(context.isUssDirectory(treeItem)).toBe(false);
            }
        }
    });
    it("Test is dataset", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_PDS_CONTEXT + extension.FAV_SUFFIX:
                case DS_DS_CONTEXT + extension.FAV_SUFFIX:
                    expect(context.isFavoriteDataset(treeItem)).toBe(true);
                    break;
                default:
                    expect(context.isFavoriteDataset(treeItem)).toBe(false);
            }
        }
    });
    it("Test Jobs", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case JOBS_JOB_FAVORITE1:
                case JOBS_JOB_FAVORITE2:
                case JOBS_JOB_FAVORITE3:
                    expect(context.isJob(treeItem)).toBe(true);
                    expect(context.isFavoriteJob(treeItem)).toBe(true);
                    break;
                case JOBS_JOB_CONTEXT:
                    expect(context.isJob(treeItem)).toBe(true);
                    expect(context.isFavoriteJob(treeItem)).toBe(false);
                    break;
                default:
                    expect(context.isJob(treeItem)).toBe(false);
                    expect(context.isFavoriteJob(treeItem)).toBe(false);
            }
        }
    });
    it("Test Favorite PDS", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case PDS_FAV_CONTEXT:
                    expect(context.isFavoritePds(treeItem)).toBe(true);
                    break;
                default:
                    expect(context.isFavoritePds(treeItem)).toBe(false);
            }
        }
    });
    it("Test Favorite text or Binary", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_FAV_TEXT_FILE_CONTEXT:
                case DS_FAV_BINARY_FILE_CONTEXT:
                    expect(context.isFavoriteTextorBinary(treeItem)).toBe(true);
                    break;
                default:
                    expect(context.isFavoriteTextorBinary(treeItem)).toBe(false);
            }
        }
    });
    it("Test is Binary", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_FAV_BINARY_FILE_CONTEXT:
                case DS_BINARY_FILE_CONTEXT:
                    expect(context.isBinary(treeItem)).toBe(true);
                    break;
                default:
                    expect(context.isBinary(treeItem)).toBe(false);
            }
        }
    });
    it("Test a document", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_DS_CONTEXT:
                case DS_MEMBER_CONTEXT:
                case DS_TEXT_FILE_CONTEXT:
                case DS_FAV_TEXT_FILE_CONTEXT:
                case JOBS_SPOOL_CONTEXT:
                case DS_MIGRATED_FILE_CONTEXT:
                case DS_BINARY_FILE_CONTEXT:
                case DS_FAV_CONTEXT:
                    expect(context.isDocument(treeItem)).toBe(true);
                    break;
                default:
                    expect(context.isDocument(treeItem)).toBe(false);
            }
        }
    });
    it("Test is Favorite", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case PDS_FAV_CONTEXT:
                case DS_FAV_CONTEXT:
                case DS_FAV_TEXT_FILE_CONTEXT:
                case DS_FAV_BINARY_FILE_CONTEXT:
                case USS_FAV_DIR_CONTEXT:
                case JOBS_JOB_FAVORITE1:
                case JOBS_JOB_FAVORITE2:
                case JOBS_JOB_FAVORITE3:
                    expect(context.isFavorite(treeItem)).toBe(true);
                    break;
                default:
                    expect(context.isFavorite(treeItem)).toBe(false);
            }
        }
    });
    it("Test is Favorite search", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case PDS_FAV_CONTEXT:
                case DS_FAV_CONTEXT:
                case DS_FAV_TEXT_FILE_CONTEXT:
                case DS_FAV_BINARY_FILE_CONTEXT:
                case USS_FAV_DIR_CONTEXT:
                case JOBS_JOB_FAVORITE1:
                case JOBS_JOB_FAVORITE2:
                case JOBS_JOB_FAVORITE3:
                    expect(context.isFavorite(treeItem)).toBe(true);
                    break;
                default:
                    expect(context.isFavorite(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a session", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case JOBS_SESSION_CONTEXT:
                case JOBS_SESSION_CONTEXT_FAV:
                    expect(context.isSession(treeItem)).toBe(true);
                    expect(context.isSessionNotFav(treeItem)).toBe(true);
                    expect(context.isUssSession(treeItem)).toBe(false);
                    expect(context.isDsSession(treeItem)).toBe(false);
                    break;
                case USS_SESSION_CONTEXT_FAV:
                case USS_SESSION_CONTEXT:
                    expect(context.isSession(treeItem)).toBe(true);
                    expect(context.isSessionNotFav(treeItem)).toBe(true);
                    expect(context.isUssSession(treeItem)).toBe(true);
                    expect(context.isDsSession(treeItem)).toBe(false);
                    break;
                case DS_SESSION_CONTEXT:
                case DS_SESSION_CONTEXT_FAV:
                    expect(context.isSessionNotFav(treeItem)).toBe(true);
                    expect(context.isDsSession(treeItem)).toBe(true);
                    expect(context.isUssSession(treeItem)).toBe(false);
                    break;
                default:
                    expect(context.isSession(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a session search", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case FAVORITE_CONTEXT:
                    expect(context.isSessionFavorite(treeItem)).toBe(true);
                    break;
                default:
                    expect(context.isSessionFavorite(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a session (Not favorite)", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case JOBS_SESSION_CONTEXT:
                    expect(context.isSessionNotFav(treeItem)).toBe(true);
                    expect(context.isUssSession(treeItem)).toBe(false);
                    expect(context.isDsSession(treeItem)).toBe(false);
                    break;
                case USS_SESSION_CONTEXT:
                    expect(context.isSessionNotFav(treeItem)).toBe(true);
                    expect(context.isUssSession(treeItem)).toBe(true);
                    expect(context.isDsSession(treeItem)).toBe(false);
                    break;
                case DS_SESSION_CONTEXT:
                    expect(context.isSessionNotFav(treeItem)).toBe(true);
                    expect(context.isDsSession(treeItem)).toBe(true);
                    expect(context.isUssSession(treeItem)).toBe(false);
                    break;
                default:
                    expect(context.isSessionNotFav(treeItem)).toBe(false);
            }
        }
    });
    it("Test that this is a folder", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case USS_DIR_CONTEXT:
                case JOBS_JOB_CONTEXT:
                case DS_PDS_CONTEXT:
                case USS_FAV_DIR_CONTEXT:
                case JOBS_JOB_FAVORITE1:
                case JOBS_JOB_FAVORITE2:
                case JOBS_JOB_FAVORITE3:
                case PDS_FAV_CONTEXT:
                    expect(context.isFolder(treeItem)).toBe(true);
                    break;
                default:
                    expect(context.isFolder(treeItem)).toBe(false);
            }
        }
    });
    it("Test derive and base value", async () => {
        // Test list A is already favorite
        for (const ctx of testListA) {
            treeItem.contextValue = ctx;
            expect(context.isFavorite(treeItem)).toBe(true);
            treeItem.contextValue = context.deriveFavorite(treeItem);
            expect(context.isFavorite(treeItem)).toBe(true);
            treeItem.contextValue = context.getBaseContext(treeItem);
            expect(context.isFavorite(treeItem)).toBe(false);
        }

        // Test list B are not favorite
        for (const ctx of testListB) {
            treeItem.contextValue = ctx;
            expect(context.isFavorite(treeItem)).toBe(false);
            treeItem.contextValue = context.deriveFavorite(treeItem);
            expect(context.isFavorite(treeItem)).toBe(true);
            treeItem.contextValue = context.getBaseContext(treeItem);
            expect(context.isFavorite(treeItem)).toBe(false);
        }
    });
});
