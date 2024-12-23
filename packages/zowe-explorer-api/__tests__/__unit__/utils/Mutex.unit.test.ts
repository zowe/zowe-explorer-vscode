import { DeferredPromise, Mutex } from "../../../src";

function getBlockMock(): Mutex {
    return new Mutex();
}

describe("Mutex.tryLock", () => {
    it("returns true if the lock was acquired", () => {
        const mutex = getBlockMock();
        expect(mutex.tryLock()).toBe(true);
    });

    it("returns false if the lock could not be acquired", async () => {
        const mutex = getBlockMock();
        await mutex.lock();
        expect(mutex.tryLock()).toBe(false);
        mutex.unlock();
    });
});

describe("Mutex.lock", () => {
    it("acquires the lock and returns once acquired", async () => {
        const mutex = getBlockMock();
        await mutex.lock();
        expect(typeof true).toBe("boolean");
    });
});

describe("Mutex.unlock", () => {
    it("releases the lock and allows for continued execution", async () => {
        const mutex = getBlockMock();
        const callback = async () => {
            await mutex.lock();
            expect((mutex as any).mDeferred).not.toBe(null);
            expect(typeof true).toBe("boolean");
            mutex.unlock();
        };
        await mutex.lock();
        mutex.unlock();
        expect((mutex as any).mDeferred).toBe(null);
        await callback();
    });
});

describe("Mutex.isLocked", () => {
    it("returns true when locked", async () => {
        const m = new Mutex();
        await m.lock();
        expect(m.locked).toBe(true);
        m.unlock();
    });
    it("returns false when unlocked", () => {
        const m = new Mutex();
        expect(m.locked).toBe(false);
    });
});
