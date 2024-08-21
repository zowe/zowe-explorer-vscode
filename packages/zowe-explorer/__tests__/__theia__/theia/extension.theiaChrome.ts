/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { writeFileSync } from "fs";
import { Builder, By, Key, until, WebDriver } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";
import { TheiaLocator, DatasetsLocators, UssLocators, JobsLocators, TheiaNotificationMessages } from "./Locators";

const WAITTIME = 40000;
const SHORTSLEEPTIME = 2000;
let driverChrome: WebDriver;

export async function openBrowser(headless = true): Promise<WebDriver> {
    const chromeOptions = new chrome.Options();
    if (headless) {
        chromeOptions.addArguments("--headless");
    }
    chromeOptions.addArguments("--no-sandbox");

    // chromeOptions.addArguments("--disable-dev-shm-usage"); // Linux ONLY

    chromeOptions.addArguments("--window-size=1200,1100");
    driverChrome = await new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();
    return driverChrome;
}

export async function takeScreenshot(filename: string): Promise<void> {
    const image = await driverChrome.takeScreenshot();
    writeFileSync(filename, image, "base64");
}

export async function OpenTheiaInChrome(): Promise<void> {
    await driverChrome.get(TheiaLocator.theiaUrl);
}

export async function clickOnZoweExplorer(): Promise<void> {
    await driverChrome.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxId)), WAITTIME).click();
}

export async function clickOnFavoriteTabInDatasets(): Promise<void> {
    await driverChrome.findElement(By.id(DatasetsLocators.datasetTabId)).click();
    await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.favoriteTabXpath)), WAITTIME).click();
}

export async function clickOnFavoriteTabInUss(): Promise<void> {
    await driverChrome.findElement(By.id(UssLocators.ussTabId)).click();
    await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.favoriteTabXpath)), WAITTIME).click();
}

export async function clickOnFavoriteTabInJobs(): Promise<void> {
    await driverChrome.findElement(By.id(JobsLocators.jobTabId)).click();
    await driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.favoriteTabXpath)), WAITTIME).click();
}

export async function clickOnDatasetsTab(): Promise<void> {
    await driverChrome.findElement(By.id(DatasetsLocators.datasetTabId)).click();
    await driverChrome.findElement(By.xpath(DatasetsLocators.datasetTabXpath)).click();
}

export async function clickOnUssTab(): Promise<void> {
    await driverChrome.findElement(By.id(UssLocators.ussTabId)).click();
    await driverChrome.findElement(By.xpath(UssLocators.ussTabXpath)).click();
}

export async function clickOnJobsTab(): Promise<void> {
    await driverChrome.findElement(By.id(JobsLocators.jobTabId)).click();
    await driverChrome.findElement(By.xpath(JobsLocators.jobTabXpath)).click();
}

export async function getFavoriteProfileNameFromDatasets(): Promise<string> {
    const favoriteProfile = await driverChrome
        .wait(until.elementLocated(By.xpath(DatasetsLocators.favoriteProfileInDatasetXpath)), WAITTIME)
        .getText();
    return favoriteProfile;
}

export async function getFavoriteProfileNameFromUss(): Promise<string> {
    const favoriteProfile = await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.favoriteProfileInUssXpath)), WAITTIME).getText();
    return favoriteProfile;
}

export async function getFavoriteProfileNameFromJobs(): Promise<string> {
    return driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.favoriteProfileInJobsXpath)), WAITTIME).getText();
}

export async function removeFavoriteProfileFromDatasets(): Promise<void> {
    const removeFromFavorite = await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.favoriteProfileInDatasetXpath)), WAITTIME);
    await driverChrome.actions().contextClick(removeFromFavorite).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.removeFavoriteProfileFromDatasetsOptionXpath)), WAITTIME).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(TheiaNotificationMessages.removeFavoriteProfileConfirmationXpath)), WAITTIME).click();
}

export async function removeFavoriteProfileFromUss(): Promise<void> {
    const removeFromFavorite = await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.favoriteProfileInUssXpath)), WAITTIME);
    await driverChrome.actions().contextClick(removeFromFavorite).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.removeFavoriteProfileFromUssOptionXpath)), WAITTIME).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(TheiaNotificationMessages.removeFavoriteProfileConfirmationXpath)), WAITTIME).click();
}

