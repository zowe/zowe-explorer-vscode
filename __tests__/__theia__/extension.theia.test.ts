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

describe("Add Default Profile", () => {
    const firefoxOptions = new firefox.Options();
    firefoxOptions.headless();
    const driver = new Builder().forBrowser("firefox").setFirefoxOptions(firefoxOptions).build();

    before(async () => {
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

    it("Should Add Default Profile in DATA SETS", async () => {
        await driver.findElement(By.id("plugin-view:zowe.explorer")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.addSession")).click();
        await driver.findElement(By.xpath("//*[@class='input empty']")).sendKeys(Key.ENTER);
        const datasetProfileName = await driver.wait(until.elementLocated(By.xpath("//*[@class='input empty']")),WAITTIME);
        datasetProfileName.sendKeys("DefaultProfile");
        datasetProfileName.sendKeys(Key.ENTER);
        const zosUrl = await driver.findElement(By.xpath("//*[@class='input empty']"));
        zosUrl.sendKeys("fakehost.net:1003");
        zosUrl.sendKeys(Key.ENTER);
        const username = await driver.findElement(By.xpath("//*[@class='input empty']"));
        username.sendKeys(Key.ENTER);
        const password = await driver.findElement(By.xpath("//*[@class='input empty']"));
        password.sendKeys(Key.ENTER);
        const authorization = await driver.findElement(By.xpath("//*[@class='input empty']"));
        authorization.sendKeys("False - Accept connections with self-signed certificates");
        authorization.sendKeys(Key.ENTER);
        const basepath = await driver.findElement(By.xpath("//*[@class='input empty']"));
        basepath.sendKeys(Key.ENTER);
        const datasetProfile = await driver.wait(until.elementLocated(By.id("/1:DefaultProfile")),WAITTIME).getText();
        expect(datasetProfile).to.equal("DefaultProfile");
    });

    it("Should Default profile visible in USS", async () => {
        await driver.navigate().refresh();
        await driver.sleep(SLEEPTIME);
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.explorer']/div[1]/span[2]")).click();
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.uss.explorer")).click();
        const ussProfile = await driver.wait(until.elementLocated(By.xpath("(//*[@id='/1:DefaultProfile']/div/span)[2]")), WAITTIME).getText();
        expect(ussProfile).to.equal("DefaultProfile");
    });

    it("Should Default profile visible in JOBS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")).click();
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")).click();
        const jobsProfile = await driver.wait(until.elementLocated(By.xpath("(//*[@id='/1:DefaultProfile']/div/span)[3]")), WAITTIME).getText();
        expect(jobsProfile).to.equal("DefaultProfile");
    });
    after(async () => driver.quit());
});

describe("Add Profiles", () => {
    const firefoxOptions = new firefox.Options();
    firefoxOptions.headless();
    const driver = new Builder().forBrowser("firefox").setFirefoxOptions(firefoxOptions).build();

    before(async () => {
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))).click();
    });

    it("Should Add Profile in DATA SETS", async () => {
        await driver.findElement(By.id("plugin-view:zowe.explorer")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.addSession")).click();
        await driver.findElement(By.xpath("//*[@class='input empty']")).sendKeys(Key.ENTER);
        const datasetProfileName = await driver.wait(until.elementLocated(By.xpath("//*[@class='input empty']")),WAITTIME);
        datasetProfileName.sendKeys("TestSeleniumProfile");
        datasetProfileName.sendKeys(Key.ENTER);
        const zosUrl = await driver.findElement(By.xpath("//*[@class='input empty']"));
        zosUrl.sendKeys("fakehost.net:1003");
        zosUrl.sendKeys(Key.ENTER);
        const username = await driver.findElement(By.xpath("//*[@class='input empty']"));
        username.sendKeys(Key.ENTER);
        const password = await driver.findElement(By.xpath("//*[@class='input empty']"));
        password.sendKeys(Key.ENTER);
        const authorization = await driver.findElement(By.xpath("//*[@class='input empty']"));
        authorization.sendKeys("False - Accept connections with self-signed certificates");
        authorization.sendKeys(Key.ENTER);
        const basepath = await driver.findElement(By.xpath("//*[@class='input empty']"));
        basepath.sendKeys(Key.ENTER);
        const datasetProfile = await driver.wait(until.elementLocated(By.id("/2:TestSeleniumProfile")),WAITTIME).getText();
        expect(datasetProfile).to.equal("TestSeleniumProfile");
    });

    it("Should Add Existing Profile in USS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.explorer']/div[1]/span[2]")).click();
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.uss.explorer")).click();
        await driver.findElement(By.id("plugin-view:zowe.uss.explorer")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.uss.addSession")).click();
        const ussProfileName = await driver.findElement(By.xpath("//*[@class='input empty']"));
        ussProfileName.sendKeys("TestSeleniumProfile");
        ussProfileName.sendKeys(Key.ENTER);
        const ussProfile = await driver.wait(until.elementLocated(By.xpath("(//*[@id='/2:TestSeleniumProfile']/div/span)[2]")), WAITTIME).getText();
        expect(ussProfile).to.equal("TestSeleniumProfile");
    });

    it("Should Add Existing Profile in JOBS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")).click();
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")).click();
        await driver.findElement(By.id ("zowe.jobs")).click();
        await driver.findElement(By.id("__plugin.view.title.action.zowe.addJobsSession")).click();
        const jobsProfileName = await driver.findElement(By.xpath("//*[@class='input empty']"));
        jobsProfileName.sendKeys("TestSeleniumProfile");
        jobsProfileName.sendKeys(Key.ENTER);
        const jobsProfile = await driver.wait(until.elementLocated(By.xpath("(//*[@id='/2:TestSeleniumProfile']/div/span)[3]")), WAITTIME).getText();
        expect(jobsProfile).to.equal("TestSeleniumProfile");
    });
    after(async () => driver.quit());
});

