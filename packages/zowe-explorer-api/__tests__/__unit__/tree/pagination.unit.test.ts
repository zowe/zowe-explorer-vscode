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

import { Paginator, FetchFn, IFetchResult } from "../../../src";

// Helper type for mock data items
type MockDataItem = { id: number; name: string };

// Helper function to create mock data
const createMockData = (count: number, prefix = "item-"): MockDataItem[] => {
    return Array.from({ length: count }, (_, i) => ({ id: i, name: `${prefix}${i}` }));
};

// Interface for mock function options
interface MockFetchOptions {
    failOnCursor?: string | undefined;
    returnLessItemsOnCursor?: string | undefined;
}

const createMockFetchFunction = (totalItems: number, options?: MockFetchOptions): FetchFn<MockDataItem, string> => {
    const failOnCursor = options?.failOnCursor;
    const returnLessItemsOnCursor = options?.returnLessItemsOnCursor;
    const failOnCursorProvided = !!options && Object.prototype.hasOwnProperty.call(options, "failOnCursor");

    return jest.fn(async (cursor: string | undefined, limit: number): Promise<IFetchResult<MockDataItem, string>> => {
        if (failOnCursorProvided && cursor === failOnCursor) {
            throw new Error(`Simulated fetch error for cursor: ${cursor}`);
        }

        const startIndex = cursor ? parseInt(cursor.split("-")[1], 10) + 1 : 0;
        if (startIndex >= totalItems) {
            return { items: [], nextPageCursor: undefined, totalItems }; // No more items
        }

        let actualLimit = limit;
        // Check if returnLessItemsOnCursor was provided AND it matches the current cursor
        const returnLessProvided = !!options && Object.prototype.hasOwnProperty.call(options, "returnLessItemsOnCursor");
        if (returnLessProvided && cursor === returnLessItemsOnCursor) {
            actualLimit = Math.floor(limit / 2); // Return fewer items than requested
        }

        const endIndex = Math.min(startIndex + actualLimit, totalItems);
        const items = createMockData(endIndex - startIndex, `item-${startIndex}-`);
        // Adjust IDs to be globally unique if needed, here using startIndex
        items.forEach((item, idx) => (item.id = startIndex + idx));

        const nextPageCursor = endIndex < totalItems ? `cursor-${items[items.length - 1].id}` : undefined;

        // Simulate API returning totalItems and returnedRows
        return {
            items,
            nextPageCursor,
            totalItems,
            returnedRows: items.length,
        };
    });
};

