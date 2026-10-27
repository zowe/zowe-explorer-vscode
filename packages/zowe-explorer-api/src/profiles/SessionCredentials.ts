/** SPDX-License-Identifier: EPL-2.0 */
import { AuthOrder, SessConstants, type ICommandArguments, type ISession } from "@zowe/imperative";

/**
 * The full property bag from a merged profile, including inherited/base-profile
 * properties, `authOrder`, and all available credentials.
 *
 * Callers must resolve secure values before supplying this object and preserve
 * the complete property bag so credential selection can honor the user's policy.
 * For Imperative callers, supply the profile contents (such as `IProfileLoaded.profile`).
 * This structural contract keeps Imperative types out of the public API.
 */
export type MergedProfileProperties = Readonly<Record<string, unknown>>;

export type ConnectionAuth = SessionCredentials["type"];

/** Basic selection always includes Imperative's generated or supplied encoded credential. */
export interface BasicAuthCredential {
    readonly type: "basic";
    readonly base64EncodedAuth: string;
    readonly user?: string;
    readonly password?: string;
}

export interface TokenCredential {
    readonly type: "token";
    readonly tokenType: string;
    readonly tokenValue: string;
}

export interface BearerCredential {
    readonly type: "bearer";
    readonly tokenValue: string;
}

export interface PemCertificateCredential {
    readonly type: "cert-pem";
    readonly cert: string;
    readonly certKey: string;
    readonly certAccount?: string;
}

export interface CertificateAccountCredential {
    readonly type: "cert-pem";
    readonly certAccount: string;
    readonly cert?: string;
    readonly certKey?: string;
}

export type CertificateCredential = PemCertificateCredential | CertificateAccountCredential;

/** No credential selected; this is not authorization to send anonymously. */
export interface NoCredential {
    readonly type: "none";
}

export type SessionCredentials = BasicAuthCredential | TokenCredential | BearerCredential | CertificateCredential | NoCredential;

export interface CredentialSelectionDefaults {
    /** Used only when the input has no authOrder. Never replaces an explicit user policy. */
    readonly defaultAuthOrder?: readonly ConnectionAuth[];
}

/**
 * Selects credentials using ZE's Imperative; callers consume the result as plain data.
 * @param profile The full merged property bag, including inherited/base-profile properties,
 * `authOrder`, and all available credentials. Secure values must already be resolved by the caller.
 * @param defaults Caller defaults used only when the profile has no authOrder.
 * @remarks Profile loading, inheritance merging, and secure-value resolution must be completed before calling.
 */
export function getSessionCredentialsFromProfile(profile: MergedProfileProperties, defaults?: CredentialSelectionDefaults): SessionCredentials {
    const args = { ...profile };
    if (args.authOrder == null && defaults?.defaultAuthOrder) args.authOrder = defaults.defaultAuthOrder.join(",");
    const cfg: ISession = {};
    AuthOrder.addCredsToSession(cfg, { $0: "zowe", _: [], ...args } as ICommandArguments);
    switch (cfg.type) {
        case SessConstants.AUTH_TYPE_BASIC:
            if (cfg.base64EncodedAuth) {
                return Object.freeze({
                    type: SessConstants.AUTH_TYPE_BASIC,
                    base64EncodedAuth: cfg.base64EncodedAuth,
                    ...(cfg.user !== undefined ? { user: cfg.user } : {}),
                    ...(cfg.password !== undefined ? { password: cfg.password } : {}),
                });
            }
            break;
        case SessConstants.AUTH_TYPE_TOKEN:
            if (cfg.tokenType && cfg.tokenValue) {
                return Object.freeze({ type: SessConstants.AUTH_TYPE_TOKEN, tokenType: cfg.tokenType, tokenValue: cfg.tokenValue });
            }
            break;
        case SessConstants.AUTH_TYPE_BEARER:
            if (cfg.tokenValue) return Object.freeze({ type: SessConstants.AUTH_TYPE_BEARER, tokenValue: cfg.tokenValue });
            break;
        case SessConstants.AUTH_TYPE_CERT_PEM:
            if (cfg.cert && cfg.certKey) {
                return Object.freeze({
                    type: SessConstants.AUTH_TYPE_CERT_PEM,
                    cert: cfg.cert,
                    certKey: cfg.certKey,
                    ...(cfg.certAccount !== undefined ? { certAccount: cfg.certAccount } : {}),
                });
            }
            if (cfg.certAccount) return Object.freeze({ type: SessConstants.AUTH_TYPE_CERT_PEM, certAccount: cfg.certAccount });
            break;
        case SessConstants.AUTH_TYPE_NONE:
        case undefined:
            return Object.freeze({ type: SessConstants.AUTH_TYPE_NONE });
    }
    // Fail rather than return an object that violates the public credential contract.
    throw new Error("Zowe Explorer selected an incomplete or unsupported credential.");
}
