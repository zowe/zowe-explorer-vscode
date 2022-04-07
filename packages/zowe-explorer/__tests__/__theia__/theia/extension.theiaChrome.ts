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
// tslint:disable-next-line: no-submodule-imports
import * as chrome from "selenium-webdriver/chrome";
import { TheiaLocator, DatasetsLocators, UssLocators, JobsLocators, TheiaNotificationMessages } from "./Locators";

const WAITTIME = 40000;
const SHORTSLEEPTIME = 2000;
let driverChrome: any;

export async function openBrowser() {
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments("headless");
    chromeOptions.addArguments("window-size=1200,1100");
    driverChrome = new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();
}

export async function OpenTheiaInChrome() {
    await driverChrome.get(TheiaLocator.theiaUrl);
}

export async function clickOnZoweExplorer() {
    await driverChrome.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxId))).click();
}

export async function clickOnFavoriteTabInDatasets() {
    await driverChrome.wait(until.elementLocated(By.id(DatasetsLocators.favoriteTabId)), WAITTIME).click();
}

export async function clickOnFavoriteTabInUss() {
    await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.favoriteTabXpath)), WAITTIME).click();
}

export async function clickOnFavoriteTabInJobs() {
    await driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.favoriteTabXpath)), WAITTIME).click();
}

export async function clickOnFavoriteTabInJobsAfterRefresh() {
    await driverChrome
        .wait(until.elementLocated(By.xpath(JobsLocators.favoriteTabAfterRefreshXpath)), WAITTIME)
        .click();
}

export async function clickOnDatasetsTab() {
    await driverChrome.findElement(By.xpath(DatasetsLocators.datasetTabXpath)).click();
}

export async function clickOnUssTab() {
    await driverChrome.findElement(By.id(UssLocators.ussTabId)).click();
}

export async function clickOnUssTabs() {
    await driverChrome.findElement(By.xpath(UssLocators.ussTabXpath)).click();
}

export async function clickOnJobsTab() {
    await driverChrome.findElement(By.id(JobsLocators.jobTabId)).click();
}

export async function getFavoritePrfileNameFromDatasets() {
    const favoriteProfile = await driverChrome
        .wait(until.elementLocated(By.id(DatasetsLocators.favoriteProfileInDatasetId)), WAITTIME)
        .getText();
    return favoriteProfile;
}

export async function getFavoritePrfileNameFromUss() {
    const favoriteProfile = await driverChrome
        .wait(until.elementLocated(By.xpath(UssLocators.favoriteProfileInUssXpath)), WAITTIME)
        .getText();
    return favoriteProfile;
}

export async function getFavoritePrfileNameFromJobs() {
    return driverChrome
        .wait(until.elementLocated(By.xpath(JobsLocators.favoriteProfileInJobsXpath)), WAITTIME)
        .getText();
}

export async function removeFavoriteProfileFromDatasets() {
    const removeFromFavorite = await driverChrome.wait(
        until.elementLocated(By.id(DatasetsLocators.favoriteProfileInDatasetId)),
        WAITTIME
    );
    await driverChrome.actions().click(removeFromFavorite, Button.RIGHT).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome
        .wait(until.elementLocated(By.xpath(DatasetsLocators.removeFavoriteProfileFromDatasetsOptionXpath)), WAITTIME)
        .click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome
        .wait(
            until.elementLocated(By.xpath(TheiaNotificationMessages.removeFavoriteProfileConfirmationXpath)),
            WAITTIME
        )
        .click();
}

export async function removeFavoriteProfileFromUss() {
    const removeFromFavorite = await driverChrome.wait(
        until.elementLocated(By.xpath(UssLocators.favoriteProfileInUssBeforeRemovingXpath)),
        WAITTIME
    );
    await driverChrome.actions().click(removeFromFavorite, Button.RIGHT).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome
        .wait(until.elementLocated(By.xpath(UssLocators.removeFavoriteProfileFromUssOptionXpath)), WAITTIME)
        .click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome
        .wait(
            until.elementLocated(By.xpath(TheiaNotificationMessages.removeFavoriteProfileConfirmationXpath)),
            WAITTIME
        )
        .click();
}

