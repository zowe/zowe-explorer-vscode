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

const KeytarCredentialManager = require("../../src/KeytarCredentialManager");

describe("KeytarCredentialManager Unit Tests", () => {
    // Use a fake insecure credential store
    const credentialStore: {[key: string]: string} = {
        "Zowe-Plugin_user1": "cupcake",
        "@brightside/core_user2": "donut",
        "@zowe/cli_user3": "eclair",
        "Broadcom-Plugin_user4": "froyo"
    };

    let credentialMgr: any;

    // Mock the Keytar module
    KeytarCredentialManager.keytar = {
        getPassword: jest.fn((service: string, account: string): string => {
            return credentialStore[`${service}_${account}`];
        }),

        setPassword: jest.fn((service: string, account: string, password: string) => {
            credentialStore[`${service}_${account}`] = password;
        }),

        deletePassword: jest.fn((service: string, account: string) => {
            delete credentialStore[`${service}_${account}`];
        })
    };

    beforeAll(async () => {
        credentialMgr = new KeytarCredentialManager("Awesome-Service", "");
        await credentialMgr.initialize();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("Test loading passwords from credential store", async () => {
        let secret = await credentialMgr.load("user1");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("Zowe-Plugin", "user1");
        expect(secret).toBe("cupcake");

        secret = await credentialMgr.load("user2");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("@brightside/core", "user2");
        expect(secret).toBe("donut");

        secret = await credentialMgr.load("user3");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("@zowe/cli", "user3");
        expect(secret).toBe("eclair");

        secret = await credentialMgr.load("user4");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("Broadcom-Plugin", "user4");
        expect(secret).toBe("froyo");
    });

    it("Test deleting passwords from credential store", async () => {
        await credentialMgr.delete("user3");
        expect(KeytarCredentialManager.keytar.deletePassword).toHaveBeenLastCalledWith("Broadcom-Plugin", "user3");

        const secret = await credentialMgr.load("user3");
        expect(secret).toBeUndefined();
    });

    it("Test saving passwords to credential store", async () => {
        expect(credentialMgr["Zowe-Plugin_user1"]).toBeDefined();
        await credentialMgr.save("user1", "cupcake");
        expect(KeytarCredentialManager.keytar.setPassword).toHaveBeenLastCalledWith("Awesome-Service", "user1", "cupcake");
        expect(credentialMgr["Zowe-Plugin_user1"]).toBeUndefined();

        const secret = await credentialMgr.load("user1");
        expect(KeytarCredentialManager.keytar.getPassword).toHaveBeenLastCalledWith("Awesome-Service", "user1");
        expect(secret).toBe("cupcake");
    });
});
