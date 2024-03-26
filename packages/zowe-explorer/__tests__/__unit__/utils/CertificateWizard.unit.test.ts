import { Gui } from "@zowe/zowe-explorer-api";
import { CertificateWizard } from "../../../src/utils/CertificateWizard";
import { ExtensionContext, Uri } from "vscode";

describe("CertificateWizard", () => {
    const context = { extensionPath: "some/fake/ext/path" } as unknown as ExtensionContext;

    it("handles the promptCert message", () => {
        const certWizard = new CertificateWizard(context);
        const postMessageMock = jest.spyOn(certWizard.panel.webview, "postMessage").mockImplementation();
        const uri = Uri.file("/a/b/cert.pem");
        const showOpenDialogMock = jest.spyOn(Gui, "showOpenDialog").mockResolvedValueOnce([uri]);
        (certWizard as any).onDidReceiveMessage({
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

    it("handles the promptCertKey message", () => {
        const certWizard = new CertificateWizard(context);
        const postMessageMock = jest.spyOn(certWizard.panel.webview, "postMessage").mockImplementation();
        const uri = Uri.file("/a/b/cert.key.pem");
        const showOpenDialogMock = jest.spyOn(Gui, "showOpenDialog").mockResolvedValueOnce([uri]);
        (certWizard as any).onDidReceiveMessage({
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

    it("handles the submitted message", () => {
        const certWizard = new CertificateWizard(context);
        const resolveMock = jest.spyOn(certWizard.userSubmission, "resolve").mockImplementation();
        (certWizard as any).opts = {
            cert: "/a/b/cert.pem",
            certKey: "/a/b/cert.key.pem",
        };
        (certWizard as any).onDidReceiveMessage({
            command: "submitted",
        });
        expect(resolveMock).toHaveBeenCalledWith((certWizard as any).opts);
    });

    it("handles the ready message", () => {
        const certWizard = new CertificateWizard(context);
        const postMessageMock = jest.spyOn(certWizard.panel.webview, "postMessage").mockImplementation();
        (certWizard as any).onDidReceiveMessage({
            command: "ready",
        });
        (certWizard as any).opts = {
            cert: "/a/b/cert.pem",
            certKey: "/a/b/cert.key.pem",
        };
        expect(postMessageMock).toHaveBeenCalledWith({ opts: (certWizard as any).opts });
    });

    it("handles the close message", () => {
        const certWizard = new CertificateWizard(context);
        const disposeMock = jest.spyOn(certWizard.panel, "dispose").mockImplementation();
        (certWizard as any).onDidReceiveMessage({
            command: "close",
        });

        expect(disposeMock).toHaveBeenCalled();
    });
});
