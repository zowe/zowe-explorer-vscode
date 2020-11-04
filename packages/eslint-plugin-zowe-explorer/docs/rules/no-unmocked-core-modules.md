# Disallow the use of unmocked node core module (no-unmocked-core-modules)

Node modules are [automatically mocked by jest](https://jestjs.io/docs/en/manual-mocks#mocking-node-modules). That means that if a file exists in the `__mocks__` directory next to `node_modules`, the mock will be returned instead of the actual module on a `require/import`.

However, node core modules (fs, path, ...) are not automatically mocked and an explicit

```js
jest.mock("fs");
```

is required to get a mock instead of the actual module.

## Rule details

If your unit tests mock or modify some of the core modules, you may want to make sure `jest.mock` is called for them so that the actual core module is not modified.

This rule will report an error if a module is imported and `jest.mock` is not called for it.

## Options

- `coreModuleNames` an array with the names of core modules that should be always mocked
- `filePathPattern` of the unit tests for which this rule should be mandeted as a string, for example `".*\\.unit\\.test\\..*"`
