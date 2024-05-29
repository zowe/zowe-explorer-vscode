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

import type { Options } from "@wdio/types";
import { join as joinPath } from "path";
import { baseConfig } from "../../__common__/base.wdio.conf";

const dataDir = joinPath(__dirname, "..", "..", "__common__", ".wdio-vscode-service", "data");
// const profileTypes = ["alpha", "beta", "gamma", "delta"];
// const profileVsixs = profileTypes.map((profType) => joinPath(extensionsDir, `${profType}.vsix`));

export const config: Options.Testrunner = {
    ...baseConfig,
    //
    // ====================
    // Runner Configuration
    // ====================
    // WebdriverIO supports running e2e tests as well as unit and component tests.
    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            project: "./tsconfig.json",
            transpileOnly: true,
        },
    },

    //
    // ==================
    // Specify Test Files
    // ==================
    // Define which test specs should run. The pattern is relative to the directory
    // of the configuration file being run.
    //
    // The specs are defined as an array of spec files (optionally using wildcards
    // that will be expanded). The test for each spec file will be run in a separate
    // worker process. In order to have a group of spec files run in the same worker
    // process simply enclose them in an array within the specs array.
    //
    // The path of the spec files will be resolved relative from the directory of
    // of the config file unless it's absolute.
    //
    specs: ["./features/**/*.feature"],
    // Patterns to exclude.
    exclude: [
        // 'path/to/excluded/files'
        "./features/extenders/Activation.feature",
    ],
    //
    // ============
    // Capabilities
    // ============
    // Define your capabilities here. WebdriverIO can run multiple capabilities at the same
    // time. Depending on the number of capabilities, WebdriverIO launches several test
    // sessions. Within your capabilities you can overwrite the spec and exclude options in
    // order to group specific specs to a specific capability.
    //
    // First, you can define how many instances should be started at the same time. Let's
    // say you have 3 different capabilities (Chrome, Firefox, and Safari) and you have
    // set maxInstances to 1; wdio will spawn 3 processes. Therefore, if you have 10 spec
    // files and you set maxInstances to 10, all spec files will get tested at the same time
    // and 30 processes will get spawned. The property handles how many capabilities
    // from the same test should run tests.
    //
    maxInstances: 1,
    //
    // If you have trouble getting all important capabilities together, check out the
    // Sauce Labs platform configurator - a great tool to configure your capabilities:
    // https://saucelabs.com/platform/platform-configurator
    //
    capabilities: [
        {
            browserName: "vscode",
            browserVersion: "stable", // also possible: "insiders" or a specific version e.g. "1.80.0"
            "wdio:vscodeOptions": {
                // points to directory where extension package.json is located
                extensionPath: joinPath(__dirname, "..", "..", ".."),
                storagePath: dataDir,
                // optional VS Code settings
                userSettings: {
                    "editor.fontSize": 14,
                },
                vscodeArgs: {
                    // installExtension: profileVsixs,
                },
            },
        },
    ],

    //
    // ===================
    // Test Configurations
    // ===================
    // Define all options that are relevant for the WebdriverIO instance here
    //

    // Test runner services
    // Services take over a specific job you don't want to take care of. They enhance
    // your test setup with almost no effort. Unlike plugins, they don't add new
    // commands. Instead, they hook themselves up into the test process.
    services: [["vscode", { cachePath: joinPath(__dirname, "..", "..", "__common__", ".wdio-vscode-service") }]],

    // Framework you want to run your specs with.
    // The following are supported: Mocha, Jasmine, and Cucumber
    // see also: https://webdriver.io/docs/frameworks
    //
    // Make sure you have the wdio adapter package for the specific framework installed
    // before running any tests.
    framework: "cucumber",

    // If you are using Cucumber you need to specify the location of your step definitions.
    cucumberOpts: {
        // <string[]> (file/dir) require files before executing features
        require: ["./step_definitions/**/*.steps.ts"],
        // <boolean> show full backtrace for errors
        backtrace: false,
        // <string[]> ("extension:module") require files with the given EXTENSION after requiring MODULE (repeatable)
        requireModule: ["ts-node/register"],
        // <boolean> invoke formatters without executing steps
        dryRun: false,
        // <boolean> abort the run on first failure
        failFast: false,
        format: ["pretty"],
        colors: true,
        // <string[]> Only execute the scenarios with name matching the expression (repeatable).
        name: [],
        // <boolean> hide step definition snippets for pending steps
        snippets: true,
        // <boolean> hide source uris
        source: true,
        // <boolean> fail if there are any undefined or pending steps
        strict: false,
        // <string> (expression) only execute the features or scenarios with tags matching the expression
        tagExpression: "",
        // <number> timeout for step definitions
        timeout: 60000,
        // <boolean> Enable this config to treat undefined definitions as warnings.
        ignoreUndefinedDefinitions: false,
    },

    // Hooks
    beforeSession: function (config, caps, specs) {
        // TODO: Uncomment once WDIO supports arrays for VS Code args
        // const extensionsDir = joinPath(__dirname, "..", "..", "__common__", ".wdio-vscode-service", "data");
        // // For the sake of time, this step compiles the extenders and copies each one into the extension dir rather than packaging 3 VSIXs
        // const templateDir = joinPath(__dirname, "..", "..", "..", "..", "..", "samples", "__integration__", "profile-type-sample");
        // const extJsTemplate = readFileSync(joinPath(templateDir, "src", "extension.js.template")).toString();
        // const pkgJsonTemplate = readFileSync(joinPath(templateDir, "package.json.template")).toString();
        // for (const profileType of profileTypes) {
        //     const sampleDir = joinPath(extensionsDir, `${profileType}-sample`);
        //     if (existsSync(sampleDir)) {
        //         rmSync(sampleDir, { force: true, recursive: true });
        //     }
        //     const extensionJs = Handlebars.compile(extJsTemplate)({
        //         profileType,
        //     });
        //     const packageJson = Handlebars.compile(pkgJsonTemplate)({
        //         profileType,
        //     });
        //     mkdirSync(sampleDir);
        //     writeFileSync(joinPath(sampleDir, "extension.js"), extensionJs);
        //     writeFileSync(joinPath(sampleDir, "package.json"), packageJson);
        //     spawnSync(`npx vsce package ${sampleDir} --skip-license -o ${joinPath(extensionsDir, `${profileType}.vsix`)}`);
        // }
    },
};
