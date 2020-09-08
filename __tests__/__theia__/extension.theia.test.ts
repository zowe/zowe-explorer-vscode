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

import { Builder, By, Key, until, Button } from "selenium-webdriver";
// tslint:disable-next-line:no-submodule-imports
import * as firefox from "selenium-webdriver/firefox";
// tslint:disable-next-line: no-submodule-imports
import * as chrome from "selenium-webdriver/chrome";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

const TIMEOUT = 45000;
const SLEEPTIME = 10000;
const WAITTIME = 30000;
declare var it: any;
const expect = chai.expect;
chai.use(chaiAsPromised);

describe("Add Profiles", () => {

    const firefoxOptions = new firefox.Options();
    // firefoxOptions.headless();
    const driver = new Builder().forBrowser("firefox").setFirefoxOptions(firefoxOptions).build();

    before(async () => {
        await driver.manage().window().maximize();
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))).click();
    });

    it("should open Zowe Explorer and find the Favorites node", async () => {
        const favoriteLink = await driver.wait(until.elementLocated(By.id("/0:Favorites")), WAITTIME).getAttribute("title");
        expect(favoriteLink).to.equal("Favorites");
    }).timeout(TIMEOUT);

    it("should find the Data Sets node", async () => {
        await driver.wait(until.elementLocated(By.id("plugin-view-container:zowe--plugin-view:zowe.explorer")), WAITTIME);
        const datasetLink = await driver.wait(until.elementLocated(By.xpath("//span[@title='Data Sets']")), WAITTIME).getText();
        expect(datasetLink).to.equal("DATA SETS");
    }).timeout(TIMEOUT);

    it("should find the USS node", async () => {
        await driver.wait(until.elementLocated(By.id("plugin-view-container:zowe--plugin-view:zowe.uss.explorer")), WAITTIME);
        const ussLink = await driver.wait(until.elementLocated(By.xpath("//span[@title='Unix System Services (USS)']")), WAITTIME).getText();
        expect(ussLink).to.equal("UNIX SYSTEM SERVICES (USS)");
    }).timeout(TIMEOUT);

    it("should find the Jobs node", async () => {
        await driver.wait(until.elementLocated(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")), WAITTIME);
        const jobsLink = await driver.wait(until.elementLocated(By.xpath("//span[@title='Jobs']")), WAITTIME).getText();
        expect(jobsLink).to.equal("JOBS");
    }).timeout(TIMEOUT);

    it("Should Add Profile in DATA SETS", async () => {
        await driver.findElement(By.id("plugin-view:zowe.explorer")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.addSession")).click();
        await driver.findElement(By.xpath("//*[@class='input empty']")).sendKeys(Key.ENTER);
        const profilename = await driver.wait(until.elementLocated(By.xpath("//*[@class='input empty']")),WAITTIME);
        profilename.sendKeys("TestSeleniumProfile");
        profilename.sendKeys(Key.ENTER);
        const hostport = await driver.findElement(By.xpath("//*[@class='input empty']"));
        hostport.sendKeys("usilca32.lvn.broadcom.net:1443");
        hostport.sendKeys(Key.ENTER);
        const username = await driver.findElement(By.xpath("//*[@class='input empty']"));
        username.sendKeys(Key.ENTER);
        const password = await driver.findElement(By.xpath("//*[@class='input empty']"));
        password.sendKeys(Key.ENTER);
        const auth = await driver.findElement(By.xpath("//*[@class='input empty']"));
        auth.sendKeys("False - Accept connections with self-signed certificates");
        auth.sendKeys(Key.ENTER);
        const basepath = await driver.findElement(By.xpath("//*[@class='input empty']"));
        basepath.sendKeys(Key.ENTER);
        const creatpr = await driver.wait(until.elementLocated(By.id("/1:TestSeleniumProfile")),WAITTIME).getText();
        expect(creatpr).to.equal("TestSeleniumProfile");
    });

    it("Should Add Existing Profile in USS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.explorer']/div[1]/span[2]")).click();
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.uss.explorer")).click();
        await driver.findElement(By.id("plugin-view:zowe.uss.explorer")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.uss.addSession")).click();
        const ussprofilename = await driver.findElement(By.xpath("//*[@class='input empty']"));
        ussprofilename.sendKeys("TestSeleniumProfile");
        ussprofilename.sendKeys(Key.ENTER);
        // tslint:disable-next-line: max-line-length
        const ussprofile = await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[3]/div[2]/div[1]/div/div[1]/div/div/div[2]/div/div/div[3]/div/span")), WAITTIME).getText();
        expect(ussprofile).to.equal("TestSeleniumProfile");
    });

    it("Should Add Existing Profile in JOBS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")).click();
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")).click();
        await driver.findElement(By.id ("zowe.jobs")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.addJobsSession")).click();
        const jobsprofilename = await driver.findElement(By.xpath("//*[@class='input empty']"));
        jobsprofilename.sendKeys("TestSeleniumProfile");
        jobsprofilename.sendKeys(Key.ENTER);
        // tslint:disable-next-line: max-line-length
        const jobsprofile = await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[5]/div[2]/div[1]/div/div[1]/div/div/div[2]/div/div/div[3]/div/span")), WAITTIME).getText();
        expect(jobsprofile).to.equal("TestSeleniumProfile");
    });
    after(async () => driver.quit());
});

