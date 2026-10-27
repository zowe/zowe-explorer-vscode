/** SPDX-License-Identifier: EPL-2.0 */
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { AuthOrder, SessConstants, type ISession } from "@zowe/imperative";
import {
    type BasicAuthCredential,
    type TokenCredential,
    type BearerCredential,
    type CertificateCredential,
    type NoCredential,
    type SessionCredentials,
    getSessionCredentialsFromProfile,
} from "../../../src/profiles/SessionCredentials";
const both = { user: "u", password: "p", tokenType: "apimlAuthenticationToken", tokenValue: "token" };
describe("profile credential selection", () => {
    it("uses Imperative defaults when no caller default is supplied", () => {
        const selected = getSessionCredentialsFromProfile(both);
        expect(selected.type).toBe(SessConstants.AUTH_TYPE_BASIC);
        expect(selected).not.toHaveProperty("tokenValue");
    });
    it("honors an explicit order over a caller default without mutating the profile", () => {
        const profile = Object.freeze({ ...both, authOrder: "token,basic" });
        expect(getSessionCredentialsFromProfile(profile, { defaultAuthOrder: [SessConstants.AUTH_TYPE_BASIC] })).toEqual({
            type: SessConstants.AUTH_TYPE_TOKEN,
            tokenType: "apimlAuthenticationToken",
            tokenValue: "token",
        });
    });
    it("can express a caller default only when the user did not set one", () => {
        expect(
            getSessionCredentialsFromProfile(both, { defaultAuthOrder: [SessConstants.AUTH_TYPE_TOKEN, SessConstants.AUTH_TYPE_BASIC] }).type
        ).toBe(SessConstants.AUTH_TYPE_TOKEN);
        expect(getSessionCredentialsFromProfile({ ...both, authOrder: "none" }, { defaultAuthOrder: [SessConstants.AUTH_TYPE_TOKEN] })).toEqual({
            type: SessConstants.AUTH_TYPE_NONE,
        });
    });
    it("does not substitute Basic when the configured credential is unavailable", () => {
        expect(getSessionCredentialsFromProfile({ user: "u", password: "p", authOrder: "token" })).toEqual({ type: SessConstants.AUTH_TYPE_NONE });
    });
    it("preserves the selected credential even when the caller does not support it", () => {
        const selected = getSessionCredentialsFromProfile({ ...both, certFile: "cert", certKeyFile: "key", authOrder: "cert-pem,basic" });
        expect(selected.type).toBe(SessConstants.AUTH_TYPE_CERT_PEM);
        expect(selected).not.toHaveProperty("password");
    });
    it("returns complete typed token and bearer variants", () => {
        const token = getSessionCredentialsFromProfile({ ...both, authOrder: SessConstants.AUTH_TYPE_TOKEN });
        if (token.type !== SessConstants.AUTH_TYPE_TOKEN) throw new Error("Expected token selection");
        expectTypeOf(token).toEqualTypeOf<TokenCredential>();
        expect(token.tokenType).toBe("apimlAuthenticationToken");
        expect(token.tokenValue).toBe("token");
        expect(Object.isFrozen(token)).toBe(true);

        const bearer = getSessionCredentialsFromProfile({ tokenValue: "bearer", authOrder: SessConstants.AUTH_TYPE_BEARER });
        if (bearer.type !== SessConstants.AUTH_TYPE_BEARER) throw new Error("Expected bearer selection");
        expectTypeOf(bearer).toEqualTypeOf<BearerCredential>();
        expect(bearer.tokenValue).toBe("bearer");
        expect(bearer).not.toHaveProperty("tokenType");
    });
    it("preserves encoded-only Basic credentials", () => {
        const basic = getSessionCredentialsFromProfile({ base64EncodedAuth: "dTpw", authOrder: SessConstants.AUTH_TYPE_BASIC });
        if (basic.type !== SessConstants.AUTH_TYPE_BASIC) throw new Error("Expected Basic selection");
        expectTypeOf(basic).toEqualTypeOf<BasicAuthCredential>();
        expect(basic.base64EncodedAuth).toBe("dTpw");
        expect(basic).not.toHaveProperty("user");
    });
    it("supports certificate files and a certificate account", () => {
        const files = getSessionCredentialsFromProfile({ certFile: "cert", certKeyFile: "key", authOrder: SessConstants.AUTH_TYPE_CERT_PEM });
        expect(files).toEqual({ type: SessConstants.AUTH_TYPE_CERT_PEM, cert: "cert", certKey: "key" });
        const account = getSessionCredentialsFromProfile({ certAccount: "account", authOrder: SessConstants.AUTH_TYPE_CERT_PEM });
        expect(account).toEqual({ type: SessConstants.AUTH_TYPE_CERT_PEM, certAccount: "account" });
        expect(Object.isFrozen(account)).toBe(true);
        const filesAndAccount = getSessionCredentialsFromProfile({
            certFile: "cert",
            certKeyFile: "key",
            certAccount: "account",
            authOrder: SessConstants.AUTH_TYPE_CERT_PEM,
        });
        expect(filesAndAccount).toEqual({ type: SessConstants.AUTH_TYPE_CERT_PEM, cert: "cert", certKey: "key", certAccount: "account" });
    });
    it("narrows every variant without a consumer cast", () => {
        const narrow = (credential: SessionCredentials): string => {
            switch (credential.type) {
                case SessConstants.AUTH_TYPE_BASIC:
                    expectTypeOf(credential).toEqualTypeOf<BasicAuthCredential>();
                    return credential.base64EncodedAuth;
                case SessConstants.AUTH_TYPE_TOKEN:
                    expectTypeOf(credential).toEqualTypeOf<TokenCredential>();
                    return credential.tokenType + credential.tokenValue;
                case SessConstants.AUTH_TYPE_BEARER:
                    expectTypeOf(credential).toEqualTypeOf<BearerCredential>();
                    return credential.tokenValue;
                case SessConstants.AUTH_TYPE_CERT_PEM:
                    expectTypeOf(credential).toEqualTypeOf<CertificateCredential>();
                    return credential.certAccount ?? credential.cert ?? "";
                case SessConstants.AUTH_TYPE_NONE:
                    expectTypeOf(credential).toEqualTypeOf<NoCredential>();
                    return "";
                default:
                    expectTypeOf(credential).toEqualTypeOf<never>();
                    return credential;
            }
        };
        expect(narrow(getSessionCredentialsFromProfile(both))).toBe("dTpw");
    });

    describe("SDK credential validation", () => {
        beforeEach(() => {
            vi.restoreAllMocks();
        });
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it.each<{ description: string; selected: ISession }>([
            { description: "Basic authentication without an encoded credential", selected: { type: SessConstants.AUTH_TYPE_BASIC } },
            { description: "a named token without its type", selected: { type: SessConstants.AUTH_TYPE_TOKEN, tokenValue: "token" } },
            {
                description: "a named token without its value",
                selected: { type: SessConstants.AUTH_TYPE_TOKEN, tokenType: "apimlAuthenticationToken" },
            },
            { description: "a bearer token without its value", selected: { type: SessConstants.AUTH_TYPE_BEARER } },
            { description: "a certificate without its private key", selected: { type: SessConstants.AUTH_TYPE_CERT_PEM, cert: "cert" } },
            { description: "a private key without its certificate", selected: { type: SessConstants.AUTH_TYPE_CERT_PEM, certKey: "key" } },
        ])("rejects $description", ({ selected }) => {
            vi.spyOn(AuthOrder, "addCredsToSession").mockImplementationOnce((session) => {
                Object.assign(session, selected);
            });

            expect(() => getSessionCredentialsFromProfile(both)).toThrow("Zowe Explorer selected an incomplete or unsupported credential.");
        });

        it.each([SessConstants.AUTH_TYPE_NONE, undefined] as const)("returns no credential when the SDK selects %s", (type) => {
            vi.spyOn(AuthOrder, "addCredsToSession").mockImplementationOnce((session) => {
                session.type = type;
            });

            const selected = getSessionCredentialsFromProfile(both);
            expect(selected).toEqual({ type: SessConstants.AUTH_TYPE_NONE });
            expect(Object.isFrozen(selected)).toBe(true);
        });

        it("rejects an authentication type the API does not support", () => {
            vi.spyOn(AuthOrder, "addCredsToSession").mockImplementationOnce((session) => {
                Object.assign(session, { type: "unsupported" });
            });

            expect(() => getSessionCredentialsFromProfile(both)).toThrow("Zowe Explorer selected an incomplete or unsupported credential.");
        });
    });
});
