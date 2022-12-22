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

import * as vscode from "vscode";
import * as jobTree from "../../../src/job/ZosJobsProvider";
import * as refreshActions from "../../../src/shared/refresh";
import * as contextuals from "../../../src/shared/context";
import * as jobActions from "../../../src/job/actions";
import * as sharedExtension from "../../../src/shared/extension";
import { initJobsProvider } from "../../../src/job/extension";
import { Profiles } from "../../../src/Profiles";
import { IJestIt, ITestContext, processSubscriptions, spyOnSubscriptions } from "../../__common__/testUtils";

describe("Test src/dataset/extension", () => {
    describe("initDatasetProvider", () => {
        let registerCommand;
        let onDidChangeConfiguration;
        let spyCreateJobsTree;
        const test: ITestContext = {
            context: { subscriptions: [] },
            value: { test: "job" },
            _: { _: "_" },
        };
        const jobsProvider: { [key: string]: jest.Mock } = {
            createZoweSchema: jest.fn(),
            createZoweSession: jest.fn(),
            deleteSession: jest.fn(),
            filterPrompt: jest.fn(),
            editSession: jest.fn(),
            addFavorite: jest.fn(),
            removeFavorite: jest.fn(),
            saveSearch: jest.fn(),
            removeFavProfile: jest.fn(),
            ssoLogin: jest.fn(),
            ssoLogout: jest.fn(),
            onDidChangeConfiguration: jest.fn(),
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.jobs.zosJobsOpenspool",
                parm: [test._, test.value, test._],
                mock: [{ spy: jest.spyOn(jobActions, "getSpoolContent"), arg: [test._, test.value, test._] }],
            },
        ];

        beforeAll(async () => {
            registerCommand = (cmd: string, fun: () => void) => {
                return { [cmd]: fun };
            };
            onDidChangeConfiguration = (fun: () => void) => {
                return { onDidChangeConfiguration: fun };
            };
            spyCreateJobsTree = jest.spyOn(jobTree, "createJobsTree");
            jest.spyOn(sharedExtension, "initSubscribers").mockImplementation(jest.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });

            spyCreateJobsTree.mockResolvedValue(jobsProvider as any);
            spyOnSubscriptions(commands);
            await initJobsProvider(test.context);
        });
        beforeEach(() => {
            spyCreateJobsTree.mockResolvedValue(jobsProvider as any);
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);

        it("should not initialize if it is unable to create the dataset tree", async () => {
            spyCreateJobsTree.mockResolvedValue(null);
            const myProvider = await initJobsProvider({} as any);
            expect(myProvider).toBe(null);
        });
    });
});