export async function removeFavoriteProfileFromJobs(): Promise<void> {
    const removeFromFavorite = await driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.favoriteProfileInJobsXpath)), WAITTIME);
    await driverChrome.actions().contextClick(removeFromFavorite).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.removeFavoriteProfileFromJobsOptionXpath)), WAITTIME).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(TheiaNotificationMessages.removeFavoriteProfileConfirmationXpath)), WAITTIME).click();
}

export async function addProfileToFavoritesInDatasets(): Promise<void> {
    const addTofavorite = await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.secondDatasetProfileXpath)), WAITTIME);
    await addTofavorite.click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.actions().contextClick(addTofavorite).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.addToFavoriteOptionXpath)), WAITTIME).click();
}

export async function addProfileToFavoritesInUss(): Promise<void> {
    const addTofavorite = await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)), WAITTIME);
    await addTofavorite.click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.actions().contextClick(addTofavorite).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.addToFavoriteOptionXpath)), WAITTIME).click();
}

export async function addProfileToFavoritesInJobs(): Promise<void> {
    const addTofavorite = await driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.secondJobsProfileXpath)), WAITTIME);
    await addTofavorite.click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.actions().contextClick(addTofavorite).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.addToFavoriteOptionXpath)), WAITTIME).click();
}

export async function hideProfileInUss(): Promise<void> {
    const hideProfileFromUss = await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)), WAITTIME);
    await driverChrome.actions().contextClick(hideProfileFromUss).perform();
    await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.manageProfileFromUnixXpath)), WAITTIME).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    const manageProfile = driverChrome.wait(until.elementLocated(By.xpath(UssLocators.emptyInputBoxXpath)), WAITTIME);
    await manageProfile.sendKeys("Hide Profile");
    await manageProfile.sendKeys(Key.ENTER);
    await manageProfile.sendKeys("No");
    await manageProfile.sendKeys(Key.ENTER);
}

export async function hideProfileInJobs(): Promise<void> {
    const hideProfileFromJobs = await driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.secondJobsProfileBeforeHidingXpath)), WAITTIME);
    await driverChrome.actions().contextClick(hideProfileFromJobs).perform();
    await driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.manageProfileFromJobsXpath)), WAITTIME).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    const manageProfile = driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.emptyInputBoxXpath)), WAITTIME);
    await manageProfile.sendKeys("Hide Profile");
    await manageProfile.sendKeys(Key.ENTER);
    await manageProfile.sendKeys("No");
    await manageProfile.sendKeys(Key.ENTER);
}

export async function verifyProfileIsHideInUss(): Promise<boolean> {
    const hideProfileFromUss = await driverChrome.findElements(By.xpath(UssLocators.secondUssProfileXpath)).then((found) => !!found.length);
    if (!hideProfileFromUss) {
        return true;
    } else {
        return false;
    }
}

export async function verifyProfileIsHideInJobs(): Promise<boolean> {
    const hideProfileFromJobs = await driverChrome
        .findElements(By.xpath(JobsLocators.secondJobsProfileBeforeHidingXpath))
        .then((found) => !!found.length);
    if (!hideProfileFromJobs) {
        return true;
    } else {
        return false;
    }
}

export async function deleteDefaultProfileInDatasets(): Promise<void> {
    const profileName = await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.defaultDatasetsProfileXpath)), WAITTIME);
    await profileName.click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.actions().contextClick(profileName).perform();
    await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.manageProfileFromDatasetsXpath)), WAITTIME).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    const manageProfile = driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)), WAITTIME);
    await manageProfile.sendKeys("Delete Profile");
    await manageProfile.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const deleteProfile = driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)), WAITTIME);
    await deleteProfile.sendKeys("Delete");
    await deleteProfile.sendKeys(Key.ENTER);
}

export async function deleteProfileInDatasets(): Promise<void> {
    const favprofile = await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.secondDatasetProfileXpath)), WAITTIME);
    await driverChrome.actions().contextClick(favprofile).perform();
    await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.manageProfileFromDatasetsXpath)), WAITTIME).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    const manageProfile = driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)), WAITTIME);
    await manageProfile.sendKeys("Delete Profile");
    await manageProfile.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const deleteProfile = driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)), WAITTIME);
    await deleteProfile.sendKeys("Delete");
    await deleteProfile.sendKeys(Key.ENTER);
}