describe("Add Profile to Favorites", () => {
    const SLEEP = 2000;
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments("headless");
    chromeOptions.addArguments("window-size=1200,1100");
    const driver = new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();

    before(async () => {
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))).click();
    });
    it("Should Add Profile to Favorites under DATA SETS", async () => {
        const addTofavorite = await driver.wait(until.elementLocated(By.id("/2:TestSeleniumProfile")),  WAITTIME);
        await driver.actions().click(addTofavorite, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[3]/div[2]")), WAITTIME).click();
        await driver.wait(until.elementLocated(By.id("/0:Favorites")), WAITTIME).click();
        const favoriteProfile = await driver.wait(until.elementLocated(By.id("/0:Favorites/0:[TestSeleniumProfile]: ")), WAITTIME).getText();
        expect(favoriteProfile).to.equal("[TestSeleniumProfile]: ");
    });
    it("Should Add Profile to Favorites under USS", async () => {
        await driver.wait(until.elementLocated(
                                By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.explorer']/div[1]/span[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(
                              By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        const addTofavorite = await driver.wait(until.elementLocated(By.xpath("(//*[@id='/2:TestSeleniumProfile']/div/span)[2]")), WAITTIME);
        await driver.actions().click(addTofavorite, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[3]/div[2]")), WAITTIME).click();
        await driver.wait(until.elementLocated(By.xpath("(//*[@id='/0:Favorites']/div/span)[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        const favoriteProfile = await driver.wait(until.elementLocated(
                                                 By.xpath("(//*[@id='/0:Favorites/0:[TestSeleniumProfile]: ']/div/span)[2]")), WAITTIME).getText();
        expect(favoriteProfile).to.equal("[TestSeleniumProfile]: ");
    });
    it("Should Add Profile to Favorites under JOBS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEP);
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")).click();
        const addTofavorite = await driver.wait(until.elementLocated(By.xpath("(//*[@id='/2:TestSeleniumProfile']/div/span)[3]")),  WAITTIME);
        await driver.actions().click(addTofavorite, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[6]/div[2]")), WAITTIME).click();
        await driver.wait(until.elementLocated(By.xpath("(//*[@id='/0:Favorites']/div/span)[3]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        const favoriteProfile = await driver.wait(until.elementLocated(
                                             By.xpath("//*[@id='/0:Favorites/0:[TestSeleniumProfile]: Prefix:*']/div/span")), WAITTIME).getText();
        expect(favoriteProfile).to.equal("[TestSeleniumProfile]: Prefix:*");
    });

    after(async () => driver.quit());
});

describe("Remove Profile from Favorites", () => {
    const SLEEP = 2000;
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments("headless");
    chromeOptions.addArguments("window-size=1200,1100");
    const driver = new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();

    before(async () => {
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))).click();
    });
    it("Should Remove Profile from Favorites under DATA SETS", async () => {
        await driver.wait(until.elementLocated(By.id("/0:Favorites")), WAITTIME).click();
        const removeFromFavorite = await driver.wait(until.elementLocated(By.id("/0:Favorites/0:[TestSeleniumProfile]: ")), WAITTIME);
        await driver.actions().click(removeFromFavorite, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        // expect(removepro).to.equal("");
    });
    it("Should Remove Profile from Favorites under USS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(
                             By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(By.xpath("(//*[@id='/0:Favorites']/div/span)[2]")), WAITTIME).click();
        const removeFromFavorite = await driver.wait(until.elementLocated(
                                                        By.xpath("//*[@id='/0:Favorites/0:[TestSeleniumProfile]: ']/div/span")), WAITTIME);
        await driver.actions().click(removeFromFavorite, Button.RIGHT).perform();
        await (await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li/div[2]")), WAITTIME)).click();
        await driver.sleep(SLEEP);
        // expect(removepro).to.equal("");
    });

    it("Should Remove Profile from Favorites under JOBS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEP);
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")).click();
        await driver.wait(until.elementLocated(By.xpath("(//*[@id='/0:Favorites']/div/span)[3]")), WAITTIME).click();
        const removeFromFavorite = await driver.wait(until.elementLocated(
                                                        By.xpath("//*[@id='/0:Favorites/0:[TestSeleniumProfile]: Prefix:*']/div/span")), WAITTIME);
        await driver.actions().click(removeFromFavorite, Button.RIGHT).perform();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        // expect(removepro).to.equal("");
    });

    after(async () => driver.quit());
});

