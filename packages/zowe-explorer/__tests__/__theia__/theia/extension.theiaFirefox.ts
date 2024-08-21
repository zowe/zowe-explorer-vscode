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
import * as firefox from "selenium-webdriver/firefox";
import { TheiaLocator, DatasetsLocators, UssLocators, JobsLocators } from "./Locators";

const SHORTSLEEPTIME = 2000;
const WAITTIME = 30000;
let driverFirefox: WebDriver;

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
    await driverFirefox.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxId)), WAITTIME).click();
}

export async function clickOnDatasetsTab(): Promise<void> {
    await driverFirefox.findElement(By.id(DatasetsLocators.datasetTabId)).click();
    await driverFirefox.findElement(By.xpath(DatasetsLocators.datasetTabXpath)).click();
}

export async function clickOnUssTab(): Promise<void> {
    await driverFirefox.findElement(By.id(UssLocators.ussTabId)).click();
    await driverFirefox.findElement(By.xpath(UssLocators.ussTabXpath)).click();
}

export async function clickOnJobsTab(): Promise<void> {
    await driverFirefox.findElement(By.id(JobsLocators.jobTabId)).click();
    await driverFirefox.findElement(By.xpath(JobsLocators.jobTabXpath)).click();
}

export async function clickOnUssPanel(): Promise<void> {
    await driverFirefox.findElement(By.id(UssLocators.ussPanelId)).click();
}

export async function clickOnAddSessionInUss(): Promise<void> {
    await driverFirefox.findElement(By.id(UssLocators.ussAddSessionId)).click();
}

export async function clickOnJobsPanel(): Promise<void> {
    await driverFirefox.findElement(By.id(JobsLocators.jobsPanelId)).click();
}

export async function clickOnAddSessionInJobs(): Promise<void> {
    await driverFirefox.findElement(By.id(JobsLocators.jobsAddSessionId)).click();
}

export async function addProfileDetailsInUss(profileName: string): Promise<void> {
    const ussProfileName = await driverFirefox.findElement(By.xpath(UssLocators.emptyInputBoxXpath));
    await ussProfileName.sendKeys(profileName);
    await ussProfileName.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const addToAllTrees = await driverFirefox.findElement(By.xpath(JobsLocators.emptyInputBoxXpath));
    await addToAllTrees.sendKeys("No");
    await addToAllTrees.sendKeys(Key.ENTER);
}

export async function addProfileDetailsInJobs(profileName: string): Promise<void> {
    const jobsProfileName = await driverFirefox.findElement(By.xpath(JobsLocators.emptyInputBoxXpath));
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
