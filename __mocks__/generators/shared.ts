import * as imperative from "@zowe/imperative";

export function generateImperativeSession() {
    return new imperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });
}

export function generateImperativeProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            user: undefined,
            password: undefined
        },
        type: "zosmf",
        message: "",
        failNotFound: false
    };
}

export function generateTreeView() {
    return {
        reveal: jest.fn(),
        onDidExpandElement: jest.fn(),
        onDidCollapseElement: jest.fn(),
        selection: [],
        onDidChangeSelection: jest.fn(),
        visible: true,
        onDidChangeVisibility: jest.fn()
    };
}