describe("Paginator", () => {
    const MAX_ITEMS_PER_PAGE = 5;
    let mockFetch: FetchFn<MockDataItem, string>;
    let paginator: Paginator<MockDataItem>;

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("constructor", () => {
        it("should create a Paginator instance successfully", () => {
            mockFetch = createMockFetchFunction(20);
            expect(() => new Paginator(MAX_ITEMS_PER_PAGE, mockFetch)).not.toThrow();
        });

        it("should throw an error if maxItemsPerPage is zero", () => {
            mockFetch = createMockFetchFunction(20);
            expect(() => new Paginator(0, mockFetch)).toThrow("[Paginator.constructor] maxItemsPerPage must be a positive integer");
        });

        it("should throw an error if maxItemsPerPage is negative", () => {
            mockFetch = createMockFetchFunction(20);
            expect(() => new Paginator(-1, mockFetch)).toThrow("[Paginator.constructor] maxItemsPerPage must be a positive integer");
        });

        it("should throw an error if maxItemsPerPage is not an integer", () => {
            mockFetch = createMockFetchFunction(20);
            expect(() => new Paginator(3.5, mockFetch)).toThrow("[Paginator.constructor] maxItemsPerPage must be a positive integer");
        });

        it("should initialize with default state", () => {
            mockFetch = createMockFetchFunction(20);
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            expect(paginator.getCurrentPageItems()).toEqual([]);
            expect(paginator.getMaxItemsPerPage()).toBe(MAX_ITEMS_PER_PAGE);
            expect(paginator.canGoNext()).toBe(false);
            expect(paginator.canGoPrevious()).toBe(false);
            expect(paginator.isLoading()).toBe(false);
        });
    });

    describe("initialize", () => {
        beforeEach(() => {
            mockFetch = createMockFetchFunction(12);
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
        });

        it("should fetch the first page successfully", async () => {
            await paginator.initialize();
            expect(mockFetch).toHaveBeenCalledWith(undefined, MAX_ITEMS_PER_PAGE);
            expect(paginator.getCurrentPageItems().length).toBe(MAX_ITEMS_PER_PAGE);
            expect(paginator.getCurrentPageItems()[0].id).toBe(0);
            expect(paginator.getCurrentPageItems()[MAX_ITEMS_PER_PAGE - 1].id).toBe(MAX_ITEMS_PER_PAGE - 1);
            expect(paginator.canGoNext()).toBe(true);
            expect(paginator.canGoPrevious()).toBe(false);
            expect(paginator.isLoading()).toBe(false);
        });

        it("should determine hasNextPage correctly when fetch returns fewer items than limit but has cursor", async () => {
            // Simulate scenario where API returns a next cursor even if fewer items were returned than the limit
            // (e.g., due to filtering or reaching the end soon)
            const lessItemsFetch = jest.fn(async (cursor: string | undefined, limit: number): Promise<IFetchResult<MockDataItem, string>> => {
                if (cursor === undefined) {
                    return {
                        items: createMockData(MAX_ITEMS_PER_PAGE - 1, "item-0-"), // Return 4 items
                        nextPageCursor: "cursor-3", // Still provide a cursor
                        totalItems: 12,
                    };
                }
                // Subsequent fetches (not tested here, but needed for mock completeness)
                const startIndex = cursor ? parseInt(cursor.split("-")[1], 10) + 1 : 0;
                const endIndex = Math.min(startIndex + limit, 12);
                const items = createMockData(endIndex - startIndex, `item-${startIndex}-`);
                items.forEach((item, idx) => (item.id = startIndex + idx));
                const nextCursor = endIndex < 12 ? `cursor-${items[items.length - 1].id}` : undefined;
                return { items, nextPageCursor: nextCursor, totalItems: 12 };
            });
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, lessItemsFetch);
            await paginator.initialize();
            expect(paginator.getCurrentPageItems().length).toBe(MAX_ITEMS_PER_PAGE - 1); // 4 items
            expect(paginator.canGoNext()).toBe(true); // Should still be true because cursor was returned
        });

        it("should determine hasNextPage correctly based on totalItems when returned items equal limit", async () => {
            // 10 total items, 5 per page. First fetch gets 5. Should know there's a next page.
            mockFetch = createMockFetchFunction(10);
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            await paginator.initialize();
            expect(paginator.getCurrentPageItems().length).toBe(MAX_ITEMS_PER_PAGE);
            expect(paginator.canGoNext()).toBe(true);
        });

        it("should determine hasNextPage correctly based on totalItems when returned items are less than limit", async () => {
            // 7 total items, 5 per page. First fetch gets 5. Should know there's a next page.
            mockFetch = createMockFetchFunction(7);
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            await paginator.initialize();
            expect(paginator.getCurrentPageItems().length).toBe(MAX_ITEMS_PER_PAGE); // Gets first 5
            expect(paginator.canGoNext()).toBe(true); // Knows 5 < 7
        });

        it("should handle initialization when total items are less than or equal to page size", async () => {
            mockFetch = createMockFetchFunction(3); // 3 items total
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            await paginator.initialize();
            expect(mockFetch).toHaveBeenCalledWith(undefined, MAX_ITEMS_PER_PAGE);
            expect(paginator.getCurrentPageItems().length).toBe(3);
            expect(paginator.canGoNext()).toBe(false);
            expect(paginator.canGoPrevious()).toBe(false);
        });

        it("should handle initialization when there are exactly itemsPerPage items", async () => {
            mockFetch = createMockFetchFunction(MAX_ITEMS_PER_PAGE);
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            await paginator.initialize();
            expect(mockFetch).toHaveBeenCalledWith(undefined, MAX_ITEMS_PER_PAGE);
            expect(paginator.getCurrentPageItems().length).toBe(MAX_ITEMS_PER_PAGE);
            expect(paginator.canGoNext()).toBe(false);
            expect(paginator.canGoPrevious()).toBe(false);
        });

        it("should set isLoading flag during initialization", async () => {
            const promise = paginator.initialize();
            expect(paginator.isLoading()).toBe(true);
            await promise;
            expect(paginator.isLoading()).toBe(false);
        });

        it("should handle fetch errors during initialization", async () => {
            const errorFetch = jest.fn().mockRejectedValue(new Error("Fetch failed"));
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, errorFetch);
            await expect(paginator.initialize()).rejects.toThrow("Fetch failed");
            expect(paginator.getCurrentPageItems()).toEqual([]);
            expect(paginator.canGoNext()).toBe(false);
            expect(paginator.canGoPrevious()).toBe(false);
            expect(paginator.isLoading()).toBe(false);
        });

        it("should not fetch if already loading", async () => {
            const slowFetch = jest.fn(
                () =>
                    new Promise<IFetchResult<MockDataItem, string>>((resolve) =>
                        setTimeout(() => resolve({ items: [], nextPageCursor: undefined }), 50)
                    )
            );
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, slowFetch);
            const p1 = paginator.initialize(); // Start loading
            expect(paginator.isLoading()).toBe(true);
            const p2 = paginator.initialize(); // Try starting again while loading
            await Promise.all([p1, p2]);
            expect(slowFetch).toHaveBeenCalledTimes(1); // Should only be called once
        });
    });

    describe("fetchNextPage", () => {
        beforeEach(async () => {
            // 12 items total, 5 per page => Page 1 (0-4), Page 2 (5-9), Page 3 (10-11)
            mockFetch = createMockFetchFunction(12);
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            await paginator.initialize(); // Load first page (items 0-4)
            // Reset mock calls after initialize
            (mockFetch as jest.Mock).mockClear();
        });

        it("should fetch the next page successfully", async () => {
            expect(paginator.canGoNext()).toBe(true);
            const currentPage1 = paginator.getCurrentPageItems();
            expect(currentPage1.length).toBe(5);
            expect(currentPage1[0].id).toBe(0);

            const nextPageItems = await paginator.fetchNextPage(); // Fetch page 2 (items 5-9)

            expect(mockFetch).toHaveBeenCalledWith("cursor-4", MAX_ITEMS_PER_PAGE); // Cursor from last item of page 1
            expect(nextPageItems.length).toBe(MAX_ITEMS_PER_PAGE);
            expect(nextPageItems[0].id).toBe(5);
            expect(nextPageItems[MAX_ITEMS_PER_PAGE - 1].id).toBe(9);
            expect(paginator.getCurrentPageItems()).toEqual(nextPageItems);
            expect(paginator.canGoNext()).toBe(true); // Page 3 exists
            expect(paginator.canGoPrevious()).toBe(true); // Came from page 1
            expect(paginator.isLoading()).toBe(false);
        });

        it("should fetch the last page successfully", async () => {
            await paginator.fetchNextPage(); // Fetch page 2 (items 5-9)
            (mockFetch as jest.Mock).mockClear();

            expect(paginator.canGoNext()).toBe(true);
            const nextPageItems = await paginator.fetchNextPage(); // Fetch page 3 (items 10-11)

            expect(mockFetch).toHaveBeenCalledWith("cursor-9", MAX_ITEMS_PER_PAGE); // Cursor from last item of page 2
            expect(nextPageItems.length).toBe(2); // Only 2 items left
            expect(nextPageItems[0].id).toBe(10);
            expect(nextPageItems[1].id).toBe(11);
            expect(paginator.getCurrentPageItems()).toEqual(nextPageItems);
            expect(paginator.canGoNext()).toBe(false); // No more pages
            expect(paginator.canGoPrevious()).toBe(true); // Came from page 2
        });

        it("should handle hasNextPage correctly when fetch returns fewer items but provides a cursor", async () => {
            // 12 items total, 5 per page. Fetch for page 2 returns only 3 items but still a cursor.
            mockFetch = createMockFetchFunction(12, {
                returnLessItemsOnCursor: "cursor-4",
            });
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            await paginator.initialize(); // Page 1 (0-4)
            (mockFetch as jest.Mock).mockClear();

            await paginator.fetchNextPage(); // Fetch page 2 (should get 2 items: 5-6, based on mock)

            expect(mockFetch).toHaveBeenCalledWith("cursor-4", MAX_ITEMS_PER_PAGE);
            expect(paginator.getCurrentPageItems().length).toBe(Math.floor(MAX_ITEMS_PER_PAGE / 2)); // Should be 2 items based on mock helper
            expect(paginator.canGoNext()).toBe(true); // Still true because cursor was returned
            expect(paginator.canGoPrevious()).toBe(true);
        });

        it("should throw error if trying to fetch next page when not possible", async () => {
            await paginator.fetchNextPage(); // Page 2
            await paginator.fetchNextPage(); // Page 3 (last page)
            expect(paginator.canGoNext()).toBe(false);
            await expect(paginator.fetchNextPage()).rejects.toThrow("[Paginator.fetchNextPage] No next page available or cursor is missing.");
        });

        it("should throw error if trying to fetch next page while already loading", async () => {
            const slowFetch = jest.fn(
                () =>
                    new Promise<IFetchResult<MockDataItem, string>>((resolve) =>
                        setTimeout(() => resolve({ items: createMockData(MAX_ITEMS_PER_PAGE, "slow-"), nextPageCursor: "slow-cursor" }), 50)
                    )
            );
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, slowFetch);
            await paginator.initialize();

            const promise = paginator.fetchNextPage(); // Start loading next page
            expect(paginator.isLoading()).toBe(true);
            await expect(paginator.fetchNextPage()).rejects.toThrow("[Paginator.fetchNextPage] Paginator is already loading.");
            await promise; // Wait for the first fetch to complete
        });

        it("should handle fetch errors during fetchNextPage", async () => {
            // Setup to fail when fetching the second page (cursor "cursor-4")
            mockFetch = createMockFetchFunction(12, {
                failOnCursor: "cursor-4",
            });
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            await paginator.initialize(); // Page 1 (0-4) successful

            const initialItems = paginator.getCurrentPageItems();
            const initialCanGoPrevious = paginator.canGoPrevious();

            await expect(paginator.fetchNextPage()).rejects.toThrow("Simulated fetch error for cursor: cursor-4");

            // State should remain as it was before the failed fetch attempt
            expect(paginator.isLoading()).toBe(false);
            expect(paginator.getCurrentPageItems()).toEqual(initialItems); // Still on page 1
            expect(paginator.canGoNext()).toBe(true); // Still thinks it can go next
            expect(paginator.canGoPrevious()).toBe(initialCanGoPrevious); // Should be false
            // The cursor stack should NOT have been pushed to
        });
    });

    describe("fetchPreviousPage", () => {
        beforeEach(async () => {
            // 12 items total, 5 per page => Page 1 (0-4), Page 2 (5-9), Page 3 (10-11)
            mockFetch = createMockFetchFunction(12);
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            await paginator.initialize(); // Load page 1 (0-4)
            await paginator.fetchNextPage(); // Load page 2 (5-9)
            await paginator.fetchNextPage(); // Load page 3 (10-11)
            // Now on page 3, previous cursors should be [undefined, "cursor-4"]
            // (cursor to get page 1, cursor to get page 2)
            (mockFetch as jest.Mock).mockClear();
        });

        it("should fetch the previous page successfully", async () => {
            expect(paginator.canGoPrevious()).toBe(true);
            const currentPage3 = paginator.getCurrentPageItems();
            expect(currentPage3.length).toBe(2); // Items 10-11

            const prevPageItems = await paginator.fetchPreviousPage(); // Fetch page 2 (items 5-9)

            // Should request page 2 using the cursor that *led* to page 2, which is "cursor-4"
            expect(mockFetch).toHaveBeenCalledWith("cursor-4", MAX_ITEMS_PER_PAGE);
            expect(prevPageItems.length).toBe(MAX_ITEMS_PER_PAGE);
            expect(prevPageItems[0].id).toBe(5);
            expect(prevPageItems[MAX_ITEMS_PER_PAGE - 1].id).toBe(9);
            expect(paginator.getCurrentPageItems()).toEqual(prevPageItems);
            expect(paginator.canGoNext()).toBe(true); // Came from page 3, so next should exist
            expect(paginator.canGoPrevious()).toBe(true); // Can go back to page 1
            expect(paginator.isLoading()).toBe(false);
        });

        it("should fetch back to the first page successfully", async () => {
            await paginator.fetchPreviousPage(); // Go back to page 2 (5-9)
            (mockFetch as jest.Mock).mockClear();

            expect(paginator.canGoPrevious()).toBe(true);
            const firstPageItems = await paginator.fetchPreviousPage(); // Fetch page 1 (items 0-4)

            // Should request page 1 using the cursor that *led* to page 1, which is undefined
            expect(mockFetch).toHaveBeenCalledWith(undefined, MAX_ITEMS_PER_PAGE);
            expect(firstPageItems.length).toBe(MAX_ITEMS_PER_PAGE);
            expect(firstPageItems[0].id).toBe(0);
            expect(firstPageItems[MAX_ITEMS_PER_PAGE - 1].id).toBe(MAX_ITEMS_PER_PAGE - 1);
            expect(paginator.getCurrentPageItems()).toEqual(firstPageItems);
            expect(paginator.canGoNext()).toBe(true); // Came from page 2
            expect(paginator.canGoPrevious()).toBe(false); // Cannot go back further
        });

        it("should throw error if trying to fetch previous page when not possible", async () => {
            await paginator.fetchPreviousPage(); // page 2
            await paginator.fetchPreviousPage(); // page 1
            expect(paginator.canGoPrevious()).toBe(false);
            await expect(paginator.fetchPreviousPage()).rejects.toThrow("[Paginator.fetchPreviousPage] No previous page available.");
        });

        it("should throw error if trying to fetch previous page while already loading", async () => {
            await paginator.fetchPreviousPage(); // Go back to page 2 first to ensure canGoPrevious is true

            const slowFetch = jest.fn(
                () =>
                    new Promise<IFetchResult<MockDataItem, string>>((resolve) =>
                        setTimeout(() => resolve({ items: createMockData(MAX_ITEMS_PER_PAGE, "slow-prev-"), nextPageCursor: "slow-prev-cursor" }), 50)
                    )
            );
            // Need to replace the fetch function *after* setup
            (paginator as any).fetchFunction = slowFetch; // Use 'any' to bypass private access check

            const promise = paginator.fetchPreviousPage(); // Start loading previous page
            expect(paginator.isLoading()).toBe(true);
            await expect(paginator.fetchPreviousPage()).rejects.toThrow("[Paginator.fetchPreviousPage] Paginator is already loading.");
            await promise; // Wait for the first fetch to complete
        });

        it("should handle fetch errors during fetchPreviousPage and restore cursor stack", async () => {
            // Setup to fail when fetching the first page (cursor undefined)
            mockFetch = createMockFetchFunction(12, {
                failOnCursor: undefined, // Explicitly fail when cursor is undefined
            });
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
            // Manually set state to simulate being on page 2 after successful fetches
            (paginator as any).currentPageItems = createMockData(MAX_ITEMS_PER_PAGE, "page2-").map((item, idx) => ({ ...item, id: 5 + idx }));
            (paginator as any).nextPageCursor = "cursor-9"; // Cursor needed to get page 3
            (paginator as any).previousPageCursors = [undefined]; // Cursor needed to get page 1
            (paginator as any).hasNextPage = true;
            (paginator as any).loading = false;

            const initialItems = paginator.getCurrentPageItems();
            const initialCursorStack = [...(paginator as any).previousPageCursors]; // Copy stack

            await expect(paginator.fetchPreviousPage()).rejects.toThrow("Simulated fetch error for cursor: undefined");

            // State should remain as it was before the failed fetch attempt
            expect(paginator.isLoading()).toBe(false);
            expect(paginator.getCurrentPageItems()).toEqual(initialItems); // Still on page 2
            expect(paginator.canGoNext()).toBe(true); // Still thinks it can go next
            expect(paginator.canGoPrevious()).toBe(true); // Still thinks it can go previous
            expect((paginator as any).previousPageCursors).toEqual(initialCursorStack); // Cursor stack restored
        });
    });

    describe("Getter Methods", () => {
        beforeEach(async () => {
            mockFetch = createMockFetchFunction(12);
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, mockFetch);
        });

        it("getMaxItemsPerPage should return the correct value", () => {
            expect(paginator.getMaxItemsPerPage()).toBe(MAX_ITEMS_PER_PAGE);
        });

        it("getCurrentPageItems should return current items", async () => {
            expect(paginator.getCurrentPageItems()).toEqual([]); // Before init
            await paginator.initialize();
            expect(paginator.getCurrentPageItems().length).toBe(MAX_ITEMS_PER_PAGE);
            expect(paginator.getCurrentPageItems()[0].id).toBe(0);
            await paginator.fetchNextPage();
            expect(paginator.getCurrentPageItems().length).toBe(MAX_ITEMS_PER_PAGE);
            expect(paginator.getCurrentPageItems()[0].id).toBe(5);
        });

        it("isLoading should reflect loading state", async () => {
            const slowFetch = jest.fn(
                () =>
                    new Promise<IFetchResult<MockDataItem, string>>((resolve) =>
                        setTimeout(() => resolve({ items: [], nextPageCursor: undefined }), 10)
                    )
            );
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, slowFetch);
            expect(paginator.isLoading()).toBe(false);
            const promise = paginator.initialize();
            expect(paginator.isLoading()).toBe(true);
            await promise;
            expect(paginator.isLoading()).toBe(false);
        });

        it("canGoNext and canGoPrevious should work correctly through lifecycle", async () => {
            expect(paginator.canGoNext()).toBe(false); // Not initialized
            expect(paginator.canGoPrevious()).toBe(false);

            // After init (on page 1 of 3)
            await paginator.initialize();
            expect(paginator.canGoNext()).toBe(true);
            expect(paginator.canGoPrevious()).toBe(false);

            // After fetching page 2
            await paginator.fetchNextPage();
            expect(paginator.canGoNext()).toBe(true);
            expect(paginator.canGoPrevious()).toBe(true);

            // After fetching page 3 (last page)
            await paginator.fetchNextPage();
            expect(paginator.canGoNext()).toBe(false);
            expect(paginator.canGoPrevious()).toBe(true);

            // After fetching back to page 2
            await paginator.fetchPreviousPage();
            expect(paginator.canGoNext()).toBe(true);
            expect(paginator.canGoPrevious()).toBe(true);

            // After fetching back to page 1
            await paginator.fetchPreviousPage();
            expect(paginator.canGoNext()).toBe(true);
            expect(paginator.canGoPrevious()).toBe(false);
        });

        it("canGoNext and canGoPrevious should be false while loading", async () => {
            const slowFetch = jest.fn(
                () =>
                    new Promise<IFetchResult<MockDataItem, string>>((resolve) =>
                        setTimeout(() => resolve({ items: createMockData(MAX_ITEMS_PER_PAGE), nextPageCursor: "cursor-next" }), 50)
                    )
            );
            paginator = new Paginator(MAX_ITEMS_PER_PAGE, slowFetch);
            await paginator.initialize(); // Page 1 loaded

            const promiseNext = paginator.fetchNextPage();
            expect(paginator.isLoading()).toBe(true);
            expect(paginator.canGoNext()).toBe(false); // Should be false while loading
            expect(paginator.canGoPrevious()).toBe(false); // Should be false while loading
            await promiseNext; // Page 2 loaded

            const promisePrev = paginator.fetchPreviousPage();
            expect(paginator.isLoading()).toBe(true);
            expect(paginator.canGoNext()).toBe(false); // Should be false while loading
            expect(paginator.canGoPrevious()).toBe(false); // Should be false while loading
            await promisePrev; // Back to page 1
        });
    });
});
