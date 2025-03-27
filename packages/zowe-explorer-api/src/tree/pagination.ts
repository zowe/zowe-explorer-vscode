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

import { Constants } from "../globals";
import { VscSettings } from "../vscode/doc/VscSettings";

/**
 * @brief Provides pagination capabilities for a tree view.
 */
export class Paginator<T> {
    private childrenReference: T[] = [];

    private currentPage: number = 0;
    private itemsPerPage: number;
    private totalPageCount: number = 0;

    public constructor(numItems?: number) {
        this.itemsPerPage = numItems ?? VscSettings.getDirectValue<number>("zowe.trees.itemsPerPage", Constants.DEFAULT_ITEMS_PER_PAGE);
    }

    /**
     * Hold a reference to the given children array to use for pagination.
     * @param children The array belonging to the node that's using pagination
     */
    public setChildren(children: T[]): void {
        this.childrenReference = children;
        this.totalPageCount = Math.ceil(this.childrenReference.length / this.itemsPerPage) - 1;
        this.currentPage = 0;
    }

    /**
     * Move the paginator forward by one page.
     * This function has bounds-checking and stops at the last possible page.
     */
    public nextPage(): void {
        this.currentPage = Math.min(this.currentPage + 1, this.totalPageCount);
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
        this.currentPage = this.currentPage + numPages > this.totalPageCount ? this.totalPageCount : this.currentPage + numPages;
    }

    /**
     * Move the paginator backward by the given number of pages.
     * If moving backward by given number of pages results in a negative page index, the pagination window reflects the first page of elements.
     * @param numPages The number of pages to move backward
     */
    public moveBack(numPages: number): void {
        this.currentPage = this.currentPage - numPages < 0 ? 0 : this.currentPage - numPages;
    }

    /**
     * Set the current page for the pagination controller.
     * @param page The new page index
     */
    public jumpToPage(page: number): void {
        this.currentPage = page;
    }

    /**
     * Returns a slice of items within the given page number.
     * @param page Specify the page of items to return
     * @returns A slice of items starting at the given page
     */
    public getPage(page: number): T[] {
        const lastPage = this.currentPage;
        this.currentPage = page;
        const children = this.getCurrentPage();
        this.currentPage = lastPage;

        return children;
    }

    /**
     * @returns the current page of items
     */
    public getCurrentPage(): T[] {
        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.childrenReference.length);
        return this.childrenReference.slice(startIndex, endIndex);
    }
}
