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

// Don't mock Imperative because we want its AbstractCredentialManager class
jest.unmock("@zowe/imperative");
import { KeytarCredentialManager } from "../../src/KeytarCredentialManager";

describe("KeytarCredentialManager Unit Tests", () => {
    const b64Encode = (x: string) => Buffer.from(x).toString("base64");

    // Use a fake insecure credential store
    const credentialStore: {[key: string]: string} = {
        "Zowe-Plugin_user1": b64Encode("cupcake"),
        "@brightside/core_user2_password": b64Encode("donut"),
        "@zowe/cli_user3": b64Encode("eclair"),
        "Broadcom-Plugin_user4_user": b64Encode("froyo")
    };

    let credentialMgr = new KeytarCredentialManager("Awesome-Service", "");

    // Mock the Keytar module
    KeytarCredentialManager.keytar = {
        getPassword: jest.fn(async (service: string, account: string): Promise<string> => {
            return credentialStore[`${service}_${account}`] || null;
        }),

        setPassword: jest.fn(async (service: string, account: string, password: string) => {
            credentialStore[`${service}_${account}`] = password;
        }),

        deletePassword: jest.fn(async (service: string, account: string): Promise<boolean> => {
            const isManaged: boolean = credentialStore.hasOwnProperty(`${service}_${account}`);
            if (isManaged) {
                delete credentialStore[`${service}_${account}`];
            }
            return isManaged;
        })
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Test loading passwords from credential store", async () => {
        let secret = await credentialMgr.load("user1");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("Zowe-Plugin", "user1");
        expect(secret).toBe("cupcake");

        secret = await credentialMgr.load("user2_pass");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("@brightside/core", "user2_password");
        expect(secret).toBe("donut");

        secret = await credentialMgr.load("user3");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("@zowe/cli", "user3");
        expect(secret).toBe("eclair");

        secret = await credentialMgr.load("user4_username");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("Broadcom-Plugin", "user4_user");
        expect(secret).toBe("froyo");
    });

    it("Test deleting passwords from credential store", async () => {
        await credentialMgr.delete("user3");
        // tslint:disable-next-line no-magic-numbers
        expect(KeytarCredentialManager.keytar.deletePassword).toHaveBeenCalledTimes(5);

        let error;
        try {
            await credentialMgr.load("user3");
        } catch (err) {
            error = err;
        }
        expect(error).toBeDefined();
        expect(error.additionalDetails).toContain("Service = Zowe-Plugin");
        expect(error.additionalDetails).toContain("Awesome-Service\n  Account = user3");

        try {
            await credentialMgr.delete("user5");
        } catch (err) {
            error = err;
        }
        expect(error).toBeDefined();
        expect(error.additionalDetails).toContain("Service = Zowe-Plugin");
        expect(error.additionalDetails).toContain("Awesome-Service\n  Account = user5");
    });

    it("Test saving passwords to credential store", async () => {
        expect(credentialStore["Zowe-Plugin_user1"]).toBeDefined();
        await credentialMgr.save("user1", "cupcake");
        expect(KeytarCredentialManager.keytar.setPassword).toHaveBeenCalledTimes(1);
        expect(KeytarCredentialManager.keytar.setPassword).toHaveBeenLastCalledWith("Awesome-Service", "user1", b64Encode("cupcake"));
        expect(credentialStore["Zowe-Plugin_user1"]).toBeUndefined();

        const secret = await credentialMgr.load("user1");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("Awesome-Service", "user1");
        expect(secret).toBe("cupcake");
    });

    it("Test saving passwords to credential store under previous service name", async () => {
        credentialMgr = new KeytarCredentialManager("@zowe/cli", "");

        expect(credentialStore["@zowe/cli_user5"]).toBeUndefined();
        await credentialMgr.save("user5", "gingerbread");
        expect(KeytarCredentialManager.keytar.setPassword).toHaveBeenCalledTimes(1);
        expect(KeytarCredentialManager.keytar.setPassword).toHaveBeenLastCalledWith("@zowe/cli", "user5", b64Encode("gingerbread"));
        expect(credentialStore["@zowe/cli_user5"]).toBeDefined();
    });
});
