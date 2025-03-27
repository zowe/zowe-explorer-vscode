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

import { Constants } from "../globals/Constants";
import { VscSettings } from "../vscode/doc/VscSettings";

/**
 * @brief Provides pagination capabilities for a tree view.
 */
export class Paginator<T> {
    private items: T[] = [];

    private currentPage: number = 0;
    private maxItemsPerPage: number;
    private totalPageCount: number = 0;

    private constructor() {}

    /**
     * Creates a paginator instance and prepares it for use with the given array of items.
     * @param maxItemsPerPage The maximum amount of items to return per page
     * @returns A new {@link Paginator} instance, ready to be used for the given array
     * @throws If {@link maxItemsPerPage} is zero, a negative integer or a floating-point value
     */
    public static fromList<T>(items: T[], maxItemsPerPage?: number): Paginator<T> {
        const p = new Paginator<T>();
        if (maxItemsPerPage != null && (maxItemsPerPage <= 0 || !Number.isInteger(maxItemsPerPage))) {
            throw new Error("[Paginator.fromList] maxItemsPerPage must be a positive integer");
        }
        p.setMaxItemsPerPage(maxItemsPerPage ?? VscSettings.getDirectValue<number>("zowe.trees.itemsPerPage", Constants.DEFAULT_ITEMS_PER_PAGE));
        p.setItems(items);
        return p;
    }

    /**
     * Creates and sets up a default paginator instance.
     * @param maxItemsPerPage The maximum amount of items to return per page
     * @returns A new {@link Paginator} instance
     * @throws If {@link maxItemsPerPage} is zero, a negative integer or a floating-point value
     */
    public static default<T>(maxItemsPerPage?: number): Paginator<T> {
        const p = new Paginator<T>();
        if (maxItemsPerPage != null && (maxItemsPerPage <= 0 || !Number.isInteger(maxItemsPerPage))) {
            throw new Error("[Paginator.default] maxItemsPerPage must be a positive integer");
        }
        p.setMaxItemsPerPage(maxItemsPerPage ?? VscSettings.getDirectValue<number>("zowe.trees.itemsPerPage", Constants.DEFAULT_ITEMS_PER_PAGE));
        return p;
    }

    /**
     * Hold a reference to the given items to use for pagination.
     * @param items The array of items to keep a reference to
     */
    public setItems(items: T[]): void {
        this.items = items;
        if (this.items.length === 0) {
            this.totalPageCount = 1;
            this.currentPage = 0;
            return;
        }
        this.totalPageCount = Math.ceil(this.items.length / this.maxItemsPerPage);
        this.currentPage = 0;
    }

    /**
     * @returns the reference to the array of items used for pagination.
     */
    public getItems(): T[] {
        return this.items;
    }

    /**
     * Sets the maximum amount of items to return per page.
     * @param maxItems The desired number of items per page
     * @throws If {@link maxItems} is zero, a negative integer or a floating-point value
     */
    public setMaxItemsPerPage(maxItems: number): void {
        if (maxItems <= 0 || !Number.isInteger(maxItems)) {
            throw new Error("[Paginator.setMaxItemsPerPage] maxItems must be a positive integer");
        }
        this.maxItemsPerPage = maxItems;
        this.totalPageCount = Math.ceil(this.items.length / this.maxItemsPerPage);
    }

    /**
     * @returns the maximum amount of items per page.
     */
    public getMaxItemsPerPage(): number {
        return this.maxItemsPerPage;
    }

    /**
     * Move the paginator forward by one page.
     * This function has bounds-checking and stops at the last possible page.
     */
    public nextPage(): void {
        this.moveForward(1);
    }

    /**
     * Move the paginator backward by one page.
     * This function has bounds-checking and stops at the first page.
     */
    public previousPage(): void {
        this.currentPage = Math.max(this.currentPage - 1, 0);
    }

    /**
     * Move the paginator forward by the given number of pages.
     * If moving forward by given number of pages exceeds the total page count, the pagination window reflects the last page of elements.
     * @param numPages The number of pages to move forward
     */
    public moveForward(numPages: number): void {
        this.currentPage = Math.min(this.currentPage + numPages, this.getPageCount() - 1);
    }

    /**
     * Move the paginator backward by the given number of pages.
     * If moving backward by given number of pages results in a negative page index, the pagination window reflects the first page of elements.
     * @param numPages The number of pages to move backward
     */
    public moveBack(numPages: number): void {
        this.currentPage = Math.max(this.currentPage - numPages, 0);
    }

    /**
     * Set the current page for the pagination controller, starting with page 1 as the first page.
     * @param page The new page index
     */
    public setPage(page: number): void {
        if (page <= 0 || page >= this.totalPageCount || !Number.isInteger(page)) {
            throw new Error("[Paginator.setMaxItemsPerPage] page must be a valid integer between 1 and totalPageCount");
        }
        this.currentPage = page;
    }

    /**
     * Returns a slice of items within the given page number.
     * @param page Specify the page of items to return
     * @returns A slice of items starting at the given page
     */
    public getPage(page: number): T[] {
        if (page <= 0 || page >= this.totalPageCount || !Number.isInteger(page)) {
            throw new Error("[Paginator.getPage] page must be a valid integer between 1 and totalPageCount");
        }

        const lastPage = this.currentPage;
        this.setPage(page);
        const items = this.getCurrentPage();
        this.setPage(lastPage);

        return items;
    }

    /**
     * @returns the total number of pages for the current list of items in the paginator.
     */
    public getPageCount(): number {
        return this.totalPageCount;
    }

    /**
     * @returns the current page # (zero-indexed)
     */
    public getCurrentPageIndex(): number {
        return this.currentPage;
    }

    /**
     * @returns the current page of items
     */
    public getCurrentPage(): T[] {
        const startIndex = this.currentPage * this.maxItemsPerPage;
        const endIndex = Math.min(startIndex + this.maxItemsPerPage, this.items.length);
        return this.items.slice(startIndex, endIndex);
    }

    /**
     * @returns the current number of items
     */
    public getItemCount(): number {
        return this.items.length;
    }
}
