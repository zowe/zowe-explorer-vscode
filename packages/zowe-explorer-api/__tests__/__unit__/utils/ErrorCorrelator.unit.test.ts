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

import { ErrorCorrelator, Gui, CorrelatedError, ZoweExplorerApiType } from "../../../src/";
import { commands } from "vscode";

describe("addCorrelation", () => {
    it("adds a correlation for the given API and existing profile type", () => {
        const fakeErrorSummary = "Example error summary for the correlator";
        ErrorCorrelator.getInstance().addCorrelation(ZoweExplorerApiType.Mvs, "zosmf", {
            errorCode: "403",
            summary: fakeErrorSummary,
            matches: ["Specific sequence 1234 encountered"],
        });
        expect(
            (ErrorCorrelator.getInstance() as any).errorMatches.get(ZoweExplorerApiType.Mvs)["zosmf"].find((err) => err.summary === fakeErrorSummary)
        ).not.toBe(null);
    });
    it("adds a correlation for the given API and new profile type", () => {
        const fakeErrorSummary = "Example error summary for the correlator";
        ErrorCorrelator.getInstance().addCorrelation(ZoweExplorerApiType.Mvs, "fake-type", {
            errorCode: "403",
            summary: fakeErrorSummary,
            matches: ["Specific sequence 5678 encountered"],
        });
        expect(
            (ErrorCorrelator.getInstance() as any).errorMatches
                .get(ZoweExplorerApiType.Mvs)
                ["fake-type"].find((err) => err.summary === fakeErrorSummary)
        ).not.toBe(null);
    });
});

describe("correlateError", () => {
    it("correctly correlates an error in the list of error matches", () => {
        expect(
            ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.Mvs, "Client is not authorized for file access.", {
                profileType: "zosmf",
            })
        ).toStrictEqual(
            new CorrelatedError({
                correlation: {
                    errorCode: "500",
                    summary: "Insufficient write permissions for this data set. The data set may be read-only or locked.",
                    tips: [
                        "Check that your user or group has the appropriate permissions for this data set.",
                        "Ensure that the data set is not opened within a mainframe editor tool.",
                    ],
                },
                errorCode: "500",
                initialError: "Client is not authorized for file access.",
            })
        );
    });
    it("returns a generic CorrelatedError if no matches are available for the given profile type", () => {
        expect(
            ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "nonsense" })
        ).toStrictEqual(new CorrelatedError({ initialError: "This is the full error message" }));
    });
    it("returns a generic CorrelatedError with the full error details if no matches are found", () => {
        expect(
            ErrorCorrelator.getInstance().correlateError(ZoweExplorerApiType.Mvs, "A cryptic error with no available match", { profileType: "zosmf" })
        ).toStrictEqual(new CorrelatedError({ initialError: "A cryptic error with no available match" }));
    });
});

describe("displayError", () => {
    it("calls correlateError to get an error correlation", async () => {
        const correlateErrorMock = jest
            .spyOn(ErrorCorrelator.prototype, "correlateError")
            .mockReturnValueOnce(new CorrelatedError({ initialError: "Summary of network error" }));
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce(undefined);
        await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "zosmf" });
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "zosmf" });
        expect(errorMessageMock).toHaveBeenCalledWith("Summary of network error", { items: ["More info"] });
    });
    it("presents an additional dialog when the user selects 'More info'", async () => {
        const correlateErrorMock = jest
            .spyOn(ErrorCorrelator.prototype, "correlateError")
            .mockReturnValueOnce(
                new CorrelatedError({ correlation: { summary: "Summary of network error" }, initialError: "This is the full error message" })
            );
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("More info").mockResolvedValueOnce(undefined);
        await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "zosmf" });
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "zosmf" });
        expect(errorMessageMock).toHaveBeenCalledWith("Summary of network error", { items: ["More info"] });
        expect(errorMessageMock).toHaveBeenCalledWith("This is the full error message", { items: ["Show log", "Troubleshoot"] });
    });
    it("opens the Zowe Explorer output channel when the user selects 'Show log'", async () => {
        const correlateErrorMock = jest
            .spyOn(ErrorCorrelator.prototype, "correlateError")
            .mockReturnValueOnce(
                new CorrelatedError({ correlation: { summary: "Summary of network error" }, initialError: "This is the full error message" })
            );
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("More info").mockResolvedValueOnce("Show log");
        const executeCommandMock = jest.spyOn(commands, "executeCommand").mockImplementation();
        await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "zosmf" });
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "zosmf" });
        expect(errorMessageMock).toHaveBeenCalledWith("Summary of network error", { items: ["More info"] });
        expect(errorMessageMock).toHaveBeenCalledWith("This is the full error message", { items: ["Show log", "Troubleshoot"] });
        expect(executeCommandMock).toHaveBeenCalledWith("zowe.revealOutputChannel");
        executeCommandMock.mockRestore();
    });
    it("opens the troubleshoot webview if the user selects 'Troubleshoot'", async () => {
        const error = new CorrelatedError({
            correlation: { summary: "Summary of network error" },
            initialError: "This is the full error message",
        });
        const correlateErrorMock = jest.spyOn(ErrorCorrelator.getInstance(), "correlateError").mockReturnValueOnce(error);
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("More info").mockResolvedValueOnce("Troubleshoot");
        const executeCommandMock = jest.spyOn(commands, "executeCommand").mockImplementation();
        await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "zosmf" });
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "zosmf" });
        expect(errorMessageMock).toHaveBeenCalledWith("Summary of network error", { items: ["More info"] });
        expect(errorMessageMock).toHaveBeenCalledWith("This is the full error message", { items: ["Show log", "Troubleshoot"] });
        expect(executeCommandMock).toHaveBeenCalledWith("zowe.troubleshootError", error, error.stack);
        executeCommandMock.mockRestore();
    });
});

describe("displayCorrelatedError", () => {
    it("returns 'Retry' whenever the user selects 'Retry'", async () => {
        const error = new CorrelatedError({
            correlation: { summary: "Summary of network error" },
            initialError: "This is the full error message",
        });
        const correlateErrorMock = jest.spyOn(ErrorCorrelator.getInstance(), "correlateError").mockReturnValueOnce(error);
        const errorMessageMock = jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce("Retry");
        const userResponse = await ErrorCorrelator.getInstance().displayError(ZoweExplorerApiType.Mvs, "This is the full error message", {
            additionalContext: "Some additional context",
            allowRetry: true,
            profileType: "zosmf",
        });
        expect(correlateErrorMock).toHaveBeenCalledWith(ZoweExplorerApiType.Mvs, "This is the full error message", { profileType: "zosmf" });
        expect(errorMessageMock).toHaveBeenCalledWith("Some additional context: Summary of network error", { items: ["Retry", "More info"] });
        expect(userResponse).toBe("Retry");
    });
});
