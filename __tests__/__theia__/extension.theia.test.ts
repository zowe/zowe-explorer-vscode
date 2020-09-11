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
import { TheiaLocator, DatasetsLocators, UssLocators, JobsLocators, TheiaNotificationMessages } from "../../src/theia/Locators";

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
        await driver.get(TheiaLocator.theiaUrl);
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxpath))).click();
    });

    it("should open Zowe Explorer and find the Favorites node", async () => {
        const favoriteLink = await driver.wait(until.elementLocated(By.id(DatasetsLocators.favoriteTabId)), WAITTIME).getAttribute("title");
        expect(favoriteLink).to.equal("Favorites");
    }).timeout(TIMEOUT);

    it("should find the Data Sets node", async () => {
        await driver.wait(until.elementLocated(By.id(DatasetsLocators.datasetTabId)), WAITTIME);
        const datasetLink = await driver.wait(until.elementLocated(By.xpath(DatasetsLocators.datasetTabXpath)), WAITTIME).getText();
        expect(datasetLink).to.equal("DATA SETS");
    }).timeout(TIMEOUT);

    it("should find the USS node", async () => {
        await driver.wait(until.elementLocated(By.id(UssLocators.ussTabId)), WAITTIME);
        const ussLink = await driver.wait(until.elementLocated(By.xpath(UssLocators.ussTabXpath)), WAITTIME).getText();
        expect(ussLink).to.equal("UNIX SYSTEM SERVICES (USS)");
    }).timeout(TIMEOUT);

    it("should find the Jobs node", async () => {
        await driver.wait(until.elementLocated(By.id(JobsLocators.jobTabId)), WAITTIME);
        const jobsLink = await driver.wait(until.elementLocated(By.xpath(JobsLocators.jobTabXpath)), WAITTIME).getText();
        expect(jobsLink).to.equal("JOBS");
    }).timeout(TIMEOUT);

    it("Should Add Default Profile in DATA SETS", async () => {
        await driver.findElement(By.id(DatasetsLocators.datasetsPanelId)).click();
        await driver.findElement(By.id(DatasetsLocators.datasetsAddSessionId)).click();
        await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath)).sendKeys(Key.ENTER);
        const datasetProfileName = await driver.wait(until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)),WAITTIME);
        datasetProfileName.sendKeys("DefaultProfile");
        datasetProfileName.sendKeys(Key.ENTER);
        const zosUrl = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        zosUrl.sendKeys("fakehost.net:1003");
        zosUrl.sendKeys(Key.ENTER);
        const username = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        username.sendKeys(Key.ENTER);
        const password = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        password.sendKeys(Key.ENTER);
        const authorization = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        authorization.sendKeys("False - Accept connections with self-signed certificates");
        authorization.sendKeys(Key.ENTER);
        const basepath = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        basepath.sendKeys(Key.ENTER);
        const datasetProfile = await driver.wait(until.elementLocated(By.id(DatasetsLocators.defaultDatasetsProfileId)),WAITTIME).getText();
        expect(datasetProfile).to.equal("DefaultProfile");
    });

    it("Should Default profile visible in USS", async () => {
        await driver.navigate().refresh();
        await driver.sleep(SLEEPTIME);
        await driver.findElement(By.xpath(DatasetsLocators.datasetTabXpath)).click();
        await driver.findElement(By.id(UssLocators.ussTabId)).click();
        const ussProfile = await driver.wait(until.elementLocated(By.xpath(UssLocators.defaultUssProfileXpath)), WAITTIME).getText();
        expect(ussProfile).to.equal("DefaultProfile");
    });

    it("Should Default profile visible in JOBS", async () => {
        await driver.findElement(By.xpath(UssLocators.ussTabXpath)).click();
        await driver.findElement(By.id(JobsLocators.jobTabId)).click();
        const jobsProfile = await driver.wait(until.elementLocated(By.xpath(JobsLocators.defaultJobsProfileXpath)), WAITTIME).getText();
        expect(jobsProfile).to.equal("DefaultProfile");
    });
    after(async () => driver.quit());
});

