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

import { PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { ZowePersistentFilters } from "../../../src/tools/ZowePersistentFilters";

describe("PersistentFilters Unit Test", () => {
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLocalStorage, "globalState", {
        value: {
            get: () => ({
                persistence: true,
                favorites: [],
                history: [],
                sessions: ["zosmf"],
                searchHistory: [],
                fileHistory: [],
                templates: [
                    {
                        MyMockTemplate: {
                            alcunit: "CYL",
                            blksize: 3130,
                            dirblk: 35,
                            dsorg: "PO",
                            lrecl: 40,
                            primary: 1,
                            recfm: "FB",
                        },
                    },
                ],
            }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });
    describe("addSearchHistory()", () => {
        it("should pop search history if history length is larger than max length", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 1, 1);
            const privatePf = pf as any;
            privatePf.mSearchHistory = ["testOne"];
            pf.addSearchHistory("testTwo");
            expect(pf.getSearchHistory()).toEqual(["testTwo"]);
        });
    });
    describe("addFileHistory()", () => {
        it("should pop search history if history length is larger than max length", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.USS, 2, 2);
            const privatePf = pf as any;
            privatePf.mFileHistory = ["TEST2.TXT", "TEST1.TXT"];
            pf.addFileHistory("TEST3.TXT");
            expect(pf.getFileHistory()).toEqual(["TEST3.TXT", "TEST2.TXT"]);
        });
    });
    describe("removeSearchHistory", () => {
        it("should remove the specified item from the persistent object", () => {
            const pf: ZowePersistentFilters = new ZowePersistentFilters(PersistenceSchemaEnum.Job, 2, 2);
            pf["mSearchHistory"] = ["test1", "test2"];
            pf.removeSearchHistory("test1");
            expect(pf.getSearchHistory().length).toEqual(1);
        });
    });
});
