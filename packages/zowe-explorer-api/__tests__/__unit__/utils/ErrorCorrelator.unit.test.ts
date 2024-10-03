import { ErrorCorrelator, ZoweExplorerApiType } from "../../../src/";

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
    it("correctly correlates an error in the list of error matches", () => {});
    it("returns a generic NetworkError with the full error details if no matches are found", () => {});
});

describe("displayError", () => {
    it("calls correlateError to get an error correlation", () => {});
    it("presents an additional dialog when the user selects 'More info'", () => {});
    it("opens the Zowe Explorer output channel when the user selects 'Show log'", () => {});
    it("opens the troubleshoot webview if the user selects 'Troubleshoot'", () => {});
    it("returns 'Retry' whenever the user selects 'Retry'", () => {});
});
