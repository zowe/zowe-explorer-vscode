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

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as driverFF from "../../src/theia/extension.theiaFF";
import * as driverChrome from "../../src/theia/extension.theiaChrome";
import { sleep } from "@zowe/cli";

const TIMEOUT = 45000;
const SLEEPTIME = 10000;
const SleepForTwoSec = 2000;
declare var it: any;
const expect = chai.expect;
chai.use(chaiAsPromised);

describe("Add Default Profile", () => {

    before(async () => {
        await driverFF.openBrowser();
        await sleep(SleepForTwoSec);
        await driverFF.OpenTheiaInFF();
        await sleep(SLEEPTIME);
        await driverFF.clickOnZoweExplorer();
    });

    it("should open Zowe Explorer and find the Favorites node", async () => {
        const favoriteLink = await driverFF.getFavouritesNode();
        expect(favoriteLink).to.equal("Favorites");
    }).timeout(TIMEOUT);

    it("should find the Data Sets node", async () => {
        const datasetLink = await driverFF.getDatasetNode();
        expect(datasetLink).to.equal("DATA SETS");
    }).timeout(TIMEOUT);

    it("should find the USS node", async () => {
        const ussLink = await driverFF.getUssNode();
        expect(ussLink).to.equal("UNIX SYSTEM SERVICES (USS)");
    }).timeout(TIMEOUT);

    it("should find the Jobs node", async () => {
        const jobsLink = await driverFF.getJobsNode();
        expect(jobsLink).to.equal("JOBS");
    }).timeout(TIMEOUT);

    it("Should Add Default Profile in DATA SETS", async () => {
        await driverFF.clickOnDatasetsPanel();
        await driverFF.clickOnAddSessionInDatasets();
        await driverFF.addProfileDetails("DefaultProfile");
        const datasetProfile = await driverFF.getDatasetsDefaultProfilename();
        expect(datasetProfile).to.equal("DefaultProfile");
    });

    it("Should Default profile visible in USS", async () => {
        await driverFF.refreshBrowser();
        await sleep(SLEEPTIME);
        await driverFF.clickOnDatasetsTab();
        await driverFF.clickOnUssTab();
        const ussProfile = await driverFF.getUssDefaultProfilename();
        expect(ussProfile).to.equal("DefaultProfile");
    });

    it("Should Default profile visible in JOBS", async () => {
        await driverFF.clickOnUssTabs();
        await driverFF.clickOnJobsTab();
        const jobsProfile = await driverFF.getJobsDefaultProfilename();
        expect(jobsProfile).to.equal("DefaultProfile");
    });

    after(async () => driverFF.closeBrowser());
});

describe("Add Profiles", () => {

    before(async () => {
        await driverFF.openBrowser();
        await sleep(SleepForTwoSec);
        await driverFF.OpenTheiaInFF();
        await sleep(SLEEPTIME);
        await driverFF.clickOnZoweExplorer();
    });

    it("Should Add Profile in DATA SETS", async () => {
        await driverFF.clickOnDatasetsPanel();
        await driverFF.clickOnAddSessionInDatasets();
        await driverFF.addProfileDetails("TestSeleniumProfile");
        await sleep(SleepForTwoSec);
        const datasetProfile = await driverFF.getDatasetsProfilename();
        expect(datasetProfile).to.equal("TestSeleniumProfile");
    });

    it("Should Add Existing Profile in USS", async () => {
        await driverFF.clickOnDatasetsTab();
        await driverFF.clickOnUssTab();
        await driverFF.clickOnUssPanel();
        await driverFF.clickOnAddSessionInUss();
        await driverFF.addProfileDetailsInUss("TestSeleniumProfile");
        const ussProfile = await driverFF.getUssProfilename();
        expect(ussProfile).to.equal("TestSeleniumProfile");
    });

    it("Should Add Existing Profile in JOBS", async () => {
        await driverFF.clickOnUssTabs();
        await driverFF.clickOnJobsTab();
        await driverFF.clickOnJobsPanel();
        await driverFF.clickOnAddSessionInJobs();
        await driverFF.addProfileDetailsInJobs("TestSeleniumProfile");
        const jobsProfile = await driverFF.getJobsProfilename();
        expect(jobsProfile).to.equal("TestSeleniumProfile");
    });

    after(async () => driverFF.closeBrowser());
});

