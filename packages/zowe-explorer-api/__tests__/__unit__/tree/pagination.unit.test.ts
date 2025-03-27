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
import { Paginator } from "../../../src/tree";
import { VscSettings } from "../../../src/vscode/doc/VscSettings";

describe("Paginator", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("default", () => {
        it("creates a default paginator instance, no max items/page provided", () => {
            const getDirectValueMock = jest.spyOn(VscSettings, "getDirectValue").mockReturnValueOnce(Constants.DEFAULT_ITEMS_PER_PAGE);
            const setMaxItemsPerPage = jest.spyOn(Paginator.prototype, "setMaxItemsPerPage");
            const p = Paginator.default();

            expect(p.getMaxItemsPerPage()).toBe(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(setMaxItemsPerPage).toHaveBeenCalledTimes(1);
            expect(setMaxItemsPerPage).toHaveBeenCalledWith(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(getDirectValueMock).toHaveBeenCalledTimes(1);
            expect(getDirectValueMock).toHaveBeenCalledWith("zowe.trees.itemsPerPage", Constants.DEFAULT_ITEMS_PER_PAGE);
        });

        it("creates a default paginator instance, max items/page provided", () => {
            const getDirectValue = jest.spyOn(VscSettings, "getDirectValue");
            const p = Paginator.default(50);
            expect(p.getMaxItemsPerPage()).toBe(50);
            expect(getDirectValue).not.toHaveBeenCalled();
        });
    });

    describe("fromList", () => {
        it("creates a new instance prepared for the given list, no max items/page provided", () => {
            const items = Array.from({ length: Constants.DEFAULT_ITEMS_PER_PAGE }).map((v, i) => i);
            const setItems = jest.spyOn(Paginator.prototype, "setItems");
            const setMaxItemsPerPage = jest.spyOn(Paginator.prototype, "setMaxItemsPerPage");
            const getDirectValueMock = jest.spyOn(VscSettings, "getDirectValue").mockReturnValueOnce(Constants.DEFAULT_ITEMS_PER_PAGE);
            const p = Paginator.fromList(items);
            expect(p.getItemCount()).toBe(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getItems()).toBe(items);
            expect(setItems).toHaveBeenCalledTimes(1);
            expect(setItems).toHaveBeenCalledWith(items);
            expect(setMaxItemsPerPage).toHaveBeenCalledWith(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.getMaxItemsPerPage()).toBe(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(getDirectValueMock).toHaveBeenCalledTimes(1);
            expect(getDirectValueMock).toHaveBeenCalledWith("zowe.trees.itemsPerPage", Constants.DEFAULT_ITEMS_PER_PAGE);
        });

        it("creates a new instance prepared for the given list, max items/page provided", () => {
            const items = Array.from({ length: 100 }).map((v, i) => i);
            const setItems = jest.spyOn(Paginator.prototype, "setItems");
            const setMaxItemsPerPage = jest.spyOn(Paginator.prototype, "setMaxItemsPerPage");
            const getDirectValue = jest.spyOn(VscSettings, "getDirectValue");
            const p = Paginator.fromList(items, 50);
            expect(p.getItemCount()).toBe(100);
            expect(p.getItems()).toBe(items);
            expect(setItems).toHaveBeenCalledTimes(1);
            expect(setItems).toHaveBeenCalledWith(items);
            expect(setMaxItemsPerPage).toHaveBeenCalledWith(50);
            expect(p.getMaxItemsPerPage()).toBe(50);
            expect(getDirectValue).not.toHaveBeenCalled();
        });
    });

    describe("setItems", () => {
        it("sets the items property on the paginator when called, small list", () => {
            const p = Paginator.default(Constants.DEFAULT_ITEMS_PER_PAGE);
            const items = ["A", "B", "C"];
            p.setItems(items);
            expect(p.getItems()).toBe(items);
            expect(p.getPageCount()).toBe(1);
            expect(p.getCurrentPageIndex()).toBe(0);
            expect(p.getCurrentPage()).toStrictEqual(items);
        });

        it("sets the items property on the paginator when called, large list", () => {
            const p = Paginator.default(Constants.DEFAULT_ITEMS_PER_PAGE);
            const items = Array(Constants.DEFAULT_ITEMS_PER_PAGE * 3).map((i, v) => `elem-${i}`);
            p.setItems(items);
            expect(p.getItems()).toBe(items);
            expect(p.getPageCount()).toBe(3);
            expect(p.getCurrentPageIndex()).toBe(0);
            expect(p.getCurrentPage()).toStrictEqual(items.slice(0, Constants.DEFAULT_ITEMS_PER_PAGE));
        });

        it("resets the total page count when the given list is empty", () => {
            const p = Paginator.default(Constants.DEFAULT_ITEMS_PER_PAGE);
            const items = [];
            p.setItems(items);
            expect(p.getItems()).toBe(items);
            expect(p.getPageCount()).toBe(1);
            expect(p.getCurrentPageIndex()).toBe(0);
            expect(p.getCurrentPage()).toStrictEqual(items);
        });
    });

    describe("getItems", () => {
        const testItems = ["test1", "test2", "test3"];

        it("returns the same reference to array passed to setItems function", () => {
            const p = Paginator.default(Constants.DEFAULT_ITEMS_PER_PAGE);
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
            const p = Paginator.default(Constants.DEFAULT_ITEMS_PER_PAGE * 2);
            p.setMaxItemsPerPage(100);
            expect(p.getMaxItemsPerPage()).toBe(100);
        });

        it("throws an error if the given value is not positive", () => {
            const p = Paginator.default(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.setMaxItemsPerPage.bind(-1)).toThrow("[Paginator.setMaxItemsPerPage] maxItems must be a positive integer");
        });

        it("throws an error if the given value is not an integer", () => {
            const p = Paginator.default(Constants.DEFAULT_ITEMS_PER_PAGE);
            expect(p.setMaxItemsPerPage.bind(1.1)).toThrow("[Paginator.setMaxItemsPerPage] maxItems must be a positive integer");
        });
    });
});
