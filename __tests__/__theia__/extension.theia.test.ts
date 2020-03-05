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

import { Builder, By, Key, until } from "selenium-webdriver";
// tslint:disable-next-line:no-submodule-imports
import * as firefox from "selenium-webdriver/firefox";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

const TIMEOUT = 45000;
declare var it: any;

describe("Extension Theia Tests", () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    const firefoxOptions = new firefox.Options();
    firefoxOptions.headless();
    const driver = new Builder().forBrowser("firefox").setFirefoxOptions(firefoxOptions).build();

    it("should open Zowe Explorer and find the Favorites node", async () => {
        await driver.get("http://localhost:3000");
        // tslint:disable-next-line: no-magic-numbers
        await driver.sleep(10000);
        const button = driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe")));
        button.click();
        // tslint:disable-next-line: no-magic-numbers
        const favoriteLink = await driver.wait(until.elementLocated(By.id("/0:Favorites")), 30000).getAttribute("title");
        expect(favoriteLink).to.equal("Favorites");
    }).timeout(TIMEOUT);

    after(async () => driver.quit());
});
