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
import { SharedContext } from "../../../../src/trees/shared";
import { Constants } from "../../../../src/configuration";

describe("Context helper tests", () => {
    const INFORMATION_CONTEXT = "information";
    const FAVORITE_CONTEXT = "favorite";
    const DS_FAV_CONTEXT = "ds_fav";
    const PDS_FAV_CONTEXT = "pds_fav";
    const DS_SESSION_CONTEXT = "session";
    const DS_PDS_CONTEXT = "pds";
    const DS_DS_CONTEXT = "ds";
    const DS_MEMBER_CONTEXT = "member";
    const DS_MIGRATED_FILE_CONTEXT = "migr";
    const USS_SESSION_CONTEXT = "ussSession";
    const USS_DIR_CONTEXT = "directory";
    const USS_FAV_DIR_CONTEXT = "directory_fav";
    const USS_TEXT_FILE_CONTEXT = "textFile";
    const USS_FAV_TEXT_FILE_CONTEXT = "textFile_fav";
    const USS_BINARY_FILE_CONTEXT = "binaryFile";
    const USS_FAV_BINARY_FILE_CONTEXT = "binaryFile_fav";
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
        USS_TEXT_FILE_CONTEXT,
        USS_FAV_TEXT_FILE_CONTEXT,
        USS_BINARY_FILE_CONTEXT,
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

    const testListA: string[] = [DS_FAV_CONTEXT, PDS_FAV_CONTEXT, USS_FAV_TEXT_FILE_CONTEXT, USS_FAV_DIR_CONTEXT, JOBS_JOB_FAVORITE3];
    const testListB: string[] = [
        DS_SESSION_CONTEXT,
        DS_PDS_CONTEXT,
        DS_DS_CONTEXT,
        DS_MEMBER_CONTEXT,
        USS_TEXT_FILE_CONTEXT,
        USS_BINARY_FILE_CONTEXT,
        DS_MIGRATED_FILE_CONTEXT,
        USS_SESSION_CONTEXT,
        USS_DIR_CONTEXT,
    ];

    const treeItem = new TreeItem("Test", 0);

    function callCaseMocksJobSession() {
        expect(SharedContext.isSession(treeItem)).toBe(true);
        expect(SharedContext.isSessionNotFav(treeItem)).toBe(true);
        expect(SharedContext.isUssSession(treeItem)).toBe(false);
        expect(SharedContext.isDsSession(treeItem)).toBe(false);
        expect(SharedContext.isJobsSession(treeItem)).toBe(true);
    }
    function callCaseMocksUssSession() {
        expect(SharedContext.isSession(treeItem)).toBe(true);
        expect(SharedContext.isSessionNotFav(treeItem)).toBe(true);
        expect(SharedContext.isUssSession(treeItem)).toBe(true);
        expect(SharedContext.isDsSession(treeItem)).toBe(false);
        expect(SharedContext.isJobsSession(treeItem)).toBe(false);
    }
    function callCaseMocksDsSession() {
        expect(SharedContext.isSessionNotFav(treeItem)).toBe(true);
        expect(SharedContext.isDsSession(treeItem)).toBe(true);
        expect(SharedContext.isUssSession(treeItem)).toBe(false);
        expect(SharedContext.isJobsSession(treeItem)).toBe(false);
    }

    it("Test USS", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case USS_FAV_DIR_CONTEXT:
                case USS_DIR_CONTEXT:
                    expect(SharedContext.isUssDirectory(treeItem)).toBe(true);
                    expect(SharedContext.isUssSession(treeItem)).toBe(false);
                    break;
                case USS_SESSION_CONTEXT:
                    expect(SharedContext.isUssSession(treeItem)).toBe(true);
                    expect(SharedContext.isUssDirectory(treeItem)).toBe(false);
                    break;
                default:
                    expect(SharedContext.isUssSession(treeItem)).toBe(false);
                    expect(SharedContext.isUssDirectory(treeItem)).toBe(false);
            }
        }
    });
    it("Test is dataset", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_PDS_CONTEXT + Constants.FAV_SUFFIX:
                    expect(SharedContext.isFavoritePsDs(treeItem)).toBe(true);
                    expect(SharedContext.isFavoriteDs(treeItem)).toBe(false);
                    break;
                case DS_DS_CONTEXT + Constants.FAV_SUFFIX:
                    expect(SharedContext.isFavoritePsDs(treeItem)).toBe(true);
                    expect(SharedContext.isFavoriteDs(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isFavoritePsDs(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a dataset member", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_MEMBER_CONTEXT:
                case DS_MEMBER_CONTEXT + Constants.FAV_SUFFIX:
                    expect(SharedContext.isDsMember(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isDsMember(treeItem)).toBe(false);
            }
        }
    });
    it("Test Jobs", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case JOBS_JOB_FAVORITE1:
                case JOBS_JOB_FAVORITE2:
                case JOBS_JOB_FAVORITE3:
                    expect(SharedContext.isJob(treeItem)).toBe(true);
                    expect(SharedContext.isFavoriteJob(treeItem)).toBe(true);
                    break;
                case JOBS_JOB_CONTEXT:
                    expect(SharedContext.isJob(treeItem)).toBe(true);
                    expect(SharedContext.isFavoriteJob(treeItem)).toBe(false);
                    break;
                default:
                    expect(SharedContext.isJob(treeItem)).toBe(false);
                    expect(SharedContext.isFavoriteJob(treeItem)).toBe(false);
            }
        }
    });
    it("Test Favorite PDS", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case PDS_FAV_CONTEXT:
                    expect(SharedContext.isFavoritePds(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isFavoritePds(treeItem)).toBe(false);
            }
        }
    });

    it("Test Non Favorite PDS", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            expect(SharedContext.isPdsNotFav(treeItem)).toBe(treeItem.contextValue === DS_PDS_CONTEXT);
        }
    });

    it("Test PDS (regardless of favorite)", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            expect(SharedContext.isPds(treeItem)).toBe(treeItem.contextValue.indexOf(DS_PDS_CONTEXT) >= 0);
        }
    });

    it("Test Favorite text or Binary", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case USS_FAV_TEXT_FILE_CONTEXT:
                case USS_FAV_BINARY_FILE_CONTEXT:
                    expect(SharedContext.isFavoriteTextOrBinary(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isFavoriteTextOrBinary(treeItem)).toBe(false);
            }
        }
    });
    it("Test is Binary", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case USS_FAV_BINARY_FILE_CONTEXT:
                case USS_BINARY_FILE_CONTEXT:
                    expect(SharedContext.isBinary(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isBinary(treeItem)).toBe(false);
            }
        }
    });
    it("Test a document", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case DS_DS_CONTEXT:
                case DS_MEMBER_CONTEXT:
                case USS_TEXT_FILE_CONTEXT:
                case USS_FAV_TEXT_FILE_CONTEXT:
                case JOBS_SPOOL_CONTEXT:
                case DS_MIGRATED_FILE_CONTEXT:
                case DS_FAV_CONTEXT:
                    expect(SharedContext.isDocument(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isDocument(treeItem)).toBe(false);
            }
        }
    });

    it("Test a spool file", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case JOBS_SPOOL_CONTEXT:
                    expect(SharedContext.isSpoolFile(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isSpoolFile(treeItem)).toBe(false);
            }
        }
    });

    it("Test items that are being polled", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case POLL_CONTEXT:
                    expect(SharedContext.isPolling(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isPolling(treeItem)).toBe(false);
            }
        }
    });

    it("Test is Favorite", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case PDS_FAV_CONTEXT:
                case DS_FAV_CONTEXT:
                case USS_FAV_TEXT_FILE_CONTEXT:
                case USS_FAV_BINARY_FILE_CONTEXT:
                case USS_FAV_DIR_CONTEXT:
                case JOBS_JOB_FAVORITE1:
                case JOBS_JOB_FAVORITE2:
                case JOBS_JOB_FAVORITE3:
                    expect(SharedContext.isFavorite(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isFavorite(treeItem)).toBe(false);
            }
        }
    });
    it("Test is Favorite search", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case PDS_FAV_CONTEXT:
                case DS_FAV_CONTEXT:
                case USS_FAV_TEXT_FILE_CONTEXT:
                case USS_FAV_BINARY_FILE_CONTEXT:
                case USS_FAV_DIR_CONTEXT:
                case JOBS_JOB_FAVORITE1:
                case JOBS_JOB_FAVORITE2:
                case JOBS_JOB_FAVORITE3:
                    expect(SharedContext.isFavorite(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isFavorite(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a session", () => {
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
                    expect(SharedContext.isSession(treeItem)).toBe(true);
                    expect(SharedContext.isSessionNotFav(treeItem)).toBe(false);
                    expect(SharedContext.isUssSession(treeItem)).toBe(false);
                    expect(SharedContext.isDsSession(treeItem)).toBe(false);
                    expect(SharedContext.isJobsSession(treeItem)).toBe(true);
                    break;
                case USS_SESSION_CONTEXT_FAV:
                    expect(SharedContext.isSession(treeItem)).toBe(true);
                    expect(SharedContext.isSessionNotFav(treeItem)).toBe(false);
                    expect(SharedContext.isUssSession(treeItem)).toBe(true);
                    expect(SharedContext.isDsSession(treeItem)).toBe(false);
                    expect(SharedContext.isJobsSession(treeItem)).toBe(false);
                    break;
                case DS_SESSION_CONTEXT_FAV:
                    expect(SharedContext.isSessionNotFav(treeItem)).toBe(false);
                    expect(SharedContext.isDsSession(treeItem)).toBe(true);
                    expect(SharedContext.isUssSession(treeItem)).toBe(false);
                    expect(SharedContext.isJobsSession(treeItem)).toBe(false);
                    break;
                default:
                    expect(SharedContext.isSession(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a session search", () => {
        for (const ctx of testList) {
            treeItem.contextValue = ctx;
            switch (ctx) {
                case FAVORITE_CONTEXT:
                    expect(SharedContext.isSessionFavorite(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isSessionFavorite(treeItem)).toBe(false);
            }
        }
    });
    it("Test is a session (Not favorite)", () => {
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
                    expect(SharedContext.isSessionNotFav(treeItem)).toBe(false);
            }
        }
    });

    it("Test a session with validation enabled", () => {
        for (const ctx of testList) {
            // Test below will verify whether NO_VALIDATE_SUFFIX works
            if (ctx === NO_VALIDATE_SUFFIX) {
                continue;
            }
            treeItem.contextValue = ctx;
            expect(SharedContext.isValidationEnabled(treeItem)).toBe(treeItem.contextValue.includes(VALIDATE_SUFFIX));
        }
    });

    it("Test a session with validation disabled", () => {
        for (const ctx of testList) {
            // Test above will verify whether VALIDATE_SUFFIX works
            if (ctx === VALIDATE_SUFFIX) {
                continue;
            }
            treeItem.contextValue = ctx;
            expect(SharedContext.isValidationEnabled(treeItem)).toBe(false);
        }
    });

    it("Test that this is a folder", () => {
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
                    expect(SharedContext.isFolder(treeItem)).toBe(true);
                    break;
                default:
                    expect(SharedContext.isFolder(treeItem)).toBe(false);
            }
        }
    });
    it("Test derive and base value", () => {
        // Test list A is already favorite
        for (const ctx of testListA) {
            treeItem.contextValue = ctx;
            expect(SharedContext.isFavorite(treeItem)).toBe(true);
            treeItem.contextValue = SharedContext.asFavorite(treeItem);
            expect(SharedContext.isFavorite(treeItem)).toBe(true);
            treeItem.contextValue = SharedContext.getBaseContext(treeItem);
            expect(SharedContext.isFavorite(treeItem)).toBe(false);
        }

        // Test list B are not favorite
        for (const ctx of testListB) {
            treeItem.contextValue = ctx;
            expect(SharedContext.isFavorite(treeItem)).toBe(false);
            treeItem.contextValue = SharedContext.asFavorite(treeItem);
            expect(SharedContext.isFavorite(treeItem)).toBe(true);
            treeItem.contextValue = SharedContext.getBaseContext(treeItem);
            expect(SharedContext.isFavorite(treeItem)).toBe(false);
        }
    });
    it("Test contextValue being returned when calling getBaseContext", () => {
        treeItem.contextValue = "test";
        expect(SharedContext.getBaseContext(treeItem)).toEqual(treeItem.contextValue);
    });

    it("Test getSessionType returning 'uss'", () => {
        treeItem.contextValue = Constants.USS_SESSION_CONTEXT;
        expect(SharedContext.getSessionType(treeItem)).toEqual("uss");
    });

    it("Test getSessionType returning 'job'", () => {
        treeItem.contextValue = Constants.JOBS_SESSION_CONTEXT;
        expect(SharedContext.getSessionType(treeItem)).toEqual("jobs");
    });

    it("Test getSessionType returning error if node has no type", () => {
        treeItem.contextValue = undefined;
        try {
            SharedContext.getSessionType(treeItem);
        } catch (err) {
            expect(err.message).toEqual("Session node passed in does not have a type");
        }
    });
});
