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
import { Builder, By, Key, until } from "selenium-webdriver";
import * as firefox from "selenium-webdriver/firefox";
import { TheiaLocator, DatasetsLocators, UssLocators, JobsLocators } from "./Locators";

const WAITTIME = 30000;
let driverFirefox: any;

export async function openBrowser() {
    const firefoxOptions = new firefox.Options();
    firefoxOptions.headless();
    driverFirefox = new Builder().forBrowser("firefox").setFirefoxOptions(firefoxOptions).build();
}

export async function takeScreenshot(filename: string) {
    const image = await driverFirefox.takeScreenshot();
    writeFileSync(filename, image, "base64");
}

export async function OpenTheiaInFirefox() {
    await driverFirefox.get(TheiaLocator.theiaUrl);
}

export async function clickOnZoweExplorer() {
    driverFirefox.wait(until.elementLocated(By.id(TheiaLocator.zoweExplorerxId))).click();
}

export async function clickOnDatasetsTab() {
    await driverFirefox.findElement(By.xpath(DatasetsLocators.datasetTabXpath)).click();
}

export async function clickOnUssTab() {
    await driverFirefox.findElement(By.id(UssLocators.ussTabId)).click();
}

export async function clickOnUssTabs() {
    await driverFirefox.findElement(By.xpath(UssLocators.ussTabXpath)).click();
}

export async function clickOnJobsTab() {
    await driverFirefox.findElement(By.id(JobsLocators.jobTabId)).click();
}

export async function clickOnUssPanel() {
    await driverFirefox.findElement(By.id(UssLocators.ussPanelId)).click();
}

export async function clickOnAddSessionInUss() {
    await driverFirefox.findElement(By.id(UssLocators.ussAddSessionId)).click();
}

export async function clickOnJobsPanel() {
    await driverFirefox.findElement(By.id(JobsLocators.jobsPanelId)).click();
}

export async function clickOnAddSessionInJobs() {
    await driverFirefox.findElement(By.id(JobsLocators.jobsAddSessionId)).click();
}

export async function addProfileDetailsInUss(profileName: string) {
    const ussProfileName = await driverFirefox.findElement(By.xpath(UssLocators.emptyInputBoxXpath));
    ussProfileName.sendKeys(profileName);
    ussProfileName.sendKeys(Key.ENTER);
}

export async function addProfileDetailsInJobs(profileName: string) {
    const jobsProfileName = await driverFirefox.findElement(By.xpath(JobsLocators.emptyInputBoxXpath));
    jobsProfileName.sendKeys(profileName);
    jobsProfileName.sendKeys(Key.ENTER);
}

export async function getUssDefaultProfilename() {
    const ussProfile = await driverFirefox.wait(until.elementLocated(By.xpath(UssLocators.defaultUssProfileXpath)), WAITTIME).getText();
    return ussProfile;
}

export async function getJobsDefaultProfilename() {
    const jobsProfile = await driverFirefox.wait(until.elementLocated(By.xpath(JobsLocators.defaultJobsProfileXpath)), WAITTIME).getText();
    return jobsProfile;
}

export async function getUssProfilename() {
    const ussProfile = await driverFirefox.wait(until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)), WAITTIME).getText();
    return ussProfile;
}

export async function getJobsProfilename() {
    const jobsProfile = await driverFirefox.wait(until.elementLocated(By.xpath(JobsLocators.secondJobsProfileXpath)), WAITTIME).getText();
    return jobsProfile;
}

export async function getFavoritesNode() {
    const favoriteLink = await driverFirefox.wait(until.elementLocated(By.xpath(DatasetsLocators.favoriteTabXpath)), WAITTIME).getAttribute("title");
    return favoriteLink;
}

export async function getDatasetNode() {
    await driverFirefox.wait(until.elementLocated(By.id(DatasetsLocators.datasetTabId)), WAITTIME);
    const datasetLink = await driverFirefox.wait(until.elementLocated(By.xpath(DatasetsLocators.datasetTabXpath)), WAITTIME).getText();
    return datasetLink;
}

export async function getUssNode() {
    await driverFirefox.wait(until.elementLocated(By.id(UssLocators.ussTabId)), WAITTIME);
    const ussLink = await driverFirefox.wait(until.elementLocated(By.xpath(UssLocators.ussTabXpath)), WAITTIME).getText();
    return ussLink;
}

export async function getJobsNode() {
    await driverFirefox.wait(until.elementLocated(By.id(JobsLocators.jobTabId)), WAITTIME);
    const jobsLink = await driverFirefox.wait(until.elementLocated(By.xpath(JobsLocators.jobTabXpath)), WAITTIME).getText();
    return jobsLink;
}

export async function sleepTime(sleeptime: number) {
    await driverFirefox.sleep(sleeptime);
}
export async function refreshBrowser() {
    await driverFirefox.navigate().refresh();
}

export function closeBrowser() {
    driverFirefox.close();
}
