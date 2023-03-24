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
    createNewConnectionListXpath: "//*[@class='monaco-list-row'][1]",
    inputBoxXpath: "//*[@class='input']",
    defaultDatasetsProfileId: "/iDefaultProfile",
    secondDatasetProfileId: "/iTestSeleniumProfile",
    favoriteTabId: "/iFavorites",
    favoriteProfileInDatasetId: "/iFavorites/iTestSeleniumProfile",
    addToFavoriteOptionXpath: "//li[@data-command='zowe.ds.saveSearch']",
    searchSymbolInFavoriteXpath: "//*[@id='/iFavorites/iTestSeleniumProfile/i']",
    removeFavoriteProfileFromDatasetsOptionXpath: "//li[@data-command='zowe.ds.removeFavProfile']",
    secondDatasetProfileBeforeDeletingId: "/iTestSeleniumProfile",
    deleteProfileFromDatasetsXpath: "(//li[@data-command='zowe.ds.deleteProfile'])",
};

export const UssLocators = {
    ussTabId: "plugin-view-container:zowe--plugin-view:zowe.uss.explorer",
    ussTabXpath: "//span[@title='Unix System Services (USS)']",
    ussPanelId: "plugin-view:zowe.uss.explorer",
    ussAddSessionId: "zowe.uss.addSession-as-tabbar-toolbar-item",
    emptyInputBoxXpath: "//*[@class='input empty']",
    defaultUssProfileXpath: "(//div[@id='/iDefaultProfile'])[2]",
    secondUssProfileXpath: "(//div[@id='/iTestSeleniumProfile'])[2]",
    favoriteTabXpath: "(//div[@id='/iFavorites'])[2]",
    favoriteProfileInUssXpath: "(//div[@id='/iFavorites/iTestSeleniumProfile'])",
    addToFavoriteOptionXpath: "//li[@data-command='zowe.uss.addFavorite']",
    favoriteProfileInUssBeforeRemovingXpath: "(//div[@id='/iFavorites/iTestSeleniumProfile'])",
    removeFavoriteProfileFromUssOptionXpath: "//li[@data-command='zowe.uss.removeFavProfile']",
    hideProfileFromUssOptionXpath: "//li[@data-command='zowe.uss.removeSession']",
    searchSymbolInFavoriteXpath: "//*[@id='/iFavorites/iTestSeleniumProfile/i']",
};

export const JobsLocators = {
    jobTabId: "plugin-view-container:zowe--plugin-view:zowe.jobs.explorer",
    jobTabXpath: "//span[@title='Jobs']",
    jobsPanelId: "zowe.jobs.explorer",
    jobsAddSessionId: "zowe.jobs.addJobsSession-as-tabbar-toolbar-item",
    emptyInputBoxXpath: "//*[@class='input empty']",
    defaultJobsProfileXpath: "(//div[@id='/iDefaultProfile'])[3]",
    secondJobsProfileXpath: "(//div[@id='/iTestSeleniumProfile'])[3]",
    favoriteTabXpath: "(//div[@id='/iFavorites'])[3]",
    favoriteTabAfterRefreshXpath: "(//div[@id='/iFavorites'])[2]",
    favoriteProfileInJobsXpath: "(//div[@id='/iFavorites/iTestSeleniumProfile'])",
    favoriteprofile: "(//div[@id='/iFavorites/iTestSeleniumProfile'])",
    addToFavoriteOptionXpath: "//li[@data-command='zowe.jobs.addFavorite']",
    favoriteProfileInJobsBeforeRemovingXpath: "//div[@id='/iFavorites/iTestSeleniumProfile/iPrefix:*']",
    removeFavoriteProfileFromJobsOptionXpath: "//li[@data-command='zowe.jobs.removeFavProfile']",
    hideProfileFromJobsOptionXpath: "//li[@data-command='zowe.jobs.removeJobsSession']",
    secondJobsProfileIdBeforeHidingXpath: "(//div[@id='/iTestSeleniumProfile'])[2]",
    favoriteprofilexpath: "//div[@id='/iFavorites/iTestSeleniumProfile']",
};

export const TheiaNotificationMessages = {
    closeTheiaNotificationWarningMsgXpath: "/html/body/div[3]/div/div[1]/div/div/div/div/ul/li",
    deleteProfileNotificationMsg: "/html/body/div[3]/div/div[1]/div/div/div/div/div[2]/span",
    removeFavoriteProfileConfirmationXpath: `//*[@id="theia-dialog-shell"]/div/div[3]/button[1]`,
};