export async function verifyRemovedFavoriteProfileInDatasets(): Promise<boolean> {
    const favoriteProfile = await driverChrome.findElements(By.xpath(DatasetsLocators.favoriteProfileInDatasetXpath)).then((found) => !!found.length);
    if (!favoriteProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedFavoriteProfileInUss(): Promise<boolean> {
    const favoriteProfile = await driverChrome.findElements(By.xpath(UssLocators.favoriteProfileInUssXpath)).then((found) => !!found.length);
    if (!favoriteProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedFavoriteProfileInJobs(): Promise<boolean> {
    const favoriteProfile = await driverChrome.findElements(By.xpath(JobsLocators.favoriteProfileInJobsXpath)).then((found) => !!found.length);
    if (!favoriteProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedDefaultProfileInDataSet(): Promise<boolean> {
    const defaultProfile = await driverChrome.findElements(By.xpath(DatasetsLocators.defaultDatasetsProfileXpath)).then((found) => !!found.length);
    if (!defaultProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedOtherProfileInDataSet(): Promise<boolean> {
    const defaultProfile = await driverChrome.findElements(By.xpath(DatasetsLocators.secondDatasetProfileXpath)).then((found) => !!found.length);
    if (!defaultProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedDefaultProfileInUss(): Promise<boolean> {
    const defaultProfile = await driverChrome.findElements(By.xpath(UssLocators.defaultUssProfileXpath)).then((found) => !!found.length);
    if (!defaultProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedDefaultProfileInJobs(): Promise<boolean> {
    const defaultProfile = await driverChrome.findElements(By.xpath(JobsLocators.defaultJobsProfileXpath)).then((found) => !!found.length);
    if (!defaultProfile) {
        return true;
    } else {
        return false;
    }
}
export async function closeNotificationMessage(): Promise<void> {
    await driverChrome.findElement(By.xpath(TheiaNotificationMessages.closeTheiaNotificationWarningMsgXpath)).click();
}

export async function sleepTime(sleeptime: number): Promise<void> {
    await driverChrome.sleep(sleeptime);
}

export async function refreshBrowser(): Promise<void> {
    await driverChrome.navigate().refresh();
}

export async function closeBrowser(): Promise<void> {
    await driverChrome.close();
}

export async function addProfileDetails(profileName: string): Promise<void> {
    await driverChrome.findElement(By.xpath(DatasetsLocators.createNewConnectionListXpath)).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    const datasetProfileName = await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)), WAITTIME);
    await datasetProfileName.sendKeys(profileName);
    await datasetProfileName.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const zosUrl = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await zosUrl.sendKeys("fakehost.net:1003");
    await zosUrl.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const username = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await username.sendKeys("fake");
    await username.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const password = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await password.sendKeys("fake");
    await password.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const authorization = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await authorization.sendKeys("False - Accept connections with self-signed certificates");
    await authorization.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const certFile = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await certFile.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const certKeyFile = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await certKeyFile.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const basepath = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await basepath.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const protocol = await driverChrome.findElement(By.xpath(DatasetsLocators.inputBoxXpath));
    await protocol.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const encoding = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await encoding.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const responseTimeout = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await responseTimeout.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const addToAllTrees = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    await addToAllTrees.sendKeys("No");
    await addToAllTrees.sendKeys(Key.ENTER);
}
export async function clickOnDatasetsPanel(): Promise<void> {
    await driverChrome.findElement(By.id(DatasetsLocators.datasetsPanelId)).click();
}

export async function clickOnAddSessionInDatasets(): Promise<void> {
    await driverChrome.findElement(By.id(DatasetsLocators.datasetsAddSessionId)).click();
}

export async function getDatasetsDefaultProfilename(): Promise<string> {
    const datasetProfile = await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.defaultDatasetsProfileXpath)), WAITTIME).getText();
    return datasetProfile;
}

export async function getDatasetsProfilename(): Promise<string> {
    const datasetProfile = await driverChrome.wait(until.elementLocated(By.xpath(DatasetsLocators.secondDatasetProfileXpath)), WAITTIME).getText();
    return datasetProfile;
}