export async function removeFavoriteProfileFromJobs() {
    const removeFromFavorite = await driverChrome.wait(
        until.elementLocated(By.xpath(JobsLocators.favoriteprofile)),
        WAITTIME
    );
    await driverChrome.actions().click(removeFromFavorite, Button.RIGHT).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome
        .wait(until.elementLocated(By.xpath(JobsLocators.removeFavoriteProfileFromJobsOptionXpath)), WAITTIME)
        .click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome
        .wait(
            until.elementLocated(By.xpath(TheiaNotificationMessages.removeFavoriteProfileConfirmationXpath)),
            WAITTIME
        )
        .click();
}

export async function addProfileToFavoritesInDatasets() {
    const addTofavorite = await driverChrome.wait(
        until.elementLocated(By.id(DatasetsLocators.secondDatasetProfileId)),
        WAITTIME
    );
    await driverChrome.actions().click(addTofavorite, Button.RIGHT).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome
        .wait(until.elementLocated(By.xpath(DatasetsLocators.addToFavoriteOptionXpath)), WAITTIME)
        .click();
}

export async function addProfileToFavoritesInUss() {
    const addTofavorite = await driverChrome.wait(
        until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)),
        WAITTIME
    );
    await driverChrome.actions().click(addTofavorite, Button.RIGHT).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(UssLocators.addToFavoriteOptionXpath)), WAITTIME).click();
}

export async function addProfileToFavoritesInJobs() {
    const addTofavorite = await driverChrome.wait(
        until.elementLocated(By.xpath(JobsLocators.secondJobsProfileXpath)),
        WAITTIME
    );
    await driverChrome.actions().click(addTofavorite, Button.RIGHT).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.wait(until.elementLocated(By.xpath(JobsLocators.addToFavoriteOptionXpath)), WAITTIME).click();
}

export async function hideProfileInUss() {
    const hideProfileFromUss = await driverChrome.wait(
        until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)),
        WAITTIME
    );
    await driverChrome.actions().click(hideProfileFromUss, Button.RIGHT).perform();
    await driverChrome
        .wait(until.elementLocated(By.xpath(UssLocators.hideProfileFromUssOptionXpath)), WAITTIME)
        .click();
}

export async function hideProfileInJobs() {
    const hideProfileFromJobs = await driverChrome.wait(
        until.elementLocated(By.xpath(JobsLocators.secondJobsProfileIdBeforeHidingXpath)),
        WAITTIME
    );
    await driverChrome.actions().click(hideProfileFromJobs, Button.RIGHT).perform();
    await driverChrome
        .wait(until.elementLocated(By.xpath(JobsLocators.hideProfileFromJobsOptionXpath)), WAITTIME)
        .click();
}

export async function verifyProfileIsHideInUss() {
    const hideProfileFromUss = await driverChrome
        .findElements(By.xpath(UssLocators.secondUssProfileXpath))
        .then((found) => !!found.length);
    if (!hideProfileFromUss) {
        return true;
    } else {
        return false;
    }
}

export async function verifyProfileIsHideInJobs() {
    const hideProfileFromJobs = await driverChrome
        .findElements(By.xpath(JobsLocators.secondJobsProfileIdBeforeHidingXpath))
        .then((found) => !!found.length);
    if (!hideProfileFromJobs) {
        return true;
    } else {
        return false;
    }
}

export async function deleteDefaultProfileInDatasets() {
    const profileName = await driverChrome.wait(
        until.elementLocated(By.id(DatasetsLocators.defaultDatasetsProfileId)),
        WAITTIME
    );
    await driverChrome.actions().click(profileName, Button.RIGHT).perform();
    await driverChrome
        .wait(until.elementLocated(By.xpath(DatasetsLocators.deleteProfileFromDatasetsXpath)), WAITTIME)
        .click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    const deleteProfile = driverChrome.wait(
        until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)),
        WAITTIME
    );
    deleteProfile.sendKeys("Delete");
    deleteProfile.sendKeys(Key.ENTER);
    return;
}

export async function deleteProfileInDatasets() {
    const favprofile = await driverChrome.wait(
        until.elementLocated(By.id(DatasetsLocators.secondDatasetProfileBeforeDeletingId)),
        WAITTIME
    );
    await driverChrome.actions().click(favprofile, Button.RIGHT).perform();
    await driverChrome
        .wait(until.elementLocated(By.xpath(DatasetsLocators.deleteProfileFromDatasetsXpath)), WAITTIME)
        .click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    const deleteProfile = driverChrome.wait(
        until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)),
        WAITTIME
    );
    deleteProfile.sendKeys("Delete");
    deleteProfile.sendKeys(Key.ENTER);
    return;
}

