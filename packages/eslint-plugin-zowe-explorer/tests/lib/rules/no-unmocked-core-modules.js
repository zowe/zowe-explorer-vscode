"use strict";

const rule = require("../../../lib/rules/no-unmocked-core-modules"),
  RuleTester = require("eslint").RuleTester;

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2015,
    sourceType: "module",
  },
});

ruleTester.run("no-unmocked-core-modules", rule, {
  valid: [
    {
      code: "const world = 42",
      options: [{ coreModuleNames: ["fs"], filePathPattern: ".*" }],
    },
    {
      code: "import * as fs from 'fs'; jest.mock('fs')",
      options: [{ coreModuleNames: ["fs"], filePathPattern: ".*" }],
    },
    {
      code: "import path from 'path'; jest.mock('path')",
      options: [{ coreModuleNames: ["path"], filePathPattern: ".*" }],
    },
    {
      code: "import * as fs from 'fs'; // `path` must be mocked",
      options: [{ coreModuleNames: ["path"], filePathPattern: ".*" }],
    },
  ],

  invalid: [
    {
      code: "import * as fs from 'fs'; // `fs` must be mocked",
      errors: [{ message: "Use jest.mock('fs') to mock a node core module" }],
      options: [{ coreModuleNames: ["fs"], filePathPattern: ".*" }],
      output: "import * as fs from 'fs';\njest.mock('fs'); // `fs` must be mocked",
    },
    {
      code: "import * as path from 'path'",
      errors: [{ message: "Use jest.mock('path') to mock a node core module" }],
      options: [{ coreModuleNames: ["path"], filePathPattern: ".*" }],
      output: "import * as path from 'path'\njest.mock('path');",
    },
  ],
});