describe("Add Profile to Favorites", () => {
    const SLEEPP = 2000;
    const chromeOptions = new chrome.Options();
    // chromeOptions.headless();
    const driver = new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();

    before(async () => {
        await driver.manage().window().maximize();
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))).click();
    });
    it("Should Add Profile to Favorites under DATA SETS", async () => {
        const addfav = await driver.wait(until.elementLocated(By.id("/1:TestSeleniumProfile")),  WAITTIME);
        await driver.actions().click(addfav, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[3]/div[2]")), WAITTIME).click();
        await driver.wait(until.elementLocated(By.xpath("//*[@class='input empty']")), WAITTIME).sendKeys(Key.ENTER);
        await driver.wait(until.elementLocated(By.xpath("//*[@class='input empty']")), WAITTIME).sendKeys(Key.ENTER);
        await driver.wait(until.elementLocated(By.id("/0:Favorites")), WAITTIME).click();
        const favprofile = await driver.wait(until.elementLocated(By.id("/0:Favorites/0:[TestSeleniumProfile]: ")), WAITTIME).getText();
        expect(favprofile).to.equal("[TestSeleniumProfile]: ");
    });
    it("Should Add Profile to Favorites under USS", async () => {
        // tslint:disable-next-line: max-line-length
        await driver.wait(until.elementLocated(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.explorer']/div[1]/span[2]")), WAITTIME).click();
        await driver.sleep(SLEEPP);
        // tslint:disable-next-line: max-line-length
        await driver.wait(until.elementLocated(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")), WAITTIME).click();
        await driver.sleep(SLEEPP);
        const addfav = await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[3]/div[2]/div[1]/div/div[1]/div/div/div[2]/div/div/div[3]/div/span")), WAITTIME);
        await driver.actions().click(addfav, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[3]/div[2]")), WAITTIME).click();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[3]/div[2]/div[1]/div/div[1]/div/div/div[1]/div/div/div[3]/div/span")), WAITTIME).click();
        await driver.sleep(SLEEPP);
        const favprofile = await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[3]/div[2]/div[1]/div/div[1]/div/div/div[2]/div[2]/div/div[2]/div/span")), WAITTIME).getText();
        expect(favprofile).to.equal("[TestSeleniumProfile]: ");
    });
    it("Should Add Profile to Favorites under JOBS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEPP);
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")).click();
        // tslint:disable-next-line: max-line-length
        const addfav = await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[5]/div[2]/div[1]/div/div[1]/div/div/div[2]/div/div/div[3]/div/span")),  WAITTIME);
        await driver.actions().click(addfav, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[6]/div[2]")), WAITTIME).click();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[5]/div[2]/div[1]/div/div[1]/div/div/div[1]/div/div/div[3]/div/span")), WAITTIME).click();
        await driver.sleep(SLEEPP);
        const favprofile = await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[5]/div[2]/div[1]/div/div[1]/div/div/div[2]/div[2]/div/div[2]/div/span")), WAITTIME).getText();
        expect(favprofile).to.equal("[TestSeleniumProfile]: Prefix:*");
    });

    after(async () => driver.quit());
});

