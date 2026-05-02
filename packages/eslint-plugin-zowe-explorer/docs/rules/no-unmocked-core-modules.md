# Disallow the use of unmocked node core module (no-unmocked-core-modules)

Node modules can be [automatically mocked by Vitest](https://vitest.dev/api/vi#vi-mock). That means that if a file exists in the `__mocks__` directory next to `node_modules`, the mock will be returned instead of the actual module on a `require/import`.

However, node core modules (fs, path, ...) are not automatically mocked and an explicit

```js
vi.mock("fs");
```

is required to get a mock instead of the actual module. (`jest.mock("fs")` is also recognized for backwards-compatible Jest test suites.)

## Rule details

If your unit tests mock or modify some of the core modules, you may want to make sure `vi.mock` is called for them so that the actual core module is not modified.

This rule will report an error if a module is imported and neither `vi.mock` nor `jest.mock` is called for it.

## Options

- `coreModuleNames` an array with the names of core modules that should be always mocked
- `filePathPattern` of the unit tests for which this rule should be mandated as a string, for example `".*\\.unit\\.test\\..*"`