describe("Add Profile to Favorites", () => {
    before(async () => {
        await driverChrome.openBrowser();
        await sleep(SleepForTwoSec);
        await driverChrome.OpenTheiaInChrome();
        await sleep(SLEEPTIME);
        await driverChrome.clickOnZoweExplorer();
    });

    it("Should Add Profile to Favorites under DATA SETS", async () => {
        await driverChrome.addProfileToFavoritesInDatasets();
        await driverChrome.clickOnFavoriteTabInDatasets();
        const favoriteProfile = await driverChrome.getFavoritePrfileNameFromDatasets();
        expect(favoriteProfile).to.equal("TestSeleniumProfile");
    });

    it("Should Add Profile to Favorites under USS", async () => {
        await driverChrome.clickOnDatasetsTab();
        await sleep(SleepForTwoSec);
        await driverChrome.clickOnUssTabs();
        await sleep(SleepForTwoSec);
        await driverChrome.addProfileToFavoritesInUss();
        await driverChrome.clickOnFavoriteTabInUss();
        await sleep(SleepForTwoSec);
        const favoriteProfile = await driverChrome.getFavoritePrfileNameFromUss();
        expect(favoriteProfile).to.equal("TestSeleniumProfile");
    });

    it("Should Add Profile to Favorites under JOBS", async () => {
        await driverChrome.clickOnUssTabs();
        await sleep(SleepForTwoSec);
        await driverChrome.clickOnJobsTab();
        await driverChrome.addProfileToFavoritesInJobs();
        await sleep(SleepForTwoSec);
        await driverChrome.clickOnFavoriteTabInJobs();
        await sleep(SleepForTwoSec);
        const favoriteProfile = await driverChrome.getFavoritePrfileNameFromJobs();
        expect(favoriteProfile).to.equal("TestSeleniumProfile");
    });

    after(async () => driverChrome.closeBrowser());
});

describe("Remove Profile from Favorites", () => {
    before(async () => {
        await driverChrome.openBrowser();
        await sleep(SleepForTwoSec);
        await driverChrome.OpenTheiaInChrome();
        await sleep(SLEEPTIME);
        await driverChrome.clickOnZoweExplorer();
    });

    it("Should Remove Profile from Favorites under DATA SETS", async () => {
        await driverChrome.clickOnFavoriteTabInDatasets();
        await sleep(SleepForTwoSec);
        await driverChrome.clickOnFavoriteProfileInDatasets();
        await driverChrome.removeFavoriteProfileFromDatasets();
        await sleep(SleepForTwoSec);
        await driverChrome.refreshBrowser();
        await sleep(SLEEPTIME);
    });

    it("Should Remove Profile from Favorites under USS", async () => {
        await driverChrome.clickOnDatasetsTab();
        await sleep(SleepForTwoSec);
        await driverChrome.clickOnUssTabs();
        await sleep(SleepForTwoSec);
        await driverChrome.clickOnFavoriteTabInUss();
        await driverChrome.clickOnFavoriteProfileInUss();
        await driverChrome.removeFavoriteProfileFromUss();
        await sleep(SleepForTwoSec);
        await driverChrome.refreshBrowser();
        await sleep(SLEEPTIME);
    });

    // it("Should Remove Profile from Favorites under JOBS", async () => {
    //     await driverChrome.clickOnUssTabs();
    //     await sleep(SLEEP);
    //     await driverChrome.clickOnJobsTab();
    //     await driverChrome.clickOnFavoriteTabInJobsAfterRefresh();
    //     await driverChrome.clickOnFavoriteTabInJobs();
    //     await driverChrome.clickOnFavoriteProfileInJobs();
    //     await driverChrome.removeFavoriteProfileFromJobs();
    //     await sleep(SLEEP);
    //     await driverChrome.refreshBrowser();
    //     await sleep(SLEEPTIME);
    // });

    after(async () => driverChrome.closeBrowser());
});

describe("Hide Profile", () => {
    before(async () => {
        await driverChrome.openBrowser();
        await sleep(SleepForTwoSec);
        await driverChrome.OpenTheiaInChrome();
        await sleep(SLEEPTIME);
        await driverChrome.clickOnZoweExplorer();
    });

    it("Should Hide Profile from USS", async () => {
        await driverChrome.clickOnDatasetsTab();
        await sleep(SleepForTwoSec);
        await driverChrome.clickOnUssTabs();
        await sleep(SleepForTwoSec);
        await driverChrome.hideProfileInUss();
        await sleep(SleepForTwoSec);
    });
    it("Should Hide Profile from JOBS", async () => {
        await driverChrome.clickOnUssTabs();
        await sleep(SleepForTwoSec);
        await driverChrome.clickOnJobsTab();
        await driverChrome.hideProfileInJobs();
        await sleep(SleepForTwoSec);
    });

    after(async () => driverChrome.closeBrowser());
});

describe("Delete Profiles", () => {
    before(async () => {
        await driverChrome.openBrowser();
        await sleep(SleepForTwoSec);
        await driverChrome.OpenTheiaInChrome();
        await sleep(SLEEPTIME);
        await driverChrome.clickOnZoweExplorer();
    });

    it("Should Delete Default Profile from DATA SETS", async () => {
        const deleteConfrmationMsg = await driverChrome.deleteDefaultProfileInDatasets();
        expect(deleteConfrmationMsg).to.equal("Profile DefaultProfile was deleted.");
    });

    it("Should Delete Profile from DATA SETS", async () => {
        await driverChrome.closeNotificationMessage();
        const deleteConfrmationMsg = await driverChrome.deleteProfileInDatasets();
        expect(deleteConfrmationMsg).to.equal("Profile TestSeleniumProfile was deleted.");
    });

    after(async () => driverChrome.closeBrowser());
});