describe("Remove Profile from Favorites", () => {
    const SLEEPP = 2000;
    const chromeOptions = new chrome.Options();
    // chromeOptions.headless();
    const driver = new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();

    before(async () => {
        await driver.manage().window().maximize();
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))).click();
    });
    it("Should Remove Profile from Favorites under DATA SETS", async () => {
        await driver.wait(until.elementLocated(By.id("/0:Favorites")), WAITTIME).click();
        const favprofile = await driver.wait(until.elementLocated(By.id("/0:Favorites/0:[TestSeleniumProfile]: ")), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEPP);
        // expect(removepro).to.equal("");
    });
    it("Should Remove Profile from Favorites under USS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEPP);
        // tslint:disable-next-line: max-line-length
        await driver.wait(until.elementLocated(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")), WAITTIME).click();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[3]/div[2]/div[1]/div/div[1]/div/div/div[1]/div/div/div[3]/div/span")), WAITTIME).click();
        const favprofile = await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[3]/div[2]/div[1]/div/div[1]/div/div/div[2]/div[2]/div/div[2]/div/span")), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEPP);
        // expect(removepro).to.equal("");
    });
    it("Should Remove Profile from Favorites under JOBS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEPP);
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")).click();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[5]/div[2]/div[1]/div/div[1]/div/div/div[1]/div/div/div[3]/div/span")), WAITTIME).click();
        const favprofile = await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[5]/div[2]/div[1]/div/div[1]/div/div/div[2]/div[2]/div/div[2]/div/span")), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEPP);
        // expect(removepro).to.equal("");
    });

    after(async () => driver.quit());
});