export async function verifyRemovedFavoriteProfileInDatasets() {
    const favoriteProfile = await driverChrome
        .findElements(By.id(DatasetsLocators.favoriteProfileInDatasetId))
        .then((found) => !!found.length);
    if (!favoriteProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedFavoriteProfileInUss() {
    const favoriteProfile = await driverChrome
        .findElements(By.xpath(UssLocators.favoriteProfileInUssXpath))
        .then((found) => !!found.length);
    if (!favoriteProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedFavoriteProfileInJobs() {
    const favoriteProfile = await driverChrome
        .findElements(By.xpath(JobsLocators.favoriteProfileInJobsXpath))
        .then((found) => !!found.length);
    if (!favoriteProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedDefaultProfileInDataSet() {
    const defaultProfile = await driverChrome
        .findElements(By.id(DatasetsLocators.defaultDatasetsProfileId))
        .then((found) => !!found.length);
    if (!defaultProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedOtherProfileInDataSet() {
    const defaultProfile = await driverChrome
        .findElements(By.id(DatasetsLocators.secondDatasetProfileId))
        .then((found) => !!found.length);
    if (!defaultProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedDefaultProfileInUss() {
    const defaultProfile = await driverChrome
        .findElements(By.xpath(UssLocators.defaultUssProfileXpath))
        .then((found) => !!found.length);
    if (!defaultProfile) {
        return true;
    } else {
        return false;
    }
}

export async function verifyRemovedDefaultProfileInJobs() {
    const defaultProfile = await driverChrome
        .findElements(By.xpath(JobsLocators.defaultJobsProfileXpath))
        .then((found) => !!found.length);
    if (!defaultProfile) {
        return true;
    } else {
        return false;
    }
}
export async function closeNotificationMessage() {
    await driverChrome.findElement(By.xpath(TheiaNotificationMessages.closeTheiaNotificationWarningMsgXpath)).click();
}

export async function sleepTime(sleeptime: number) {
    await driverChrome.sleep(sleeptime);
}

export async function refreshBrowser() {
    await driverChrome.navigate().refresh();
}

export function closeBrowser() {
    driverChrome.close();
}

export async function addProfileDetails(profileName: string) {
    await driverChrome.findElement(By.id(DatasetsLocators.datasetsAddSessionId)).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.findElement(By.xpath(DatasetsLocators.createNewConnectionListXpath)).click();
    await driverChrome.sleep(SHORTSLEEPTIME);
    const datasetProfileName = await driverChrome.wait(
        until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)),
        WAITTIME
    );
    datasetProfileName.sendKeys(profileName);
    datasetProfileName.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const zosUrl = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    zosUrl.sendKeys("fakehost.net:1003");
    zosUrl.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const username = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    username.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const password = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    password.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const authorization = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    authorization.sendKeys("False - Accept connections with self-signed certificates");
    authorization.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const basepath = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    basepath.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const protocol = await driverChrome.findElement(By.xpath(DatasetsLocators.inputBoxXpath));
    protocol.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const encoding = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    encoding.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    const responseTimeout = await driverChrome.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    responseTimeout.sendKeys(Key.ENTER);
    await driverChrome.sleep(SHORTSLEEPTIME);
    await driverChrome.actions().sendKeys(Key.ENTER).perform();
    await driverChrome.sleep(SHORTSLEEPTIME);
}
export async function clickOnDatasetsPanel() {
    await driverChrome.findElement(By.id(DatasetsLocators.datasetsPanelId)).click();
}

export async function clickOnAddSessionInDatasets() {
    await driverChrome.findElement(By.id(DatasetsLocators.datasetsAddSessionId)).click();
}

export async function getDatasetsDefaultProfilename() {
    const datasetProfile = await driverChrome
        .wait(until.elementLocated(By.id(DatasetsLocators.defaultDatasetsProfileId)), WAITTIME)
        .getText();
    return datasetProfile;
}

export async function getDatasetsProfilename() {
    const datasetProfile = await driverChrome
        .wait(until.elementLocated(By.id(DatasetsLocators.secondDatasetProfileId)), WAITTIME)
        .getText();
    return datasetProfile;
}
