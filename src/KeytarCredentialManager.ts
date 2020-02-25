/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

import { AbstractCredentialManager, ImperativeError, SecureCredential } from "@zowe/imperative";
import * as nls from "vscode-nls";

// Localization support
const localize = nls.config({messageFormat: nls.MessageFormat.file})();

/**
 * Keytar - Securely store user credentials in the system keychain
 *
 * @export
 * @class KeytarCredentialManager
 */
export class KeytarCredentialManager extends AbstractCredentialManager {
    /**
     * Reference to the lazily loaded keytar module.
     *
     * @public
     */
    public static keytar: any;

    /**
     * Combined list of services that credentials may be stored under
     */
    private allServices: string[] = ["Zowe-Plugin", "@brightside/core", "@zowe/cli", "Broadcom-Plugin"];

    /**
     * Preferred service name to store credentials with
     */
    private preferredService: string;

    /**
     * Pass-through to the superclass constructor.
     *
     * @param {string} service The service string to send to the superclass constructor.
     * @param {string} displayName The display name for this credential manager to send to the superclass constructor
     */
    constructor(service: string, displayName: string) {
        // Always ensure that a manager instantiates the super class, even if the
        // constructor doesn't do anything. Who knows what things might happen in
        // the abstract class initialization in the future.
        super(service, displayName);

        if (this.allServices.indexOf(service) === -1) {
            this.allServices.push(service);
        }

        this.preferredService = service;
    }

    /**
     * Calls the keytar deletePassword service with {@link DefaultCredentialManager#service} and the
     * account passed to the function by Imperative.
     *
     * @param {string} account The account for which to delete the password
     *
     * @returns {Promise<void>} A promise that the function has completed.
     *
     * @throws {@link ImperativeError} if keytar is not defined.
     * @throws {@link ImperativeError} when keytar.deletePassword returns false.
     */
    protected async deleteCredentials(account: string): Promise<void> {
        if (!await this.deleteCredentialsHelper(account)) {
            throw new ImperativeError({
                msg: localize("errorHandling.deleteCredentials", "Unable to delete credentials."),
                additionalDetails: this.getMissingEntryMessage(account)
            });
        }
    }

    /**
     * Calls the keytar getPassword service with {@link DefaultCredentialManager#service} and the
     * account passed to the function by Imperative.
     *
     * @param {string} account The account for which to get credentials
     * @returns {Promise<SecureCredential>} A promise containing the credentials stored in keytar.
     *
     * @throws {@link ImperativeError} if keytar is not defined.
     * @throws {@link ImperativeError} when keytar.getPassword returns null or undefined.
     */
    protected async loadCredentials(account: string): Promise<SecureCredential> {
        // Helper function to handle all breaking changes
        const loadHelper = async (service: string) => {
            let secureValue: string = await KeytarCredentialManager.keytar.getPassword(service, account);
            // Handle user vs username case // Zowe v1 -> v2 (i.e. @brightside/core@2.x -> @zowe/cli@6+ )
            if (secureValue == null && account.endsWith("_username")) {
                secureValue = await KeytarCredentialManager.keytar.getPassword(service, account.replace("_username", "_user"));
            }
            // Handle pass vs password case // Zowe v0 -> v1 (i.e. @brightside/core@1.x -> @brightside/core@2.x)
            if (secureValue == null && account.endsWith("_pass")) {
                secureValue = await KeytarCredentialManager.keytar.getPassword(service, account.replace("_pass", "_password"));
            }
            return secureValue;
        };

        let password;

        // Check for stored credentials under each of the known services
        // We will stop checking once we find them somewhere
        for (const service of this.allServices) {
            password = await loadHelper(service);

            if (password != null) {
                break;
            }
        }

        // Throw an error if credentials could not be found
        if (password == null) {
            throw new ImperativeError({
                msg: localize("errorHandling.loadCredentials", "Unable to load credentials."),
                additionalDetails: this.getMissingEntryMessage(account)
            });
        }

        return password;
    }

    /**
     * Calls the keytar setPassword service with {@link DefaultCredentialManager#service} and the
     * account and credentials passed to the function by Imperative.
     *
     * @param {string} account The account to set credentials
     * @param {SecureCredential} credentials The credentials to store
     *
     * @returns {Promise<void>} A promise that the function has completed.
     *
     * @throws {@link ImperativeError} if keytar is not defined.
     */
    protected async saveCredentials(account: string, credentials: SecureCredential): Promise<void> {
        await this.deleteCredentialsHelper(account, true);
        await KeytarCredentialManager.keytar.setPassword(this.preferredService, account, credentials);
    }

    private async deleteCredentialsHelper(account: string, skipPreferredService?: boolean): Promise<boolean> {
        let wasDeleted = false;
        for (const service of this.allServices) {
            if (skipPreferredService && service === this.preferredService) {
                continue;
            }
            if (await KeytarCredentialManager.keytar.deletePassword(service, account)) {
                wasDeleted = true;
            }
        }
        return wasDeleted;
    }

    private getMissingEntryMessage(account: string) {
        return localize("credentials.missingEntryMessage.1", "Could not find an entry in the credential vault for the following:\n") +
            localize("credentials.missingEntryMessage.2", "  Service = {0}\n", this.allServices.join(", ")) +
            localize("credentials.missingEntryMessage.3", "  Account = {0}\n\n", account) +
            localize("credentials.missingEntryMessage.4", "Possible Causes:\n") +
            localize("credentials.missingEntryMessage.5", "  This could have been caused by any manual removal of credentials from your vault.\n\n") +
            localize("credentials.missingEntryMessage.6", "Resolutions:\n") +
            localize("credentials.missingEntryMessage.7", "  Recreate the credentials in the vault for the particular service in the vault.");
    }
}