describe("Add Profiles", () => {
    const firefoxOptions = new firefox.Options();
    firefoxOptions.headless();
    const driver = new Builder().forBrowser("firefox").setFirefoxOptions(firefoxOptions).build();

    before(async () => {
        await driver.get(TheiaLocator.theiaUrl);
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxpath))).click();
    });

    it("Should Add Profile in DATA SETS", async () => {
        await driver.findElement(By.id(DatasetsLocators.datasetsPanelId)).click();
        await driver.findElement(By.id(DatasetsLocators.datasetsAddSessionId)).click();
        await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath)).sendKeys(Key.ENTER);
        const datasetProfileName = await driver.wait(until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)),WAITTIME);
        datasetProfileName.sendKeys("TestSeleniumProfile");
        datasetProfileName.sendKeys(Key.ENTER);
        const zosUrl = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        zosUrl.sendKeys("fakehost.net:1003");
        zosUrl.sendKeys(Key.ENTER);
        const username = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        username.sendKeys(Key.ENTER);
        const password = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        password.sendKeys(Key.ENTER);
        const authorization = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        authorization.sendKeys("False - Accept connections with self-signed certificates");
        authorization.sendKeys(Key.ENTER);
        const basepath = await driver.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
        basepath.sendKeys(Key.ENTER);
        const datasetProfile = await driver.wait(until.elementLocated(By.id(DatasetsLocators.secondDatasetProfileId)),WAITTIME).getText();
        expect(datasetProfile).to.equal("TestSeleniumProfile");
    });

    it("Should Add Existing Profile in USS", async () => {
        await driver.findElement(By.xpath(DatasetsLocators.datasetTabXpath)).click();
        await driver.findElement(By.id(UssLocators.ussTabId)).click();
        await driver.findElement(By.id(UssLocators.ussPanelId)).click();
        await driver.findElement(By.id(UssLocators.ussAddSessionId)).click();
        const ussProfileName = await driver.findElement(By.xpath(UssLocators.emptyInputBoxXpath));
        ussProfileName.sendKeys("TestSeleniumProfile");
        ussProfileName.sendKeys(Key.ENTER);
        const ussProfile = await driver.wait(until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)), WAITTIME).getText();
        expect(ussProfile).to.equal("TestSeleniumProfile");
    });

    it("Should Add Existing Profile in JOBS", async () => {
        await driver.findElement(By.xpath(UssLocators.ussTabXpath)).click();
        await driver.findElement(By.id(JobsLocators.jobTabId)).click();
        await driver.findElement(By.id (JobsLocators.jobsPanelId)).click();
        await driver.findElement(By.id(JobsLocators.jobsAddSessionId)).click();
        const jobsProfileName = await driver.findElement(By.xpath(JobsLocators.emptyInputBoxXpath));
        jobsProfileName.sendKeys("TestSeleniumProfile");
        jobsProfileName.sendKeys(Key.ENTER);
        const jobsProfile = await driver.wait(until.elementLocated(By.xpath(JobsLocators.secondJobsProfileXpath)), WAITTIME).getText();
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
        await driver.get(TheiaLocator.theiaUrl);
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxpath))).click();
    });
    it("Should Add Profile to Favorites under DATA SETS", async () => {
        const addTofavorite = await driver.wait(until.elementLocated(By.id(DatasetsLocators.secondDatasetProfileId)),  WAITTIME);
        await driver.actions().click(addTofavorite, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath(DatasetsLocators.addToFavoriteOptionXpath)), WAITTIME).click();
        await driver.wait(until.elementLocated(By.id(DatasetsLocators.favoriteTabId)), WAITTIME).click();
        const favoriteProfile = await driver.wait(until.elementLocated(By.id(DatasetsLocators.favoriteProfileInDatasetId)), WAITTIME).getText();
        expect(favoriteProfile).to.equal("[TestSeleniumProfile]: ");
    });
    it("Should Add Profile to Favorites under USS", async () => {
        await driver.wait(until.elementLocated(
                                By.xpath(DatasetsLocators.datasetTabXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(
                              By.xpath(UssLocators.ussTabXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
        const addTofavorite = await driver.wait(until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)), WAITTIME);
        await driver.actions().click(addTofavorite, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath(UssLocators.addToFavoriteOptionXpath)), WAITTIME).click();
        await driver.wait(until.elementLocated(By.xpath(UssLocators.favoriteTabXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
        const favoriteProfile = await driver.wait(until.elementLocated(
                                                 By.xpath(UssLocators.favoriteProfileInUssXpath)), WAITTIME).getText();
        expect(favoriteProfile).to.equal("[TestSeleniumProfile]: ");
    });
    it("Should Add Profile to Favorites under JOBS", async () => {
        await driver.findElement(By.xpath(UssLocators.ussTabXpath)).click();
        await driver.sleep(SLEEP);
        await driver.findElement(By.id(JobsLocators.jobTabId)).click();
        const addTofavorite = await driver.wait(until.elementLocated(By.xpath(JobsLocators.secondJobsProfileXpath)),  WAITTIME);
        await driver.actions().click(addTofavorite, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath(JobsLocators.addToFavoriteOptionXpath)), WAITTIME).click();
        await driver.wait(until.elementLocated(By.xpath(JobsLocators.favoriteTabXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
        const favoriteProfile = await driver.wait(until.elementLocated(
                                             By.xpath(JobsLocators.favoriteProfileInJobsXpath)), WAITTIME).getText();
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
        await driver.get(TheiaLocator.theiaUrl);
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxpath))).click();
    });
    it("Should Remove Profile from Favorites under DATA SETS", async () => {
        await driver.wait(until.elementLocated(By.id(DatasetsLocators.favoriteTabId)), WAITTIME).click();
        const removeFromFavorite = await driver.wait(until.elementLocated(By.id(DatasetsLocators.favoriteProfileInDatasetId)), WAITTIME);
        await driver.actions().click(removeFromFavorite, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath(DatasetsLocators.removeFavoriteProfileFromDatasetsOptionXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
        // expect(removepro).to.equal("");
    });
    it("Should Remove Profile from Favorites under USS", async () => {
        await driver.findElement(By.xpath(DatasetsLocators.datasetTabXpath)).click();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(By.xpath(UssLocators.ussTabXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(By.xpath(UssLocators.favoriteTabXpath)), WAITTIME).click();
        const removeFromFavorite = await driver.wait(until.elementLocated(By.xpath(UssLocators.favoriteProfileInUssBeforeRemovingXpath)), WAITTIME);
        await driver.actions().click(removeFromFavorite, Button.RIGHT).perform();
        await (await driver.wait(until.elementLocated(By.xpath(UssLocators.removeFavoriteProfileFromUssOptionXpath)), WAITTIME)).click();
        await driver.sleep(SLEEP);
        // expect(removepro).to.equal("");
    });

    it("Should Remove Profile from Favorites under JOBS", async () => {
        await driver.findElement(By.xpath(UssLocators.ussTabXpath)).click();
        await driver.sleep(SLEEP);
        await driver.findElement(By.id(JobsLocators.jobTabId)).click();
        await driver.wait(until.elementLocated(By.xpath(JobsLocators.favoriteTabXpath)), WAITTIME).click();
        const removeFromFavorite = await driver.wait(until.elementLocated(
                                                        By.xpath(JobsLocators.favoriteProfileInJobsXpath)), WAITTIME);
        await driver.actions().click(removeFromFavorite, Button.RIGHT).perform();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(By.xpath(JobsLocators.removeFavoriteProfileFromJobsOptionXpath)), WAITTIME).click();
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
        await driver.get(TheiaLocator.theiaUrl);
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxpath))).click();
    });

    it("Should Hide Profile from USS", async () => {
        await driver.findElement(By.xpath(DatasetsLocators.datasetTabXpath)).click();
        await driver.sleep(SLEEP);
        await driver.wait(until.elementLocated(By.xpath(UssLocators.ussTabXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
        const hideProfileFromUss = await driver.wait(until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)), WAITTIME);
        await driver.actions().click(hideProfileFromUss, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath(UssLocators.hideProfileFromUssOptionXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
    });
    it("Should Hide Profile from JOBS", async () => {
        await driver.findElement(By.xpath(UssLocators.ussTabXpath)).click();
        await driver.sleep(SLEEP);
        await driver.findElement(By.id(JobsLocators.jobTabId)).click();
        const hideProfileFromJobs = await driver.wait(until.elementLocated(By.xpath(JobsLocators.secondJobsProfileIdBeforeHidingXpath)), WAITTIME);
        await driver.actions().click(hideProfileFromJobs, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath(JobsLocators.hideProfileFromJobsOptionXpath)), WAITTIME).click();
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
        await driver.get(TheiaLocator.theiaUrl);
        await driver.sleep(SLEEPTIME);
        driver.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxpath))).click();
    });
    it("Should Delete Default Profile from DATA SETS", async () => {
        await driver.findElement(By.xpath(TheiaNotificationMessages.closeTheiaNotificationWarningMsgXpath)).click();
        const favprofile = await driver.wait(until.elementLocated(By.id(DatasetsLocators.defaultDatasetsProfileId)), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath(DatasetsLocators.deleteProfileFromDatasetsXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
        const deleteProfile = driver.wait(until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)), WAITTIME);
        deleteProfile.sendKeys("Delete");
        deleteProfile.sendKeys(Key.ENTER);
        await driver.sleep(SLEEP);
        const deleteConfrmationMsg = await driver.wait(until.elementLocated(
                                                By.xpath(TheiaNotificationMessages.deleteProfileNotificationMsg)), WAITTIME).getText();
        expect(deleteConfrmationMsg).to.equal("Profile DefaultProfile was deleted.");
    });
    it("Should Delete Profile from DATA SETS", async () => {
        await driver.findElement(By.xpath(TheiaNotificationMessages.closeTheiaNotificationWarningMsgXpath)).click();
        const favprofile = await driver.wait(until.elementLocated(By.id(DatasetsLocators.secondDatasetProfileBeforeDeletingId)), WAITTIME);
        await driver.actions().click(favprofile, Button.RIGHT).perform();
        await driver.wait(until.elementLocated(By.xpath(DatasetsLocators.deleteProfileFromDatasetsXpath)), WAITTIME).click();
        await driver.sleep(SLEEP);
        const deleteProfile = driver.wait(until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)), WAITTIME);
        deleteProfile.sendKeys("Delete");
        deleteProfile.sendKeys(Key.ENTER);
        await driver.sleep(SLEEP);
        const deleteConfrmationMsg = await driver.wait(until.elementLocated(
                                                By.xpath(TheiaNotificationMessages.deleteProfileNotificationMsg)), WAITTIME).getText();
        expect(deleteConfrmationMsg).to.equal("Profile TestSeleniumProfile was deleted.");
    });

    after(async () => driver.quit());
});
