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

import { DsEntry, DsEntryMetadata, PdsEntry } from "../../../../src/";

describe("DsEntry", () => {
    it("calls the FileEntry class constructor when initialized", () => {
        const entry = new DsEntry("TEST.DS");
        expect(entry.name).toBe("TEST.DS");
    });
});

describe("PdsEntry", () => {
    it("calls the DirEntry class constructor when initialized", () => {
        const entry = new PdsEntry("TEST.PDS");
        expect(entry.name).toBe("TEST.PDS");
        expect(entry.entries).toStrictEqual(new Map());
    });
});

describe("DsEntryMetadata", () => {
    it("sets the profile and path provided in constructor", () => {
        const fakeProfile: any = { name: "testProfile" };
        const entryMeta = new DsEntryMetadata({
            profile: fakeProfile,
            path: "/TEST.DS",
        });
        expect(entryMeta.profile).toBe(fakeProfile);
        expect(entryMeta.path).toBe("/TEST.DS");
    });

    it("returns a proper value for dsName", () => {
        const fakeProfile: any = { name: "testProfile" };
        const entryMeta = new DsEntryMetadata({
            profile: fakeProfile,
            path: "/TEST.DS",
        });
        expect(entryMeta.dsName).toBe("TEST.DS");

        const pdsEntryMeta = new DsEntryMetadata({
            profile: fakeProfile,
            path: "/TEST.PDS/MEMBER",
        });
        expect(pdsEntryMeta.dsName).toBe("TEST.PDS(MEMBER)");
    });

    describe("extensionRemovedFromPath", () => {
        it("returns a path without its extension", () => {
            const fakeProfile: any = { name: "testProfile" };
            const entryMeta = new DsEntryMetadata({
                profile: fakeProfile,
                path: "/testProfile/TEST.COBOL.DS.cbl",
            });
            expect((entryMeta as any).extensionRemovedFromPath()).toBe("/testProfile/TEST.COBOL.DS");
        });
        it("returns a path as-is if no extension is detected", () => {
            const fakeProfile: any = { name: "testProfile" };
            const entryMeta = new DsEntryMetadata({
                profile: fakeProfile,
                path: "/testProfile/TEST.SOME.DS",
            });
            expect((entryMeta as any).extensionRemovedFromPath()).toBe("/testProfile/TEST.SOME.DS");
        });
    });
});
