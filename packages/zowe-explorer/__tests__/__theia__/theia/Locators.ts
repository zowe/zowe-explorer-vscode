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

export const TheiaLocator = {
    theiaUrl: "http://localhost:3000",
    zoweExplorerxId: "shell-tab-plugin-view-container:zowe",
};

export const DatasetsLocators = {
    datasetTabId: "plugin-view-container:zowe--plugin-view:zowe.ds.explorer",
    datasetTabXpath: "//span[@title='Data Sets']",
    datasetsPanelId: "plugin-view:zowe.ds.explorer",
    datasetsAddSessionId: "zowe.ds.addSession-as-tabbar-toolbar-item",
    emptyInputBoxXpath: "//*[@class='input empty']",
    createNewConnectionListXpath: "//*[@class='monaco-list-row focused'][1]",
    inputBoxXpath: "//*[@class='input']",
    defaultDatasetsProfileXpath: "(//div[contains(@id,'DefaultProfile')])[1]",
    secondDatasetProfileXpath: "(//div[contains(@id,'TestSeleniumProfile')])[1]",
    favoriteTabXpath: "(//div[contains(@id,'Favorites')])[1]",
    favoriteProfileInDatasetXpath: "(//div[contains(@id,'Favorites') and contains(@id,'TestSeleniumProfile')])",
    addToFavoriteOptionXpath: "//li[@data-command='zowe.ds.saveSearch']",
    removeFavoriteProfileFromDatasetsOptionXpath: "//li[@data-command='zowe.ds.removeFavProfile']",
    manageProfileFromDatasetsXpath: "(//li[@data-command='zowe.profileManagement'])",
};

export const UssLocators = {
    ussTabId: "plugin-view-container:zowe--plugin-view:zowe.uss.explorer",
    ussTabXpath: "//span[@title='Unix System Services (USS)']",
    ussPanelId: "plugin-view:zowe.uss.explorer",
    ussAddSessionId: "zowe.uss.addSession-as-tabbar-toolbar-item",
    emptyInputBoxXpath: "//*[@class='input empty']",
    defaultUssProfileXpath: "(//div[contains(@id,'DefaultProfile')])[2]",
    secondUssProfileXpath: "(//div[contains(@id,'TestSeleniumProfile')])[2]",
    favoriteTabXpath: "(//div[contains(@id,'Favorites')])[2]",
    favoriteProfileInUssXpath: "(//div[contains(@id,'Favorites') and contains(@id,'TestSeleniumProfile')])",
    addToFavoriteOptionXpath: "//li[@data-command='zowe.uss.addFavorite']",
    removeFavoriteProfileFromUssOptionXpath: "//li[@data-command='zowe.uss.removeFavProfile']",
    hideProfileFromUssOptionXpath: "//li[@data-command='zowe.uss.removeSession']",
    manageProfileFromUnixXpath: "(//li[@data-command='zowe.profileManagement'])",
};

export const JobsLocators = {
    jobTabId: "plugin-view-container:zowe--plugin-view:zowe.jobs.explorer",
    jobTabXpath: "//span[@title='Jobs']",
    jobsPanelId: "zowe.jobs.explorer",
    jobsAddSessionId: "zowe.jobs.addJobsSession-as-tabbar-toolbar-item",
    emptyInputBoxXpath: "//*[@class='input empty']",
    defaultJobsProfileXpath: "(//div[contains(@id,'DefaultProfile')])[3]",
    secondJobsProfileXpath: "(//div[contains(@id,'TestSeleniumProfile')])[3]",
    favoriteTabXpath: "(//div[contains(@id,'Favorites')])[3]",
    favoriteProfileInJobsXpath: "(//div[contains(@id,'Favorites') and contains(@id,'TestSeleniumProfile')])",
    addToFavoriteOptionXpath: "//li[@data-command='zowe.jobs.addFavorite']",
    removeFavoriteProfileFromJobsOptionXpath: "//li[@data-command='zowe.jobs.removeFavProfile']",
    hideProfileFromJobsOptionXpath: "//li[@data-command='zowe.jobs.removeJobsSession']",
    secondJobsProfileBeforeHidingXpath: "(//div[contains(@id,'TestSeleniumProfile')])[2]",
    manageProfileFromJobsXpath: "(//li[@data-command='zowe.profileManagement'])",
};

export const TheiaNotificationMessages = {
    closeTheiaNotificationWarningMsgXpath: "/html/body/div[3]/div/div[1]/div/div/div/div/ul/li",
    deleteProfileNotificationMsg: "/html/body/div[3]/div/div[1]/div/div/div/div/div[2]/span",
    removeFavoriteProfileConfirmationXpath: `//*[@id="theia-dialog-shell"]/div/div[3]/button[1]`,
};
