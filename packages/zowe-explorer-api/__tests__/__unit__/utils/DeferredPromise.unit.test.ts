import { DeferredPromise } from "../../../src";

describe("DeferredPromise constructor", () => {
    it("sets resolve and reject functions", () => {
        const deferred = new DeferredPromise();
        expect(deferred.promise).toBeInstanceOf(Promise);
        expect(deferred.reject).toBeInstanceOf(Function);
        expect(deferred.resolve).toBeInstanceOf(Function);
    });
});

describe("DeferredPromise.status", () => {
    it("returns pending when not yet resolved", () => {
        const deferred = new DeferredPromise();
        expect(deferred.status).toBe("pending");
    });

    it("returns fulfilled when resolved", () => {
        const deferred = new DeferredPromise();
        deferred.resolve(null);
        expect(deferred.status).toBe("fulfilled");
    });
});
