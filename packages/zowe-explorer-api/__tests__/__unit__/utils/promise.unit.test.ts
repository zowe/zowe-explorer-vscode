import { createDeferredPromise, DeferredPromise } from "../../../src/utils/promise";

const isDeferredPromise = (obj: any): obj is DeferredPromise => {
    return "reject" in obj && "resolve" in obj && "promise" in obj;
};

describe("utils/promise.ts - Unit tests", () => {
    describe("createDeferredPromise", () => {
        it("creates a new promise object", () => {
            const deferredPromise = createDeferredPromise();
            expect(deferredPromise.promise).toBeDefined();
            expect(isDeferredPromise(deferredPromise)).toBe(true);
        });
    });
});
