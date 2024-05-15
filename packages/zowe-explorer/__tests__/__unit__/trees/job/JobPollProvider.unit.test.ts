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

import * as vscode from "vscode";
import { Poller } from "@zowe/zowe-explorer-api";
import { PollProvider } from "../../../../src/trees/job/JobPollProvider";

jest.mock("vscode");

describe("PollProvider - unit tests", () => {
    it("disposes the provider without errors", () => {
        const forEachDisposableMock = jest.fn();
        (PollProvider as any).disposables = [{ dispose: forEachDisposableMock }];
        const forEachSpy = jest.spyOn((PollProvider as any).disposables, "forEach");
        try {
            PollProvider.dispose();
        } catch (err) {
            fail("PollDecorator.dispose should not throw an error.");
        }
        expect(forEachSpy).toHaveBeenCalled();
        expect(forEachDisposableMock).toHaveBeenCalled();
    });

    it("updates the icon when given a URI", () => {
        const mockUri = {
            path: "some_uri_path",
            query: "[some.profile], {}",
        } as unknown as vscode.Uri;
        Poller.pollRequests[mockUri.path] = {
            msInterval: 1000,
            request: (): Promise<boolean> =>
                new Promise((resolve) => {
                    return resolve(true);
                }),
        };
        try {
            PollProvider.updateIcon(mockUri);
        } catch (err) {
            fail("PollDecorator.updateIcon should not throw an error for a new icon.");
        }

        Poller.pollRequests[mockUri.path]["decoration"] = new vscode.FileDecoration("P", "Polling (1000ms)");
        Poller.pollRequests[mockUri.path].msInterval = 500;

        // Update the icon for a URI that has already been decorated
        PollProvider.provideFileDecoration(mockUri, undefined as any);

        const decoration = Poller.pollRequests[mockUri.path].decoration;
        expect(decoration?.tooltip).toBe("Polling (500ms)");
    });

    it("provides an accurate decoration depending on file poll status", () => {
        const fakeUri = vscode.Uri.parse("/some/fake/uri");
        (fakeUri.query as any) = "[some.profile], {}";
        Poller.pollRequests[fakeUri.path] = {
            msInterval: 500,
            request: async (): Promise<string> => Promise.resolve("Hello world!"),
            dispose: false,
        };

        const fileDecoration = PollProvider.provideFileDecoration(fakeUri, {
            isCancellationRequested: false,
            onCancellationRequested: jest.fn(),
        });

        expect(fileDecoration).not.toBe(null);

        // Verify that a file (that is not being polled) has a null decoration
        delete Poller.pollRequests[fakeUri.path];

        const nullDecoration = PollProvider.provideFileDecoration(fakeUri, {
            isCancellationRequested: false,
            onCancellationRequested: jest.fn(),
        });

        expect(nullDecoration).toBe(null);
    });
});
