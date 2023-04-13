import { Poller } from "@zowe/zowe-explorer-api/src/utils";
import { PollDecorator } from "../../../src/utils/DecorationProviders";
import * as vscode from "vscode";

jest.mock("vscode");

describe("DecorationProviders - unit tests", () => {
    it("disposes the provider without errors", () => {
        try {
            PollDecorator.dispose();
        } catch (err) {
            fail("PollDecorator.dispose should not throw an error.");
        }
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
