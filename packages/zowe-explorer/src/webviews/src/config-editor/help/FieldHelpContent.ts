/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * Help content for Config Editor profile fields.
 */

export interface FieldHelp {
    description: string;
    exampleValue?: string;
    validationRules?: string;
    required?: boolean;
}

type ProfileFieldHelp = Record<string, FieldHelp>;
type ProfileTypeHelp = Record<string, ProfileFieldHelp>;

export const PROFILE_FIELD_HELP: ProfileTypeHelp = {
    zosmf: {
        host: {
            description: "Hostname or IP address of the z/OSMF server.",
            exampleValue: "mainframe.example.com",
            validationRules: "Must be a valid hostname or IPv4/IPv6 address.",
            required: true,
        },
        port: {
            description: "Port number on which z/OSMF is listening.",
            exampleValue: "443",
            validationRules: "Must be a number between 1 and 65535.",
            required: true,
        },
        user: {
            description: "Mainframe username used to authenticate with z/OSMF.",
            exampleValue: "IBMUSER",
            required: true,
        },
        password: {
            description: "Password for the mainframe user account.",
            validationRules: "Stored securely in the system keyring when a credential manager is active.",
            required: true,
        },
        rejectUnauthorized: {
            description: "Whether to reject self-signed or untrusted SSL certificates.",
            exampleValue: "false",
            validationRules: "Set to false only in development or when using self-signed certs.",
        },
        basePath: {
            description: "Base path prepended to all z/OSMF REST API requests.",
            exampleValue: "/ibmzosmf/api/v1",
        },
        protocol: {
            description: "HTTP protocol to use when communicating with z/OSMF.",
            exampleValue: "https",
            validationRules: "Accepts 'http' or 'https'. Defaults to 'https'.",
        },
        encoding: {
            description: "Character encoding for data transfer between client and z/OS.",
            exampleValue: "1047",
        },
        responseTimeout: {
            description: "Maximum time in seconds to wait for a z/OSMF API response.",
            exampleValue: "600",
        },
    },
    rse: {
        host: {
            description: "Hostname or IP address of the RSE API server.",
            exampleValue: "mainframe.example.com",
            required: true,
        },
        port: {
            description: "Port number of the RSE API server.",
            exampleValue: "6800",
            required: true,
        },
        user: {
            description: "Mainframe username for RSE API authentication.",
            required: true,
        },
        password: {
            description: "Password for RSE API authentication. Stored securely when a credential manager is active.",
            required: true,
        },
        rejectUnauthorized: {
            description: "Whether to reject self-signed or untrusted SSL certificates.",
            exampleValue: "false",
        },
        basePath: {
            description: "Base path for RSE API requests.",
            exampleValue: "/rseapi",
        },
        protocol: {
            description: "Protocol to use for RSE API communication.",
            exampleValue: "https",
        },
    },
    ssh: {
        host: {
            description: "Hostname or IP address of the z/OS SSH server.",
            exampleValue: "mainframe.example.com",
            required: true,
        },
        port: {
            description: "SSH port number. Defaults to 22.",
            exampleValue: "22",
        },
        user: {
            description: "Username for SSH authentication on z/OS.",
            required: true,
        },
        password: {
            description: "Password for SSH login. Leave empty if using a private key.",
        },
        privateKey: {
            description: "Absolute path to the SSH private key file for key-based authentication.",
            exampleValue: "/home/user/.ssh/id_rsa",
        },
        keyPassphrase: {
            description: "Passphrase to decrypt the SSH private key, if protected.",
        },
        handshakeTimeout: {
            description: "Timeout in milliseconds for the SSH handshake.",
            exampleValue: "5000",
        },
    },
    tso: {
        account: {
            description: "JES account number for TSO address space allocation.",
            exampleValue: "ACCT001",
            required: true,
        },
        characterSet: {
            description: "Character set for TSO session data.",
            exampleValue: "697",
        },
        codePage: {
            description: "EBCDIC code page to use for the TSO session.",
            exampleValue: "1047",
        },
        columns: {
            description: "Screen column width for the TSO terminal session.",
            exampleValue: "80",
        },
        logonProcedure: {
            description: "TSO logon procedure (PROCLIB member) to run at session start.",
            exampleValue: "IKJEFT01",
        },
        regionSize: {
            description: "Region size in kilobytes allocated for the TSO address space.",
            exampleValue: "8192",
        },
        rows: {
            description: "Number of terminal rows for the TSO session.",
            exampleValue: "24",
        },
    },
    base: {
        host: {
            description: "Default hostname shared by all profiles that inherit from this base profile.",
            exampleValue: "mainframe.example.com",
        },
        port: {
            description: "Default port shared by inheriting profiles.",
            exampleValue: "443",
        },
        user: {
            description: "Default mainframe username shared by inheriting profiles.",
        },
        password: {
            description: "Default password for the base profile. Stored securely in the system keyring.",
        },
        rejectUnauthorized: {
            description: "Default SSL verification setting for all inheriting profiles.",
            exampleValue: "false",
        },
        tokenType: {
            description: "Type of authentication token (e.g. apimlAuthenticationToken for API ML SSO).",
            exampleValue: "apimlAuthenticationToken",
        },
        tokenValue: {
            description: "The authentication token value. Obtained via the 'zowe auth login' command.",
        },
    },
};

/**
 * Retrieve help content for a specific profile type and field key.
 * Returns null if no help content is registered.
 */
export function getFieldHelp(profileType: string, fieldKey: string): FieldHelp | null {
    return PROFILE_FIELD_HELP[profileType]?.[fieldKey] ?? null;
}

/**
 * Returns true if help content exists for the given profile type and field key.
 */
export function hasFieldHelp(profileType: string, fieldKey: string): boolean {
    return getFieldHelp(profileType, fieldKey) !== null;
}
