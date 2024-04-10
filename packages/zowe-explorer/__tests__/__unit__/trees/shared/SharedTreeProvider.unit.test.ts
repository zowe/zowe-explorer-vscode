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

import { createTreeView } from "../../../__mocks__/mockCreators/shared";
import { Constants } from "../../../../src/configuration";
import { SharedTreeProviders } from "../../../../src/trees/shared";

describe("TreeProvider Unit Tests - Function getters", () => {
    it("should retrieve the ds provider", async () => {
        const mockTree = createTreeView("ds");
        await SharedTreeProviders.initializeProviders({
            ds: jest.fn(() => mockTree) as any,
            uss: jest.fn(),
            job: jest.fn(),
        });
        expect(SharedTreeProviders.ds).toEqual(mockTree);
    });
    it("should retrieve the uss provider", async () => {
        const mockTree = createTreeView("uss");
        await SharedTreeProviders.initializeProviders({
            ds: jest.fn(),
            uss: jest.fn(() => mockTree) as any,
            job: jest.fn(),
        });
        expect(SharedTreeProviders.uss).toEqual(mockTree);
    });
    it("should retrieve the uss provider", async () => {
        const mockTree = createTreeView("job");
        await SharedTreeProviders.initializeProviders({
            ds: jest.fn(),
            uss: jest.fn(),
            job: jest.fn(() => mockTree) as any,
        });
        expect(SharedTreeProviders.job).toEqual(mockTree);
    });
});

describe("TreeProvider Unit Tests - Function sessionIsPresentInOtherTrees", () => {
    it("should return true if session is present in another tree", async () => {
        await SharedTreeProviders.initializeProviders({
            ds: (): any => ({ mSessionNodes: [{ getLabel: () => "test1" }, { getLabel: () => "test2" }] } as any),
            uss: (): any => ({ mSessionNodes: [{ getLabel: () => "test3" }, { getLabel: () => "test4" }] } as any),
            job: (): any => ({ mSessionNodes: [{ getLabel: () => "test5" }, { getLabel: () => "test1" }] } as any),
        });
        expect(SharedTreeProviders.sessionIsPresentInOtherTrees("test1")).toEqual(true);
    });
});

describe("TreeProvider Unit Tests - Function contextValueExistsAcrossTrees", () => {
    it("should return true if the context value passed in exists across other trees", () => {
        jest.spyOn(SharedTreeProviders, "getSessionForAllTrees").mockReturnValue([
            { getLabel: () => "test1", contextValue: Constants.DS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX } as any,
            { getLabel: () => "test1", contextValue: Constants.USS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX } as any,
            { getLabel: () => "test1", contextValue: Constants.JOBS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX } as any,
        ]);
        expect(
            SharedTreeProviders.contextValueExistsAcrossTrees(
                { getLabel: () => "test1", contextValue: Constants.DS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX } as any,
                Constants.VALIDATE_SUFFIX
            )
        ).toEqual(true);
    });
});
