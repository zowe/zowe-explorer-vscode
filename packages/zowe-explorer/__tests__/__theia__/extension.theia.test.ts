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
const SLEEPTIME = 10000;
const WAITTIME = 30000;
declare var it: any;

describe("Extension Theia Tests", () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    const firefoxOptions = new firefox.Options();
    firefoxOptions.headless();
    const driver = new Builder()
        .forBrowser("firefox")
        .setFirefoxOptions(firefoxOptions)
        .build();

    it("should open Zowe Explorer and find the Favorites node", async () => {
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        const button = driver.wait(
            until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))
        );
        button.click();
        const favoriteLink = await driver
            .wait(until.elementLocated(By.id("/0:Favorites")), WAITTIME)
            .getAttribute("title");
        expect(favoriteLink).to.equal("Favorites");
    }).timeout(TIMEOUT);

    it("should find the Data Sets node", async () => {
        await driver.wait(
            until.elementLocated(
                By.id("plugin-view-container:zowe--plugin-view:zowe.explorer")
            ),
            WAITTIME
        );
        const datasetLink = await driver
            .wait(
                until.elementLocated(By.xpath("//span[@title='Data Sets']")),
                WAITTIME
            )
            .getText();
        expect(datasetLink).to.equal("DATA SETS");
    }).timeout(TIMEOUT);

    it("should find the USS node", async () => {
        await driver.wait(
            until.elementLocated(
                By.id("plugin-view-container:zowe--plugin-view:zowe.uss.explorer")
            ),
            WAITTIME
        );
        const ussLink = await driver
            .wait(
                until.elementLocated(
                    By.xpath("//span[@title='Unix System Services (USS)']")
                ),
                WAITTIME
            )
            .getText();
        expect(ussLink).to.equal("UNIX SYSTEM SERVICES (USS)");
    }).timeout(TIMEOUT);

    it("should find the Jobs node", async () => {
        await driver.wait(
            until.elementLocated(
                By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")
            ),
            WAITTIME
        );
        const jobsLink = await driver
            .wait(until.elementLocated(By.xpath("//span[@title='Jobs']")), WAITTIME)
            .getText();
        expect(jobsLink).to.equal("JOBS");
    }).timeout(TIMEOUT);

    after(async () => driver.quit());
});
