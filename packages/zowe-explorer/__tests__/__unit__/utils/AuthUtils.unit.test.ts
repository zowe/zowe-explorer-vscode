import { imperative } from "@zowe/zowe-explorer-api";
import { AuthUtils } from "../../../src/utils/AuthUtils";

describe("AuthUtils", () => {
    describe("promptForAuthError", () => {
        it("should prompt for authentication", async () => {
            const errorDetails = new imperative.ImperativeError({
                errorCode: 401 as unknown as string,
                msg: "All configured authentication methods failed",
            });
            const profile = { type: "zosmf" } as any;
            const promptForAuthenticationMock = jest
                .spyOn(AuthUtils, "promptForAuthentication")
                .mockImplementation(async () => Promise.resolve(true));
            AuthUtils.promptForAuthError(errorDetails, profile);
            expect(promptForAuthenticationMock).toHaveBeenCalledWith(errorDetails, profile);
        });
    });
});
