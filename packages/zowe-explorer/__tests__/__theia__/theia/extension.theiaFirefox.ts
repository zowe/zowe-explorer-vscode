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
import { Builder, By, Key, until, WebDriver, WebElement } from "selenium-webdriver";
import * as firefox from "selenium-webdriver/firefox";
import { TheiaLocator, DatasetsLocators, UssLocators, JobsLocators } from "./Locators";

const SHORTSLEEPTIME = 2000;
const WAITTIME = 30000;
let driverFirefox: WebDriver;

async function waitForVisibleElement(locator: By, timeout = WAITTIME): Promise<WebElement> {
    const element = await driverFirefox.wait(until.elementLocated(locator), timeout);
    await driverFirefox.wait(until.elementIsVisible(element), timeout);
    return element;
}

async function clickWhenVisible(locator: By, timeout = WAITTIME): Promise<void> {
    const element = await waitForVisibleElement(locator, timeout);
    await element.click();
}

export async function openBrowser(headless = true): Promise<WebDriver> {
    const firefoxOptions = new firefox.Options();
    if (headless) {
        firefoxOptions.addArguments("--headless");
    }
    driverFirefox = await new Builder().forBrowser("firefox").setFirefoxOptions(firefoxOptions).build();
    return driverFirefox;
}

export async function takeScreenshot(filename: string): Promise<void> {
    const image = await driverFirefox.takeScreenshot();
    writeFileSync(filename, image, "base64");
}

export async function OpenTheiaInFirefox(): Promise<void> {
    await driverFirefox.get(TheiaLocator.theiaUrl);
}

export async function clickOnZoweExplorer(): Promise<void> {
    await clickWhenVisible(By.id(TheiaLocator.zoweExplorerxId));
}

export async function clickOnDatasetsTab(): Promise<void> {
    await clickWhenVisible(By.id(DatasetsLocators.datasetTabId));
    await clickWhenVisible(By.xpath(DatasetsLocators.datasetTabXpath));
}

export async function clickOnUssTab(): Promise<void> {
    await clickWhenVisible(By.id(UssLocators.ussTabId));
    await clickWhenVisible(By.xpath(UssLocators.ussTabXpath));
}

export async function clickOnJobsTab(): Promise<void> {
    await clickWhenVisible(By.id(JobsLocators.jobTabId));
    await clickWhenVisible(By.xpath(JobsLocators.jobTabXpath));
}

export async function clickOnUssPanel(): Promise<void> {
    await clickWhenVisible(By.id(UssLocators.ussPanelId));
}

export async function clickOnAddSessionInUss(): Promise<void> {
    await clickWhenVisible(By.id(UssLocators.ussAddSessionId));
}

export async function clickOnJobsPanel(): Promise<void> {
    await clickWhenVisible(By.id(JobsLocators.jobsPanelId));
}

export async function clickOnAddSessionInJobs(): Promise<void> {
    await clickWhenVisible(By.id(JobsLocators.jobsAddSessionId));
}

export async function addProfileDetailsInUss(profileName: string): Promise<void> {
    const ussProfileName = await waitForVisibleElement(By.xpath(UssLocators.emptyInputBoxXpath));
    await ussProfileName.sendKeys(profileName);
    await ussProfileName.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const addToAllTrees = await waitForVisibleElement(By.xpath(JobsLocators.emptyInputBoxXpath));
    await addToAllTrees.sendKeys("No");
    await addToAllTrees.sendKeys(Key.ENTER);
}

export async function addProfileDetailsInJobs(profileName: string): Promise<void> {
    const jobsProfileName = await waitForVisibleElement(By.xpath(JobsLocators.emptyInputBoxXpath));
    await jobsProfileName.sendKeys(profileName);
    await jobsProfileName.sendKeys(Key.ENTER);
}

export async function getUssDefaultProfilename(): Promise<string> {
    const ussProfile = await driverFirefox.wait(until.elementLocated(By.xpath(UssLocators.defaultUssProfileXpath)), WAITTIME).getText();
    return ussProfile;
}

export async function getJobsDefaultProfilename(): Promise<string> {
    const jobsProfile = await driverFirefox.wait(until.elementLocated(By.xpath(JobsLocators.defaultJobsProfileXpath)), WAITTIME).getText();
    return jobsProfile;
}

export async function getUssProfilename(): Promise<string> {
    const ussProfile = await driverFirefox.wait(until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)), WAITTIME).getText();
    return ussProfile;
}

export async function getJobsProfilename(): Promise<string> {
    const jobsProfile = await driverFirefox.wait(until.elementLocated(By.xpath(JobsLocators.secondJobsProfileXpath)), WAITTIME).getText();
    return jobsProfile;
}

export async function getFavoritesNode(): Promise<string> {
    const favoriteLink = await driverFirefox.wait(until.elementLocated(By.xpath(DatasetsLocators.favoriteTabXpath)), WAITTIME).getAttribute("title");
    return favoriteLink;
}

export async function getDatasetNode(): Promise<string> {
    await driverFirefox.wait(until.elementLocated(By.id(DatasetsLocators.datasetTabId)), WAITTIME);
    const datasetLink = await driverFirefox.wait(until.elementLocated(By.xpath(DatasetsLocators.datasetTabXpath)), WAITTIME).getText();
    return datasetLink;
}

export async function getUssNode(): Promise<string> {
    await driverFirefox.wait(until.elementLocated(By.id(UssLocators.ussTabId)), WAITTIME);
    const ussLink = await driverFirefox.wait(until.elementLocated(By.xpath(UssLocators.ussTabXpath)), WAITTIME).getText();
    return ussLink;
}

export async function getJobsNode(): Promise<string> {
    await driverFirefox.wait(until.elementLocated(By.id(JobsLocators.jobTabId)), WAITTIME);
    const jobsLink = await driverFirefox.wait(until.elementLocated(By.xpath(JobsLocators.jobTabXpath)), WAITTIME).getText();
    return jobsLink;
}

export async function sleepTime(sleeptime: number): Promise<void> {
    await driverFirefox.sleep(sleeptime);
}
export async function refreshBrowser(): Promise<void> {
    await driverFirefox.navigate().refresh();
}

export async function closeBrowser(): Promise<void> {
    await driverFirefox.close();
}
