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

import { Constants } from "../../../src/globals";
import { Paginator } from "../../../src";

describe("Paginator class", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("default", () => {
        it("creates a default paginator instance, no max items/page provided", () => {
            const setMaxItemsPerPage = jest.spyOn(Paginator.prototype, "setMaxItemsPerPage");
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE);

            expect(p.getMaxItemsPerPage()).toBe(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(setMaxItemsPerPage).toHaveBeenCalledTimes(1);
            expect(setMaxItemsPerPage).toHaveBeenCalledWith(Constants.DEFAULT_ITEMS_PER_PAGE);
        });

        it("creates a default paginator instance, max items/page provided", () => {
            const p = Paginator.create(50);
            expect(p.getMaxItemsPerPage()).toBe(50);
        });
    });

    describe("fromList", () => {
        it("creates a new instance prepared for the given list, no max items/page provided", () => {
            const items = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE }).map((v, i) => i);
            const setItems = jest.spyOn(Paginator.prototype, "setItems");
            const setMaxItemsPerPage = jest.spyOn(Paginator.prototype, "setMaxItemsPerPage");
            const p = Paginator.fromList(items, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getItemCount()).toBe(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getItems()).toBe(items);
            expect(setItems).toHaveBeenCalledTimes(1);
            expect(setItems).toHaveBeenCalledWith(items);
            expect(setMaxItemsPerPage).toHaveBeenCalledWith(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getMaxItemsPerPage()).toBe(Constants.DEFAULT_ITEMS_PER_PAGE);
        });

        it("creates a new instance prepared for the given list, max items/page provided", () => {
            const items = Array.from({ length: 100 }).map((v, i) => i);
            const setItems = jest.spyOn(Paginator.prototype, "setItems");
            const setMaxItemsPerPage = jest.spyOn(Paginator.prototype, "setMaxItemsPerPage");
            const p = Paginator.fromList(items, 50);
            expect(p.getItemCount()).toBe(100);
            expect(p.getItems()).toBe(items);
            expect(setItems).toHaveBeenCalledTimes(1);
            expect(setItems).toHaveBeenCalledWith(items);
            expect(setMaxItemsPerPage).toHaveBeenCalledWith(50);
            expect(p.getMaxItemsPerPage()).toBe(50);
        });
    });

    describe("setItems", () => {
        it("sets the items property on the paginator when called, small list", () => {
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE);
            const items = ["A", "B", "C"];
            p.setItems(items);
            expect(p.getItems()).toBe(items);
            expect(p.getPageCount()).toBe(1);
            expect(p.getCurrentPageIndex()).toBe(0);
            expect(p.getCurrentPage()).toStrictEqual(items);
        });

        it("sets the items property on the paginator when called, large list", () => {
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE);
            const items = Array(Constants.DEFAULT_ITEMS_PER_PAGE * 3).map((i, _v) => `elem-${i}`);
            p.setItems(items);
            expect(p.getItems()).toBe(items);
            expect(p.getPageCount()).toBe(3);
            expect(p.getCurrentPageIndex()).toBe(0);
            expect(p.getCurrentPage()).toStrictEqual(items.slice(0, Constants.DEFAULT_ITEMS_PER_PAGE));
        });

        it("resets the total page count when the given list is empty", () => {
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE);
            const items = [];
            p.setItems(items);
            expect(p.getItems()).toBe(items);
            expect(p.getPageCount()).toBe(0);
            expect(p.getCurrentPageIndex()).toBe(0);
            expect(p.getCurrentPage()).toStrictEqual(items);
        });
    });

    describe("getItems", () => {
        const testItems = ["test1", "test2", "test3"];

        it("returns the same reference to array passed to setItems function", () => {
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE);
            p.setItems(testItems);
            expect(p.getItems()).toBe(testItems);
        });
        it("returns the same reference to array passed to fromList function", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getItems()).toBe(testItems);
        });
        it("reflects mutations to referenced array", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getItems()).toBe(testItems);
            testItems.pop();
            expect(p.getItems()).toBe(testItems);
        });
    });

    describe("setMaxItemsPerPage", () => {
        it("sets the maximum number of items per page", () => {
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE * 2);
            p.setMaxItemsPerPage(100);
            expect(p.getMaxItemsPerPage()).toBe(100);
        });

        it("throws an error if the given value is not positive", () => {
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.setMaxItemsPerPage.bind(p, -1)).toThrow("[Paginator.setMaxItemsPerPage] maxItems must be a positive integer");
        });

        it("throws an error if the given value is not an integer", () => {
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.setMaxItemsPerPage.bind(p, 1.1)).toThrow("[Paginator.setMaxItemsPerPage] maxItems must be a positive integer");
        });
    });

    describe("getMaxItemsPerPage", () => {
        it("returns the maximum provided at initialization", () => {
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE / 2);
            expect(p.getMaxItemsPerPage()).toBe(Constants.DEFAULT_ITEMS_PER_PAGE / 2);
        });

        it("returns the maximum value explicitly set by the user", () => {
            const p = Paginator.create(Constants.DEFAULT_ITEMS_PER_PAGE / 2);
            p.setMaxItemsPerPage(Constants.DEFAULT_ITEMS_PER_PAGE * 2);
            expect(p.getMaxItemsPerPage()).toBe(Constants.DEFAULT_ITEMS_PER_PAGE * 2);
        });
    });

    describe("nextPage", () => {
        const testItems = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE * 2 }).map((v, i) => i);

        it("advances the paginator to the next page", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.nextPage();
            expect(p.getCurrentPageIndex()).toBe(1);
            expect(p.getCurrentPage()).toStrictEqual(testItems.slice(Constants.DEFAULT_ITEMS_PER_PAGE));
        });

        it("does nothing if the paginator is already at the last page", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.nextPage();
            p.nextPage();
            expect(p.getCurrentPageIndex()).toBe(1);
            expect(p.getCurrentPage()).toStrictEqual(testItems.slice(Constants.DEFAULT_ITEMS_PER_PAGE));
        });
    });

    describe("previousPage", () => {
        const testItems = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE * 4 }).map((v, i) => i);

        it("moves back to the previous page", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.nextPage();
            p.nextPage();
            p.previousPage();
            expect(p.getCurrentPageIndex()).toBe(1);
            expect(p.getCurrentPage()).toStrictEqual(testItems.slice(Constants.DEFAULT_ITEMS_PER_PAGE, Constants.DEFAULT_ITEMS_PER_PAGE * 2));
        });

        it("does nothing if the paginator is already at the first page", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.previousPage();
            expect(p.getCurrentPageIndex()).toBe(0);
            expect(p.getCurrentPage()).toStrictEqual(testItems.slice(0, Constants.DEFAULT_ITEMS_PER_PAGE));
        });
    });

    describe("moveForward", () => {
        const testItems = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE * 4 }).map((v, i) => i);

        it("moves forward by the given number of pages", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.moveForward(3);
            expect(p.getCurrentPageIndex()).toBe(3);
            expect(p.getCurrentPage()).toStrictEqual(testItems.slice(Constants.DEFAULT_ITEMS_PER_PAGE * 3, Constants.DEFAULT_ITEMS_PER_PAGE * 4));
        });

        it("moves the paginator to the last page if the number of pages exceeds the total number of pages", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.moveForward(3);
            p.moveForward(3);
            expect(p.getCurrentPageIndex()).toBe(3);
            expect(p.getCurrentPage()).toStrictEqual(testItems.slice(Constants.DEFAULT_ITEMS_PER_PAGE * 3, Constants.DEFAULT_ITEMS_PER_PAGE * 4));
        });
    });

    describe("moveBack", () => {
        const testItems = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE * 4 }).map((v, i) => i);

        it("moves back by the given number of pages", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.moveForward(3);
            p.moveBack(2);
            expect(p.getCurrentPageIndex()).toBe(1);
            expect(p.getCurrentPage()).toStrictEqual(testItems.slice(Constants.DEFAULT_ITEMS_PER_PAGE, Constants.DEFAULT_ITEMS_PER_PAGE * 2));
        });

        it("moves the paginator to the first page if moving back by too many pages", () => {
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.moveForward(3);
            p.moveBack(5);
            expect(p.getCurrentPageIndex()).toBe(0);
            expect(p.getCurrentPage()).toStrictEqual(testItems.slice(0, Constants.DEFAULT_ITEMS_PER_PAGE));
        });
    });

    describe("setPage", () => {
        it("sets the page to the given index when valid", () => {
            const testItems = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE * 4 }).map((v, i) => i);
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.setPage.bind(p, 1)).not.toThrow();
            expect(p.getCurrentPageIndex()).toBe(1);
            expect(p.getCurrentPage()).toStrictEqual(testItems.slice(Constants.DEFAULT_ITEMS_PER_PAGE, Constants.DEFAULT_ITEMS_PER_PAGE * 2));
        });
        it("throws an error if providing a negative page index", () => {
            const p = Paginator.fromList(["A", "B", "C"], Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.setPage.bind(p, -1)).toThrow("[Paginator.setPage] page must be a valid integer between 0 and totalPageCount - 1");
        });

        it("throws an error if the page index is greater than the total page count", () => {
            const p = Paginator.fromList(["A", "B", "C"], Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.setPage.bind(p, 2)).toThrow("[Paginator.setPage] page must be a valid integer between 0 and totalPageCount - 1");
        });

        it("throws an error if the page index is not an integer", () => {
            const p = Paginator.fromList(["A", "B", "C"], Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.setPage.bind(p, 1.1)).toThrow("[Paginator.setPage] page must be a valid integer between 0 and totalPageCount - 1");
        });
    });

    describe("getPage", () => {
        it("returns the contents for the given page index", () => {
            const testItems = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE * 4 }).map((v, i) => i);
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getPage(2)).toStrictEqual(testItems.slice(Constants.DEFAULT_ITEMS_PER_PAGE * 2, Constants.DEFAULT_ITEMS_PER_PAGE * 3));
        });

        it("throws an error if the given index is greater than total page count", () => {
            const testItems = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE * 4 }).map((v, i) => i);
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getPage.bind(p, 5)).toThrow("[Paginator.getPage] page must be a valid integer between 0 and totalPageCount - 1");
        });

        it("throws an error if the given index is less than 0", () => {
            const testItems = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE }).map((v, i) => i);
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getPage.bind(p, -1)).toThrow("[Paginator.getPage] page must be a valid integer between 0 and totalPageCount - 1");
        });

        it("throws an error if the given index is not an integer", () => {
            const testItems = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE }).map((v, i) => i);
            const p = Paginator.fromList(testItems, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getPage.bind(p, 1.1)).toThrow("[Paginator.getPage] page must be a valid integer between 0 and totalPageCount - 1");
        });
    });

    describe("getPageCount", () => {
        it("returns the total page count", () => {
            const p = Paginator.fromList(
                Array.from({ length: 1000 }).map((v, i) => `${i}`),
                Constants.DEFAULT_ITEMS_PER_PAGE
            );
            expect(p.getPageCount()).toBe(10);
        });
    });

    describe("getCurrentPageIndex", () => {
        it("returns 0 when a paginator is just initialized", () => {
            const p = Paginator.fromList(
                Array.from({ length: 200 }).map((v, i) => `${i}`),
                Constants.DEFAULT_ITEMS_PER_PAGE
            );
            expect(p.getCurrentPageIndex()).toBe(0);
        });

        it("returns a new page index after moving forward", () => {
            const p = Paginator.fromList(
                Array.from({ length: 200 }).map((v, i) => `${i}`),
                Constants.DEFAULT_ITEMS_PER_PAGE
            );
            p.nextPage();
            expect(p.getCurrentPageIndex()).toBe(1);
        });

        it("returns a new page index after moving backward", () => {
            const p = Paginator.fromList(
                Array.from({ length: 400 }).map((v, i) => `${i}`),
                Constants.DEFAULT_ITEMS_PER_PAGE
            );
            p.setPage(3);
            p.previousPage();
            expect(p.getCurrentPageIndex()).toBe(2);
        });
    });

    describe("getCurrentPage", () => {
        it("returns the first page after a paginator is initialized", () => {
            const list = Array.from({ length: 200 }).map((v, i) => `${i}`);
            const p = Paginator.fromList(list, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getCurrentPage()).toStrictEqual(list.slice(0, Constants.DEFAULT_ITEMS_PER_PAGE));
        });

        it("returns a different page after a paginator moves forward", () => {
            const list = Array.from({ length: 200 }).map((v, i) => `${i}`);
            const p = Paginator.fromList(list, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.nextPage();
            expect(p.getCurrentPage()).toStrictEqual(list.slice(Constants.DEFAULT_ITEMS_PER_PAGE));
        });

        it("returns a different page after a paginator moves backward", () => {
            const list = Array.from({ length: 400 }).map((v, i) => `${i}`);
            const p = Paginator.fromList(list, Constants.DEFAULT_ITEMS_PER_PAGE);
            p.moveForward(2);
            p.previousPage();
            expect(p.getCurrentPage()).toStrictEqual(list.slice(Constants.DEFAULT_ITEMS_PER_PAGE, Constants.DEFAULT_ITEMS_PER_PAGE * 2));
        });
    });

    describe("getItemCount", () => {
        it("returns the total number of items", () => {
            const list = Array.from({ length: 400 }).map((v, i) => `${i}`);
            const p = Paginator.fromList(list, Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getItemCount()).toBe(list.length);
        });
    });
});
