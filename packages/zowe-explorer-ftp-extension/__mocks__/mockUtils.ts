// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
export const mocked = <T extends (..._args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;
