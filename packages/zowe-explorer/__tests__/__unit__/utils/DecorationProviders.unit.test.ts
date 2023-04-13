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

import { Poller } from "@zowe/zowe-explorer-api/src/utils";
import { PollDecorator } from "../../../src/utils/DecorationProviders";
import * as vscode from "vscode";

jest.mock("vscode");

describe("PollDecorationProvider - unit tests", () => {
    it("disposes the provider without errors", () => {
        const forEachDisposableMock = jest.fn();
        (PollDecorator as any).disposables = [{ dispose: forEachDisposableMock }];
        const forEachSpy = jest.spyOn((PollDecorator as any).disposables, "forEach");
        try {
            PollDecorator.dispose();
        } catch (err) {
            fail("PollDecorator.dispose should not throw an error.");
        }
        expect(forEachSpy).toHaveBeenCalled();
        expect(forEachDisposableMock).toHaveBeenCalled();
    });

    it("updates the icon when given a URI", () => {
        try {
            PollDecorator.updateIcon({
                path: "some_uri_path",
                query: "[some.profile], {}",
            } as unknown as vscode.Uri);
        } catch (err) {
            fail("PollDecorator.updateIcon should not throw an error.");
        }
    });

    it("provides an accurate decoration depending on file poll status", () => {
        const fakeUri = vscode.Uri.parse("/some/fake/uri");
        (fakeUri.query as any) = "[some.profile], {}";
        Poller.pollRequests[fakeUri.path] = {
            msInterval: 500,
            requestFn: async (): Promise<string> => "Hello world!",
            dispose: false,
        };

        const fileDecoration = PollDecorator.provideFileDecoration(fakeUri, {
            isCancellationRequested: false,
            onCancellationRequested: jest.fn(),
        });

        expect(fileDecoration).not.toBe(null);

        // Verify that a file (that is not being polled) has a null decoration
        delete Poller.pollRequests[fakeUri.path];

        const nullDecoration = PollDecorator.provideFileDecoration(fakeUri, {
            isCancellationRequested: false,
            onCancellationRequested: jest.fn(),
        });

        expect(nullDecoration).toBe(null);
    });
});
