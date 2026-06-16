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
import { errorMessage, handleError } from "../../../src/utils/ErrorUtils";
import { vi } from "vitest";

describe("errorMessage", () => {
    it("returns the message property when passed an Error instance", () => {
        const err = new Error("something went wrong");
        expect(errorMessage(err)).toBe("something went wrong");
    });

    it("returns String(err) when passed a plain string", () => {
        expect(errorMessage("raw string error")).toBe("raw string error");
    });

    it("returns String(err) when passed a number", () => {
        expect(errorMessage(42)).toBe("42");
    });

    it("returns String(err) when passed null", () => {
        expect(errorMessage(null)).toBe("null");
    });

    it("returns String(err) when passed undefined", () => {
        expect(errorMessage(undefined)).toBe("undefined");
    });

    it("returns String(err) when passed a plain object", () => {
        const obj = { code: 404 };
        expect(errorMessage(obj)).toBe(String(obj));
    });

    it("returns the message of an Error subclass", () => {
        class CustomError extends Error {}
        const err = new CustomError("custom failure");
        expect(errorMessage(err)).toBe("custom failure");
    });

    it("returns an empty string when passed an Error with an empty message", () => {
        const err = new Error("");
        expect(errorMessage(err)).toBe("");
    });
});

describe("handleError", () => {
    it("invokes the callback when err is an Error instance", () => {
        const callback = vi.fn();
        const err = new Error("boom");
        handleError(err, callback);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(err);
    });

    it("does not invoke the callback when err is a string", () => {
        const callback = vi.fn();
        handleError("not an Error", callback);
        expect(callback).not.toHaveBeenCalled();
    });

    it("does not invoke the callback when err is null", () => {
        const callback = vi.fn();
        handleError(null, callback);
        expect(callback).not.toHaveBeenCalled();
    });

    it("does not invoke the callback when err is undefined", () => {
        const callback = vi.fn();
        handleError(undefined, callback);
        expect(callback).not.toHaveBeenCalled();
    });

    it("does not invoke the callback when err is a plain object", () => {
        const callback = vi.fn();
        handleError({ message: "fake" }, callback);
        expect(callback).not.toHaveBeenCalled();
    });

    it("does not invoke the callback when err is a number", () => {
        const callback = vi.fn();
        handleError(0, callback);
        expect(callback).not.toHaveBeenCalled();
    });

    it("invokes the callback for an Error subclass instance", () => {
        class CustomError extends Error {}
        const callback = vi.fn();
        const err = new CustomError("subclass error");
        handleError(err, callback);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(err);
    });

    it("passes the exact Error reference to the callback", () => {
        const callback = vi.fn();
        const err = new Error("reference check");
        handleError(err, callback);
        expect(callback.mock.calls[0][0]).toBe(err);
    });
});
