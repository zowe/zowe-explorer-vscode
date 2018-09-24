# Contributor Guidelines ![Read Time](https://img.shields.io/badge/read%20time-4min-blue.svg)
This document is intended to be a living summary of conventions & best practices for development of the Visual Studio Code Extension for Zowe.

Keep additions to this document terse (~one line long).


## Project Layout
* the project root contains:
  * a `src` folder (main source for the plugin)
  * a `__tests__` folder for [integration tests](#integration-tests) 
  * `package.json` (normal for npm modules), but also contains information related to the 
  * a `README.md` for getting started

## General Conventions
* require / import dependencies at the top of a file (for the purpose of identifying load failures / missing files as soon as possible) 
* before implementing new functionality, evaluate packages that may already achieve intended functionality
* make classes small, logical pieces (e.g. instead of 1 `Jobs` class to hold all Job's APIs, we have `GetJobs`, `SubmitJobs`, `DeleteJobs`, etc...)
  
## Programmatic APIs 
* when developing programmatic asynchronous APIs, return promises instead of using call-backs

### Source File Naming Standards
* class names should match file names (e.g. `class SubmitJobs` would be found in a file `SubmitJobs.ts`)
* class member variables are prefixed with an `m` instead of `_` (e.g. `private mStatus: string = "failed";`) 
* interfaces names should match file names and should start with the capital letter `I`, (e.g. `interface ISubmitJobsParms` would be found in `ISubmitJobsParms.ts`) 
* interfaces should be separate files and should be in a `doc` folder (e.g. `../doc/input/ISubmitJobsParms`) 

### JS Documentation
* Use jsdoc annotations - [document this](https://marketplace.visualstudio.com/items?itemName=joelday.docthis) makes extensive use of jsdoc tags
  * common tags to use, `@returns`, `@param`, `@throws`, `@link` 

