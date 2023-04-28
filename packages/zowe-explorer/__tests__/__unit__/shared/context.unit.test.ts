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

import { TreeItem } from "vscode";
import * as contextually from "../../../src/shared/context";
import * as globals from "../../../src/globals";

describe("Context helper tests", () => {
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
    const USS_SESSION_CONTEXT = "ussSession";
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
    const POLL_CONTEXT = "_polling";
    const VALIDATE_SUFFIX = "_validate";
    const NO_VALIDATE_SUFFIX = "_noValidate";

    const testList: string[] = [
        INFORMATION_CONTEXT,
        FAVORITE_CONTEXT,
        DS_FAV_CONTEXT,
        PDS_FAV_CONTEXT,
        DS_SESSION_CONTEXT,
        DS_PDS_CONTEXT,
        DS_DS_CONTEXT,
        DS_MEMBER_CONTEXT,
        DS_TEXT_FILE_CONTEXT,
        DS_FAV_TEXT_FILE_CONTEXT,
        DS_BINARY_FILE_CONTEXT,
        DS_MIGRATED_FILE_CONTEXT,
        USS_SESSION_CONTEXT,
        USS_DIR_CONTEXT,
        USS_FAV_DIR_CONTEXT,
        JOBS_SESSION_CONTEXT,
        JOBS_JOB_CONTEXT,
        JOBS_SPOOL_CONTEXT,
        ICON_STATE_OPEN,
        ICON_STATE_CLOSED,
        JOBS_JOB_FAVORITE1,
        JOBS_JOB_FAVORITE2,
        JOBS_JOB_FAVORITE3,
        VALIDATE_SUFFIX,
        NO_VALIDATE_SUFFIX,
    ];

    const testListA: string[] = [DS_FAV_CONTEXT, PDS_FAV_CONTEXT, DS_FAV_TEXT_FILE_CONTEXT, USS_FAV_DIR_CONTEXT, JOBS_JOB_FAVORITE3];
    const testListB: string[] = [
        DS_SESSION_CONTEXT,
        DS_PDS_CONTEXT,
        DS_DS_CONTEXT,
        DS_MEMBER_CONTEXT,
        DS_TEXT_FILE_CONTEXT,
        DS_BINARY_FILE_CONTEXT,
        DS_MIGRATED_FILE_CONTEXT,
        USS_SESSION_CONTEXT,
        USS_DIR_CONTEXT,
    ];

    const treeItem = new TreeItem("Test", 0);

    function callCaseMocksJobSession() {
        expect(contextually.isSession(treeItem)).toBe(true);
        expect(contextually.isSessionNotFav(treeItem)).toBe(true);
        expect(contextually.isUssSession(treeItem)).toBe(false);
        expect(contextually.isDsSession(treeItem)).toBe(false);
        expect(contextually.isJobsSession(treeItem)).toBe(true);
    }
    function callCaseMocksUssSession() {
        expect(contextually.isSession(treeItem)).toBe(true);
        expect(contextually.isSessionNotFav(treeItem)).toBe(true);
        expect(contextually.isUssSession(treeItem)).toBe(true);
        expect(contextually.isDsSession(treeItem)).toBe(false);
        expect(contextually.isJobsSession(treeItem)).toBe(false);
    }
    function callCaseMocksDsSession() {
        expect(contextually.isSessionNotFav(treeItem)).toBe(true);
        expect(contextually.isDsSession(treeItem)).toBe(true);
        expect(contextually.isUssSession(treeItem)).toBe(false);
        expect(contextually.isJobsSession(treeItem)).toBe(false);
    }

    it("Test USS", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case USS_FAV_DIR_CONTEXT:
                case USS_DIR_CONTEXT:
                    expect(contextually.isUssDirectory(treeItem)).toBe(true);
                    expect(contextually.isUssSession(treeItem)).toBe(false);
                    break;
                case USS_SESSION_CONTEXT:
                    expect(contextually.isUssSession(treeItem)).toBe(true);
                    expect(contextually.isUssDirectory(treeItem)).toBe(false);
                    break;
                default:
                    expect(contextually.isUssSession(treeItem)).toBe(false);
                    expect(contextually.isUssDirectory(treeItem)).toBe(false);
            }
        }
    });
    it("Test is dataset", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_PDS_CONTEXT + globals.FAV_SUFFIX:
                    expect(contextually.isFavoritePsDs(treeItem)).toBe(true);
                    expect(contextually.isFavoriteDs(treeItem)).toBe(false);
                    break;
                case DS_DS_CONTEXT + globals.FAV_SUFFIX:
                    expect(contextually.isFavoritePsDs(treeItem)).toBe(true);
                    expect(contextually.isFavoriteDs(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isFavoritePsDs(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a dataset member", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_MEMBER_CONTEXT:
                case DS_MEMBER_CONTEXT + globals.FAV_SUFFIX:
                    expect(contextually.isDsMember(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isDsMember(treeItem)).toBe(false);
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
                    expect(contextually.isJob(treeItem)).toBe(true);
                    expect(contextually.isFavoriteJob(treeItem)).toBe(true);
                    break;
                case JOBS_JOB_CONTEXT:
                    expect(contextually.isJob(treeItem)).toBe(true);
                    expect(contextually.isFavoriteJob(treeItem)).toBe(false);
                    break;
                default:
                    expect(contextually.isJob(treeItem)).toBe(false);
                    expect(contextually.isFavoriteJob(treeItem)).toBe(false);
            }
        }
    });
    it("Test Favorite PDS", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case PDS_FAV_CONTEXT:
                    expect(contextually.isFavoritePds(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isFavoritePds(treeItem)).toBe(false);
            }
        }
    });

    it("Test Non Favorite PDS", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            expect(contextually.isPdsNotFav(treeItem)).toBe(treeItem.contextValue === DS_PDS_CONTEXT);
        }
    });

    it("Test PDS (regardless of favorite)", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            expect(contextually.isPds(treeItem)).toBe(treeItem.contextValue.indexOf(DS_PDS_CONTEXT) >= 0);
        }
    });

    it("Test Favorite text or Binary", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_FAV_TEXT_FILE_CONTEXT:
                case DS_FAV_BINARY_FILE_CONTEXT:
                    expect(contextually.isFavoriteTextOrBinary(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isFavoriteTextOrBinary(treeItem)).toBe(false);
            }
        }
    });
    it("Test is Binary", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_FAV_BINARY_FILE_CONTEXT:
                case DS_BINARY_FILE_CONTEXT:
                    expect(contextually.isBinary(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isBinary(treeItem)).toBe(false);
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
                case DS_FAV_CONTEXT:
                    expect(contextually.isDocument(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isDocument(treeItem)).toBe(false);
            }
        }
    });

    it("Test a spool file", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case JOBS_SPOOL_CONTEXT:
                    expect(contextually.isSpoolFile(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isSpoolFile(treeItem)).toBe(false);
            }
        }
    });

    it("Test items that are being polled", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case POLL_CONTEXT:
                    expect(contextually.isPolling(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isPolling(treeItem)).toBe(false);
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
                    expect(contextually.isFavorite(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isFavorite(treeItem)).toBe(false);
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
                    expect(contextually.isFavorite(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isFavorite(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a session", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case JOBS_SESSION_CONTEXT:
                    callCaseMocksJobSession();
                    break;
                case USS_SESSION_CONTEXT:
                    callCaseMocksUssSession();
                    break;
                case DS_SESSION_CONTEXT:
                    callCaseMocksDsSession();
                    break;
                case JOBS_SESSION_CONTEXT_FAV:
                    expect(contextually.isSession(treeItem)).toBe(true);
                    expect(contextually.isSessionNotFav(treeItem)).toBe(false);
                    expect(contextually.isUssSession(treeItem)).toBe(false);
                    expect(contextually.isDsSession(treeItem)).toBe(false);
                    expect(contextually.isJobsSession(treeItem)).toBe(true);
                    break;
                case USS_SESSION_CONTEXT_FAV:
                    expect(contextually.isSession(treeItem)).toBe(true);
                    expect(contextually.isSessionNotFav(treeItem)).toBe(false);
                    expect(contextually.isUssSession(treeItem)).toBe(true);
                    expect(contextually.isDsSession(treeItem)).toBe(false);
                    expect(contextually.isJobsSession(treeItem)).toBe(false);
                    break;
                case DS_SESSION_CONTEXT_FAV:
                    expect(contextually.isSessionNotFav(treeItem)).toBe(false);
                    expect(contextually.isDsSession(treeItem)).toBe(true);
                    expect(contextually.isUssSession(treeItem)).toBe(false);
                    expect(contextually.isJobsSession(treeItem)).toBe(false);
                    break;
                default:
                    expect(contextually.isSession(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a session search", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case FAVORITE_CONTEXT:
                    expect(contextually.isSessionFavorite(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isSessionFavorite(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a session (Not favorite)", async () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case JOBS_SESSION_CONTEXT:
                    callCaseMocksJobSession();
                    break;
                case USS_SESSION_CONTEXT:
                    callCaseMocksUssSession();
                    break;
                case DS_SESSION_CONTEXT:
                    callCaseMocksDsSession();
                    break;
                default:
                    expect(contextually.isSessionNotFav(treeItem)).toBe(false);
            }
        }
    });

    it("Test a session with validation enabled", async () => {
        for (const ctx of testList) {
            // Test below will verify whether NO_VALIDATE_SUFFIX works
            if (ctx === NO_VALIDATE_SUFFIX) {
                continue;
            }
            treeItem.contextValue = ctx;
            expect(contextually.isValidationEnabled(treeItem)).toBe(treeItem.contextValue.includes(VALIDATE_SUFFIX));
        }
    });

    it("Test a session with validation disabled", async () => {
        for (const ctx of testList) {
            // Test above will verify whether VALIDATE_SUFFIX works
            if (ctx === VALIDATE_SUFFIX) {
                continue;
            }
            treeItem.contextValue = ctx;
            expect(contextually.isValidationEnabled(treeItem)).toBe(false);
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
                    expect(contextually.isFolder(treeItem)).toBe(true);
                    break;
                default:
                    expect(contextually.isFolder(treeItem)).toBe(false);
            }
        }
    });
    it("Test derive and base value", async () => {
        // Test list A is already favorite
        for (const ctx of testListA) {
            treeItem.contextValue = ctx;
            expect(contextually.isFavorite(treeItem)).toBe(true);
            treeItem.contextValue = contextually.asFavorite(treeItem);
            expect(contextually.isFavorite(treeItem)).toBe(true);
            treeItem.contextValue = contextually.getBaseContext(treeItem);
            expect(contextually.isFavorite(treeItem)).toBe(false);
        }

        // Test list B are not favorite
        for (const ctx of testListB) {
            treeItem.contextValue = ctx;
            expect(contextually.isFavorite(treeItem)).toBe(false);
            treeItem.contextValue = contextually.asFavorite(treeItem);
            expect(contextually.isFavorite(treeItem)).toBe(true);
            treeItem.contextValue = contextually.getBaseContext(treeItem);
            expect(contextually.isFavorite(treeItem)).toBe(false);
        }
    });
    it("Test contextValue being returned when calling getBaseContext", () => {
        treeItem.contextValue = "test";
        expect(contextually.getBaseContext(treeItem)).toEqual(treeItem.contextValue);
    });
});
