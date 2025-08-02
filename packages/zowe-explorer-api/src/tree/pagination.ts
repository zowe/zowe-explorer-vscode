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

import { ThemeIcon, TreeItem } from "vscode";

/**
 * Result type expected from the fetch function.
 */
export interface IFetchResult<T, Cursor> {
    items: T[];
    /** The cursor to use for fetching the *next* page, or `undefined` if no more pages exist. */
    nextPageCursor?: Cursor;
    /** Total number of items if known (e.g., from an initial estimate) */
    totalItems?: number;
    /** Number of items to render from the API (might differ from `items.length` if error items are present) */
    returnedRows?: number;
}

export class NavigationTreeItem extends TreeItem {
    public disabled = false;
    public constructor(label: string, icon: string, disabled: boolean, command: string, navigateCallback: () => void | PromiseLike<void>) {
        super(label);
        this.contextValue = "";
        this.iconPath = new ThemeIcon(icon);
        this.disabled = disabled;
        this.command = this.disabled
            ? {
                  command: "zowe.placeholderCommand",
                  title: "",
              }
            : {
                  command,
                  title: label,
                  arguments: [navigateCallback],
              };
    }
}

/**
 * Expected function signature for the paginator to leverage. Used to fetch a page of data.
 * @param cursor The cursor indicating where to start fetching (e.g., the last item name of the previous page). Use `undefined` for the first page.
 * @param limit The maximum number of items to fetch for the page.
 * @returns A promise resolving to an object containing the fetched items and an optional cursor for the next page.
 */
export type FetchFn<T, Cursor> = (cursor: Cursor | undefined, limit: number) => IFetchResult<T, Cursor> | Promise<IFetchResult<T, Cursor>>;

/**
 * @brief Provides cursor-based pagination capabilities for a tree view or list of items.
 * It fetches data dynamically page by page using the provided fetch function.
 *
 * @typeParam `T` The type of items to be paginated
 * @typeParam `Cursor` The type of the cursor used to fetch the next page
 */
export class Paginator<T, Cursor = string> {
    private currentPageItems: T[] = [];
    private maxItemsPerPage: number;

    private pageCount: number = 0;
    private currentPage: number = 0;
    private currentPageCursor: Cursor | undefined = undefined;
    private nextPageCursor: Cursor | undefined = undefined;
    private previousPageCursors: (Cursor | undefined)[] = [];
    private hasNextPage: boolean = false;
    private loading: boolean = false;
    private wasInitialized: boolean = false;
    private fetchFn: FetchFn<T, Cursor>;

    /**
     * Creates a Paginator instance. Call `initialize` to fetch the first page.
     * @param maxItemsPerPage The maximum number of items to display per page. Must be a positive integer.
     * @param fetchFn The function used to fetch pages of data.
     * @throws If {@link maxItemsPerPage} is zero, a negative integer, or a floating-point value.
     */
    public constructor(maxItemsPerPage: number, fetchFn: FetchFn<T, Cursor>) {
        if (maxItemsPerPage <= 0 || !Number.isInteger(maxItemsPerPage)) {
            throw new Error("[Paginator.constructor] maxItemsPerPage must be a positive integer");
        }
        this.maxItemsPerPage = maxItemsPerPage;
        this.fetchFn = fetchFn;
    }

    public isInitialized(): boolean {
        return this.wasInitialized;
    }

    private reset(): void {
        this.currentPageCursor = this.nextPageCursor = undefined;
        this.previousPageCursors = [];
        this.currentPage = this.pageCount = 0;
        this.hasNextPage = this.wasInitialized = false;
    }

    /**
     * Initializes the paginator by fetching the first page of data.
     * Should be called after the Paginator is constructed.
     * @throws Error if fetching fails.
     */
    public async initialize(): Promise<void> {
        if (this.loading) {
            return;
        }
        this.reset();
        this.loading = this.wasInitialized = true;
        try {
            // The cursor used to fetch the first page is undefined
            this.currentPageCursor = undefined;
            const result = await this.fetchFn(undefined, this.maxItemsPerPage);
            this.currentPageItems = result.items;
            this.nextPageCursor = result.nextPageCursor;
            // hasNextPage: if a cursor is returned AND (items fetched equals limit OR totalItems suggests more)
            this.hasNextPage =
                !!result.nextPageCursor &&
                (result.items.length === this.maxItemsPerPage ||
                    (result.totalItems != null && this.previousPageCursors.length * this.maxItemsPerPage + result.items.length < result.totalItems));
            this.previousPageCursors = [];
            if (result.totalItems) {
                this.pageCount = Math.ceil(result.totalItems / this.maxItemsPerPage);
                this.currentPage = 0;
            }
        } catch (error) {
            this.currentPageItems = [];
            this.hasNextPage = false;
            this.nextPageCursor = undefined;
            this.previousPageCursors = [];
            // Propagate error to caller
            throw error;
        } finally {
            this.loading = false;
        }
    }

