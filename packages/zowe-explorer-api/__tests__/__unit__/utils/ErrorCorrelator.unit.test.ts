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

import { ErrorCorrelator, Gui, NetworkError, ZoweExplorerApiType } from "../../../src/";
import { commands } from "vscode";

describe("addCorrelation", () => {
    it("adds a correlation for the given API and profile type", () => {
        const fakeErrorSummary = "Example error summary for the correlator";
        ErrorCorrelator.getInstance().addCorrelation(ZoweExplorerApiType.Mvs, "zosmf", {
            errorCode: "403",
            summary: fakeErrorSummary,
            matches: ["Specific sequence 1234 encountered"],
        });
        expect(
            (ErrorCorrelator.getInstance() as any).errorMatches.get("zosmf")[ZoweExplorerApiType.Mvs].find((err) => err.summary === fakeErrorSummary)
        ).not.toBe(null);
    });
});

describe("correlateError", () => {
    it("correctly correlates an error in the list of error matches", () => {
        expect(
            ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.Mvs, "zosmf", "Client is not authorized for file access.")
        ).toStrictEqual(
            new NetworkError({
                errorCode: "500",
                summary: "Insufficient write permissions for this data set. The data set may be read-only or locked.",
                tips: [
                    "Check that your user or group has the appropriate permissions for this data set.",
                    "Ensure that the data set is not opened within a mainframe editor tool.",
                ],
            })
        );
    });
    it("returns a generic NetworkError if no matches are available for the given profile type", () => {
        expect(ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.Mvs, "nonsense", "Some error details")).toStrictEqual(
            new NetworkError({ summary: "Some error details" })
        );
    });
    it("returns a generic NetworkError with the full error details if no matches are found", () => {
        expect(
            ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.Mvs, "zosmf", "A cryptic error with no available match")
        ).toStrictEqual(new NetworkError({ summary: "A cryptic error with no available match" }));
    });
});

describe("displayError", () => {
    it("calls correlateError to get an error correlation", async () => {
        const correlateErrorMock = jest
            .spyOn(ErrorCorrelator.prototype, "correlateError")
            .mockReturnValueOnce(new NetworkError({ summary: "Summary of network error" }));
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce(undefined);
        await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "zosmf", "Some error details");
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "zosmf", "Some error details");
        expect(errorMessageMock).toHaveBeenCalledWith("Summary of network error", { items: ["More info"] });
    });
    it("presents an additional dialog when the user selects 'More info'", async () => {
        const correlateErrorMock = jest
            .spyOn(ErrorCorrelator.prototype, "correlateError")
            .mockReturnValueOnce(new NetworkError({ summary: "Summary of network error", fullError: "This is the full error message" }));
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("More info").mockResolvedValueOnce(undefined);
        await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "zosmf", "Some error details");
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "zosmf", "Some error details");
        expect(errorMessageMock).toHaveBeenCalledWith("Summary of network error", { items: ["More info"] });
        expect(errorMessageMock).toHaveBeenCalledWith("This is the full error message", { items: ["Show log", "Troubleshoot"] });
    });
    it("opens the Zowe Explorer output channel when the user selects 'Show log'", async () => {
        const correlateErrorMock = jest
            .spyOn(ErrorCorrelator.prototype, "correlateError")
            .mockReturnValueOnce(new NetworkError({ summary: "Summary of network error", fullError: "This is the full error message" }));
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("More info").mockResolvedValueOnce("Show log");
        const executeCommandMock = jest.spyOn(commands, "executeCommand").mockImplementation();
        await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "zosmf", "Some error details");
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "zosmf", "Some error details");
        expect(errorMessageMock).toHaveBeenCalledWith("Summary of network error", { items: ["More info"] });
        expect(errorMessageMock).toHaveBeenCalledWith("This is the full error message", { items: ["Show log", "Troubleshoot"] });
        expect(executeCommandMock).toHaveBeenCalledWith("zowe.revealOutputChannel");
        executeCommandMock.mockRestore();
    });
    it("opens the troubleshoot webview if the user selects 'Troubleshoot'", async () => {
        const networkError = new NetworkError({ summary: "Summary of network error", fullError: "This is the full error message" });
        const correlateErrorMock = jest.spyOn(ErrorCorrelator.prototype, "correlateError").mockReturnValueOnce(networkError);
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("More info").mockResolvedValueOnce("Troubleshoot");
        const executeCommandMock = jest.spyOn(commands, "executeCommand").mockImplementation();
        await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "zosmf", "Some error details");
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "zosmf", "Some error details");
        expect(errorMessageMock).toHaveBeenCalledWith("Summary of network error", { items: ["More info"] });
        expect(errorMessageMock).toHaveBeenCalledWith("This is the full error message", { items: ["Show log", "Troubleshoot"] });
        expect(executeCommandMock).toHaveBeenCalledWith("zowe.troubleshootError", networkError, undefined);
        executeCommandMock.mockRestore();
    });
    it("returns 'Retry' whenever the user selects 'Retry'", async () => {
        const correlateErrorMock = jest
            .spyOn(ErrorCorrelator.prototype, "correlateError")
            .mockReturnValueOnce(new NetworkError({ summary: "Summary of network error", fullError: "This is the full error message" }));
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("Retry");
        const userResponse = await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "zosmf", "Some error details", {
            allowRetry: true,
        });
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "zosmf", "Some error details");
        expect(errorMessageMock).toHaveBeenCalledWith("Summary of network error", { items: ["Retry", "More info"] });
        expect(userResponse).toBe("Retry");
    });
});