describe("Hide Profile", () => {
    const SLEEP = 2000;
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments("headless");
    chromeOptions.addArguments("window-size=1200,1100");
    const driver = new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();

    before(async () => {
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))).click();
    });

    it("Should Hide Profile from USS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(
                            By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        const hideProfileFromUss = await driver.wait(until.elementLocated(By.xpath("(//*[@id='/2:TestSeleniumProfile']/div/span)[2]")), WAITTIME);
        await driver.actions().click(hideProfileFromUss, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[7]/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
    });
    it("Should Hide Profile from JOBS", async () => {
        await driver.findElement(By.xpath("//*[@id='plugin-view-container:zowe--plugin-view:zowe.uss.explorer']/div[1]/span[2]")).click();
        await driver.sleep(SLEEP);
        await driver.findElement(By.id("plugin-view-container:zowe--plugin-view:zowe.jobs")).click();
        const hideProfileFromJobs = await driver.wait(until.elementLocated(By.xpath("(//*[@id='/2:TestSeleniumProfile']/div/span)[2]")), WAITTIME);
        await driver.actions().click(hideProfileFromJobs, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[9]/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
    });

    after(async () => driver.quit());
});

describe("Delete Profiles", () => {
    const SLEEP = 2000;
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments("headless");
    chromeOptions.addArguments("window-size=1200,1100");
    const driver = new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();

    before(async () => {
        await driver.get("http://localhost:3000");
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id("shell-tab-plugin-view-container:zowe"))).click();
    });
    it("Should Delete Default Profile from DATA SETS", async () => {
        (await (await driver).findElement(By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/ul/li"))).click();
        const favprofile = await driver.wait(until.elementLocated(By.id("/1:DefaultProfile")), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[7]/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        const deleteProfile = driver.wait(until.elementLocated(
                                                By.xpath("/html/body/div[2]/quick-open-container/div/div[2]/div/div/input")), WAITTIME);
        deleteProfile.sendKeys("Delete");
        deleteProfile.sendKeys(Key.ENTER);
        await driver.sleep(SLEEP);
        const deleteConfrmationMsg = await driver.wait(until.elementLocated(
                                                By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/div[2]/span")), WAITTIME).getText();
        expect(deleteConfrmationMsg).to.equal("Profile DefaultProfile was deleted.");
    });
    it("Should Delete Profile from DATA SETS", async () => {
        (await (await driver).findElement(By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/ul/li"))).click();
        const favprofile = await driver.wait(until.elementLocated(By.id("/1:TestSeleniumProfile")), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath("/html/body/div[5]/ul/li[7]/div[2]")), WAITTIME).click();
        await driver.sleep(SLEEP);
        const deleteProfile = driver.wait(until.elementLocated(
                                                By.xpath("/html/body/div[2]/quick-open-container/div/div[2]/div/div/input")), WAITTIME);
        deleteProfile.sendKeys("Delete");
        deleteProfile.sendKeys(Key.ENTER);
        await driver.sleep(SLEEP);
        const deleteConfrmationMsg = await driver.wait(until.elementLocated(
                                                By.xpath("/html/body/div[3]/div/div[1]/div/div/div/div/div[2]/span")), WAITTIME).getText();
        expect(deleteConfrmationMsg).to.equal("Profile TestSeleniumProfile was deleted.");
    });

    after(async () => driver.quit());
});
