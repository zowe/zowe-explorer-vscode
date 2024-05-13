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

import { Gui } from "@zowe/zowe-explorer-api";
import { CertificateWizard } from "../../../src/utils/CertificateWizard";
import { ExtensionContext, Uri } from "vscode";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

describe("CertificateWizard", () => {
    const context = { extensionPath: "some/fake/ext/path" } as unknown as ExtensionContext;

    it("handles the promptCert message", async () => {
        const certWizard = new CertificateWizard(context, {
            cert: "/a/b/cert.pem",
            certKey: "/a/b/cert.key.pem",
        });
        const postMessageMock = jest.spyOn(certWizard.panel.webview, "postMessage").mockImplementation();
        const uri = Uri.file("/a/b/cert.pem");
        const showOpenDialogMock = jest.spyOn(Gui, "showOpenDialog").mockResolvedValueOnce([uri]);
        await (certWizard as any).onDidReceiveMessage({
            command: "promptCert",
        });
        expect(showOpenDialogMock).toHaveBeenCalled();
        expect((certWizard as any).opts.cert).toBe(uri.fsPath);
        expect(postMessageMock).toHaveBeenCalledWith({
            opts: {
                cert: uri.fsPath,
            },
        });
    });

    it("handles the promptCertKey message", async () => {
        const certWizard = new CertificateWizard(context, {
            cert: "/a/b/cert.pem",
            certKey: "/a/b/cert.key.pem",
        });
        const postMessageMock = jest.spyOn(certWizard.panel.webview, "postMessage").mockImplementation();
        const uri = Uri.file("/a/b/cert.key.pem");
        const showOpenDialogMock = jest.spyOn(Gui, "showOpenDialog").mockResolvedValueOnce([uri]);
        await (certWizard as any).onDidReceiveMessage({
            command: "promptCertKey",
        });
        expect(showOpenDialogMock).toHaveBeenCalled();
        expect((certWizard as any).opts.certKey).toBe(uri.fsPath);
        expect(postMessageMock).toHaveBeenCalledWith({
            opts: {
                certKey: uri.fsPath,
            },
        });
    });

    it("handles the submitted message", async () => {
        const certWizard = new CertificateWizard(context, {
            cert: "/a/b/cert.pem",
            certKey: "/a/b/cert.key.pem",
        });
        const resolveMock = jest.spyOn(certWizard.userSubmission, "resolve").mockImplementation();
        (certWizard as any).opts = {
            cert: "/a/b/cert.pem",
            certKey: "/a/b/cert.key.pem",
        };
        await (certWizard as any).onDidReceiveMessage({
            command: "submitted",
        });
        expect(resolveMock).toHaveBeenCalledWith((certWizard as any).opts);
    });

    it("handles the ready message", async () => {
        const certWizard = new CertificateWizard(context, {
            cert: "/a/b/cert.pem",
            certKey: "/a/b/cert.key.pem",
        });
        const postMessageMock = jest.spyOn(certWizard.panel.webview, "postMessage").mockImplementation();
        await (certWizard as any).onDidReceiveMessage({
            command: "ready",
        });
        (certWizard as any).opts = {
            cert: "/a/b/cert.pem",
            certKey: "/a/b/cert.key.pem",
        };
        expect(postMessageMock).toHaveBeenCalledWith({ opts: (certWizard as any).opts });
    });

    it("handles the close message", async () => {
        const certWizard = new CertificateWizard(context, {
            cert: "/a/b/cert.pem",
            certKey: "/a/b/cert.key.pem",
        });
        Object.defineProperty(certWizard.panel, "dispose", {
            value: jest.fn(),
        });
        const traceMock = jest.spyOn(ZoweLogger, "trace").mockImplementation();
        await (certWizard as any).onDidReceiveMessage({
            command: "close",
        });
        expect(traceMock).toHaveBeenCalledWith("User dismissed the certificate wizard.");
    });
});
