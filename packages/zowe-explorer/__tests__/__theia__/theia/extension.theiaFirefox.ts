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
import * as firefox from "selenium-webdriver/firefox";
import { TheiaLocator, DatasetsLocators, UssLocators, JobsLocators } from "./Locators";

const WAITTIME = 30000;
const SHORTSLEEPTIME = 2000;
let driverFirefox: any;

export async function openBrowser() {
    const firefoxOptions = new firefox.Options();
    firefoxOptions.headless();
    driverFirefox = new Builder().forBrowser("firefox").setFirefoxOptions(firefoxOptions).build();
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

export async function clickOnDatasetsPanel() {
    await driverFirefox.findElement(By.id(DatasetsLocators.datasetsPanelId)).click();
}

export async function clickOnAddSessionInDatasets() {
    await driverFirefox.findElement(By.id(DatasetsLocators.datasetsAddSessionId)).click();
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

export async function addProfileDetails(profileName: string) {
    await driverFirefox.findElement(By.id(DatasetsLocators.datasetsAddSessionId)).click();
    await driverFirefox.sleep(SHORTSLEEPTIME);
    await driverFirefox.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath)).sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const datasetProfileName = await driverFirefox.wait(
        until.elementLocated(By.xpath(DatasetsLocators.emptyInputBoxXpath)),
        WAITTIME
    );
    datasetProfileName.sendKeys(profileName);
    datasetProfileName.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const zosUrl = await driverFirefox.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    zosUrl.sendKeys("fakehost.net:1003");
    zosUrl.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const username = await driverFirefox.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    username.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const password = await driverFirefox.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    password.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const authorization = await driverFirefox.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    authorization.sendKeys("False - Accept connections with self-signed certificates");
    authorization.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const basepath = await driverFirefox.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    basepath.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const encoding = await driverFirefox.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    encoding.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
    const responseTimeout = await driverFirefox.findElement(By.xpath(DatasetsLocators.emptyInputBoxXpath));
    responseTimeout.sendKeys(Key.ENTER);
    await driverFirefox.sleep(SHORTSLEEPTIME);
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

export async function getDatasetsDefaultProfilename() {
    const datasetProfile = await driverFirefox
        .wait(until.elementLocated(By.id(DatasetsLocators.defaultDatasetsProfileId)), WAITTIME)
        .getText();
    return datasetProfile;
}

export async function getUssDefaultProfilename() {
    const ussProfile = await driverFirefox
        .wait(until.elementLocated(By.xpath(UssLocators.defaultUssProfileXpath)), WAITTIME)
        .getText();
    return ussProfile;
}

export async function getJobsDefaultProfilename() {
    const jobsProfile = await driverFirefox
        .wait(until.elementLocated(By.xpath(JobsLocators.defaultJobsProfileXpath)), WAITTIME)
        .getText();
    return jobsProfile;
}

export async function getDatasetsProfilename() {
    const datasetProfile = await driverFirefox
        .wait(until.elementLocated(By.id(DatasetsLocators.secondDatasetProfileId)), WAITTIME)
        .getText();
    return datasetProfile;
}

export async function getUssProfilename() {
    const ussProfile = await driverFirefox
        .wait(until.elementLocated(By.xpath(UssLocators.secondUssProfileXpath)), WAITTIME)
        .getText();
    return ussProfile;
}

export async function getJobsProfilename() {
    const jobsProfile = await driverFirefox
        .wait(until.elementLocated(By.xpath(JobsLocators.secondJobsProfileXpath)), WAITTIME)
        .getText();
    return jobsProfile;
}

export async function getFavouritesNode() {
    const favoriteLink = await driverFirefox
        .wait(until.elementLocated(By.id(DatasetsLocators.favoriteTabId)), WAITTIME)
        .getAttribute("title");
    return favoriteLink;
}

export async function getDatasetNode() {
    await driverFirefox.wait(until.elementLocated(By.id(DatasetsLocators.datasetTabId)), WAITTIME);
    const datasetLink = await driverFirefox
        .wait(until.elementLocated(By.xpath(DatasetsLocators.datasetTabXpath)), WAITTIME)
        .getText();
    return datasetLink;
}

export async function getUssNode() {
    await driverFirefox.wait(until.elementLocated(By.id(UssLocators.ussTabId)), WAITTIME);
    const ussLink = await driverFirefox
        .wait(until.elementLocated(By.xpath(UssLocators.ussTabXpath)), WAITTIME)
        .getText();
    return ussLink;
}

export async function getJobsNode() {
    await driverFirefox.wait(until.elementLocated(By.id(JobsLocators.jobTabId)), WAITTIME);
    const jobsLink = await driverFirefox
        .wait(until.elementLocated(By.xpath(JobsLocators.jobTabXpath)), WAITTIME)
        .getText();
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