    /**
     * Fetches and displays the next page of items.
     * @returns The items for the next page.
     * @throws Error if fetching fails or if there is no next page.
     */
    public async fetchNextPage(): Promise<T[]> {
        if (this.loading) {
            return;
        }
        if (!this.hasNextPage || this.nextPageCursor === undefined) {
            throw new Error("[Paginator.fetchNextPage] No next page available or cursor is missing.");
        }

        this.loading = true;

        // Cache the previous page cursor that led to the current page
        this.previousPageCursors.push(this.currentPageCursor);
        try {
            // Fetch the next page of items
            const result = await this.fetchFn(this.nextPageCursor, this.maxItemsPerPage);

            // The next page cursor is now the current page cursor
            this.currentPageItems = result.items;
            this.currentPageCursor = this.nextPageCursor;
            // Prepare the cursor for a "next page" fetch
            this.nextPageCursor = result.nextPageCursor;

            this.hasNextPage =
                !!result.nextPageCursor &&
                (result.items.length === this.maxItemsPerPage ||
                    (result.totalItems != null && this.previousPageCursors.length * this.maxItemsPerPage + result.items.length < result.totalItems));

            if (result.totalItems) {
                this.pageCount = Math.ceil(result.totalItems / this.maxItemsPerPage);
            }
            this.currentPage = Math.min(this.currentPage + 1, this.pageCount);
        } catch (error) {
            // Remove previous page cursor if an error occurred as the page transition failed
            this.previousPageCursors.pop();
            throw error;
        } finally {
            this.loading = false;
        }
        return this.currentPageItems;
    }

    /**
     * Fetches and displays the previous page of items.
     * @returns The items for the previous page.
     * @throws Error if fetching fails or if there is no previous page.
     */
    public async fetchPreviousPage(): Promise<T[]> {
        if (this.loading) {
            return;
        }
        if (!this.canGoPrevious()) {
            throw new Error("[Paginator.fetchPreviousPage] No previous page available.");
        }

        this.loading = true;
        const previousCursor = this.previousPageCursors.pop(); // Get the cursor needed to fetch the page before the current one

        try {
            const result = await this.fetchFn(previousCursor, this.maxItemsPerPage);
            this.currentPageItems = result.items;
            // The cursor we just used to go back is now the "current" page's cursor
            this.currentPageCursor = previousCursor;
            // The next cursor returned by fetching the previous page should ideally
            // point back to the start of the page we just came from.
            // We assume the API provides this correctly.
            this.nextPageCursor = result.nextPageCursor;
            this.hasNextPage =
                !!result.nextPageCursor &&
                (result.items.length === this.maxItemsPerPage ||
                    (result.totalItems != null && this.previousPageCursors.length * this.maxItemsPerPage + result.items.length < result.totalItems));

            if (result.totalItems) {
                this.pageCount = Math.ceil(result.totalItems / this.maxItemsPerPage);
            }
            this.currentPage = Math.max(this.currentPage - 1, 0);
        } catch (error) {
            this.previousPageCursors.push(previousCursor); // Push the cursor back if fetch failed to maintain state
            throw error;
        } finally {
            this.loading = false;
        }
        return this.currentPageItems;
    }

    /**
     * Refetches the data for the current page using the existing cursor.
     * Useful for refreshing the view after data modifications without changing the page.
     * @throws Error if fetching fails.
     */
    public async refetchCurrentPage(): Promise<void> {
        if (this.loading) {
            // Avoid concurrent fetches
            return;
        }
        if (!this.wasInitialized) {
            // Cannot refetch if not initialized
            throw new Error("[Paginator.refetchCurrentPage] Call received but paginator is not initialized.");
        }

        this.loading = true;
        try {
            // Refetch using the cursor that corresponds to the start of the current page
            const result = await this.fetchFn(this.currentPageCursor, this.maxItemsPerPage);

            this.currentPageItems = result.items;
            // Update the next page cursor based on the refreshed data
            this.nextPageCursor = result.nextPageCursor;

            // Recalculate hasNextPage based on the refreshed data
            // Note: Accuracy depends on fetchFn providing reliable totalItems on refresh
            this.hasNextPage =
                !!result.nextPageCursor &&
                (result.items.length === this.maxItemsPerPage ||
                    (result.totalItems != null && this.previousPageCursors.length * this.maxItemsPerPage + result.items.length < result.totalItems));

            if (result.totalItems) {
                this.pageCount = Math.ceil(result.totalItems / this.maxItemsPerPage);
            }
        } finally {
            this.loading = false;
        }
    }

    /**
     * @returns The items currently displayed on the page.
     */
    public getCurrentPageItems(): T[] {
        return this.currentPageItems;
    }

    /**
     * @returns The current page index (starting at 0)
     */
    public getCurrentPageIndex(): number {
        return this.currentPage;
    }

    /**
     * @returns The total number of pages
     */
    public getPageCount(): number {
        return this.pageCount;
    }

    /**
     * @returns The maximum number of items configured per page.
     */
    public getMaxItemsPerPage(): number {
        return this.maxItemsPerPage;
    }

    /**
     * @param maxItemsPerPage The new maximum number of items per page.
     * @throws {Error} If {@link maxItemsPerPage} is zero, a negative integer, or a floating-point value.
     */
    public setMaxItemsPerPage(maxItemsPerPage: number): void {
        if (maxItemsPerPage <= 0 || !Number.isInteger(maxItemsPerPage)) {
            throw new Error("[Paginator.setMaxItemsPerPage] maxItemsPerPage must be a positive integer");
        }
        this.maxItemsPerPage = maxItemsPerPage;
    }

    /**
     * @returns `true` if there is potentially a next page available, `false` otherwise.
     */
    public canGoNext(): boolean {
        return this.hasNextPage && !this.loading;
    }

    /**
     * @returns `true` if there is a previous page available in the history, `false` otherwise.
     */
    public canGoPrevious(): boolean {
        return this.previousPageCursors.length > 0 && !this.loading;
    }

    /**
     * @returns `true` if the paginator is currently fetching data, `false` otherwise.
     */
    public isLoading(): boolean {
        return this.loading;
    }
}