describe("Delete Profile", () => {
    const SLEEPP = 2000;
    const chromeOptions = new chrome.Options();
    // chromeOptions.headless();
    const driver = new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();

    before(async () => {
        await driver.manage().window().maximize();
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))).click();
    });
    it("Should Delete Profile from DATA SETS", async () => {
        // *************Adding profile for deletion
        await driver.findElement(By.id("plugin-view:zowe.explorer")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.addSession")).click();
        await driver.findElement(By.xpath("//*[@class='input empty']")).sendKeys(Key.ENTER);
        const profilename = await driver.wait(until.elementLocated(By.xpath("//*[@class='input empty']")),WAITTIME);
        profilename.sendKeys("DeleteDSProfile");
        profilename.sendKeys(Key.ENTER);
        const hostport = await driver.findElement(By.xpath("//*[@class='input empty']"));
        hostport.sendKeys("usilca32.lvn.broadcom.net:1443");
        hostport.sendKeys(Key.ENTER);
        const username = await driver.findElement(By.xpath("//*[@class='input empty']"));
        username.sendKeys(Key.ENTER);
        const password = await driver.findElement(By.xpath("//*[@class='input empty']"));
        password.sendKeys(Key.ENTER);
        const auth = await driver.findElement(By.xpath("//*[@class='input empty']"));
        auth.sendKeys("False - Accept connections with self-signed certificates");
        auth.sendKeys(Key.ENTER);
        const basepath = await driver.findElement(By.xpath("//*[@class='input empty']"));
        basepath.sendKeys(Key.ENTER);
        // **************Deletion of added Profile
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/ul/li")), WAITTIME).click();
        await (await driver.wait(until.elementLocated(By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/ul/li")), WAITTIME)).click();
        const favprofile = await driver.wait(until.elementLocated(By.id("/2:DeleteDSProfile")), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[7]/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEPP);
        const delconfm = driver.wait(until.elementLocated(By.xpath("/html/body/div[2]/quick-open-container/div/div[2]/div/div/input")), WAITTIME);
        delconfm.sendKeys("Delete");
        delconfm.sendKeys(Key.ENTER);
        await driver.sleep(SLEEPP);
        // tslint:disable-next-line: max-line-length
        const delmsg = (await driver.wait(until.elementLocated(By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/div[2]/span")), WAITTIME)).getText();
        // console.log("delete msg : "+ delmsg);
        // expect(delmsg).to.equal("Profile DeleteDSProfile was deleted.");
    });
    it("Should Delete Profile from USS", async () => {
        // *************Adding profile for deletion
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEPP);
        // tslint:disable-next-line: max-line-length
        await driver.wait(until.elementLocated(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")), WAITTIME).click();
        await driver.findElement(By.id("zowe.uss.explorer")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.uss.addSession")).click();
        await driver.findElement(By.xpath("//*[@class='input empty']")).sendKeys(Key.ENTER);
        const profilename = await driver.wait(until.elementLocated(By.xpath("//*[@class='input empty']")),WAITTIME);
        profilename.sendKeys("DeleteUSSProfile");
        profilename.sendKeys(Key.ENTER);
        const hostport = await driver.findElement(By.xpath("//*[@class='input empty']"));
        hostport.sendKeys("usilca32.lvn.broadcom.net:1443");
        hostport.sendKeys(Key.ENTER);
        const username = await driver.findElement(By.xpath("//*[@class='input empty']"));
        username.sendKeys(Key.ENTER);
        const password = await driver.findElement(By.xpath("//*[@class='input empty']"));
        password.sendKeys(Key.ENTER);
        const auth = await driver.findElement(By.xpath("//*[@class='input empty']"));
        auth.sendKeys("False - Accept connections with self-signed certificates");
        auth.sendKeys(Key.ENTER);
        const basepath = await driver.findElement(By.xpath("//*[@class='input empty']"));
        basepath.sendKeys(Key.ENTER);
        // **************Deletion of added Profile
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/ul/li")), WAITTIME).click();
        // tslint:disable-next-line: max-line-length
        const favprofile = await driver.wait(until.elementLocated(By.xpath("//html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[3]/div[2]/div[1]/div/div[1]/div/div/div[3]/div/div/div[3]/div/span")), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.sleep(SLEEPP);
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[8]/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEPP);
        const delconfm = driver.wait(until.elementLocated(By.xpath("/html/body/div[2]/quick-open-container/div/div[2]/div/div/input")), WAITTIME);
        delconfm.sendKeys("Delete");
        await driver.sleep(SLEEPP);
        delconfm.sendKeys(Key.ENTER);
        await driver.sleep(SLEEPP);
        // tslint:disable-next-line: max-line-length
        // const delmsg = (await driver.wait(until.elementLocated(By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/div[2]/span")), WAITTIME)).getText();
        // console.log("delete msg : "+delmsg);
        // expect(delmsg).to.equal("Profile DeleteUSSProfile was deleted.");
    });
    it("Should Delete Profile from JOBS", async () => {
        // *************Adding profile for deletion
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEPP);
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")).click();
        await driver.findElement(By.id ("zowe.jobs")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.addJobsSession")).click();
        await driver.findElement(By.xpath("//*[@class='input empty']")).sendKeys(Key.ENTER);
        const profilename = await driver.wait(until.elementLocated(By.xpath("//*[@class='input empty']")),WAITTIME);
        profilename.sendKeys("DeleteJobsProfile");
        profilename.sendKeys(Key.ENTER);
        const hostport = await driver.findElement(By.xpath("//*[@class='input empty']"));
        hostport.sendKeys("usilca32.lvn.broadcom.net:1443");
        hostport.sendKeys(Key.ENTER);
        const username = await driver.findElement(By.xpath("//*[@class='input empty']"));
        username.sendKeys(Key.ENTER);
        const password = await driver.findElement(By.xpath("//*[@class='input empty']"));
        password.sendKeys(Key.ENTER);
        const auth = await driver.findElement(By.xpath("//*[@class='input empty']"));
        auth.sendKeys("False - Accept connections with self-signed certificates");
        auth.sendKeys(Key.ENTER);
        const basepath = await driver.findElement(By.xpath("//*[@class='input empty']"));
        basepath.sendKeys(Key.ENTER);
        // **************Deletion of added Profile
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/ul/li")), WAITTIME).click();
        const favprofile = await driver.wait(until.elementLocated(By.xpath("/html/body/div[1]/div[2]/div[1]/div[2]/div[2]/div[8]/div/div[5]/div[2]/div[1]/div/div[1]/div/div/div[3]/div/div/div[3]/div/span")), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[10]/div[2]")), WAITTIME).click();
        const delconfm = driver.wait(until.elementLocated(By.xpath("/html/body/div[2]/quick-open-container/div/div[2]/div/div/input")), WAITTIME);
        delconfm.sendKeys("Delete");
        await driver.sleep(SLEEPP);
        delconfm.sendKeys(Key.ENTER);
        await driver.sleep(SLEEPP);
        // expect(removepro).to.equal("");
    });

    after(async () => driver.quit());
});
