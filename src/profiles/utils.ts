/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/


import * as vscode from "vscode";
import * as nls from "vscode-nls";
import * as globals from "../globals";
import { IProfileLoaded } from "@zowe/imperative";
import { errorHandling } from "../utils";
import { Profiles } from "../Profiles";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

// export async function getValidSession(serviceProfile: IProfileLoaded,
//                                       profileName: string,
//                                       prompt?: boolean): Promise<Session | null> {

//     // Retrieve baseProfile
//     const baseProfile = DefaultProfileManager.getInstance().getDefaultProfile("base");

//     // If user exists in serviceProfile, use serviceProfile to login because it has precedence over baseProfile
//     // If no user & no baseProfile, use serviceProfile as default
//     // If no user & no token, use serviceProfile as default
//     if (serviceProfile.profile.user || !baseProfile || (!serviceProfile.profile.user && !serviceProfile.profile.basePath)) {
//         if (prompt) {
//             // Select for prompting only fields which are not defined
//             const schemaArray = [];
//             if (!serviceProfile.profile.user && (!baseProfile || (baseProfile && !baseProfile.profile.user))) {
//                 if (!serviceProfile.profile.basePath) {
//                     schemaArray.push("user");
//                 }
//             }
//             if (!serviceProfile.profile.password && (!baseProfile || (baseProfile && !baseProfile.profile.password))) {
//                 schemaArray.push("password");
//             }
//             if (!serviceProfile.profile.host && (!baseProfile || (baseProfile && !baseProfile.profile.host))) {
//                 schemaArray.push("hostname");
//                 if (!serviceProfile.profile.port && (!baseProfile || (baseProfile && !baseProfile.profile.port))) { schemaArray.push("port"); }
//             }

//             try {
//                 const newDetails = await this.collectProfileDetails(schemaArray, null, null);
//                 for (const detail of schemaArray) {
//                     if (detail === "hostname") { serviceProfile.profile.host = newDetails[detail]; }
//                     else { serviceProfile.profile[detail] = newDetails[detail]; }
//                 }
//             } catch (error) {
//                 // tslint:disable:no-magic-numbers
//                 // if (error.mDetails && error.mDetails.errorCode === 401) {
//                 //     if (globals.ISTHEIA) {
//                 //         vscode.window.showErrorMessage(error.message);
//                 //         this.getValidSession(serviceProfile, serviceProfile.name, true);
//                 //     } else {
//                 //         vscode.window.showErrorMessage(error.message, "Check Credentials").then(async (selection) => {
//                 //             if (selection) {
//                 //                 delete serviceProfile.profile.user;
//                 //                 delete serviceProfile.profile.password;
//                 //                 await this.getValidSession(serviceProfile, serviceProfile.name, true);
//                 //             }
//                 //         });
//                 //     }
//                 // } else { throw error; }
//                 await errorHandling(error);
//             }
//         }
//         const cmdArgs: ICommandArguments = {
//             $0: "zowe",
//             _: [""],
//             host: serviceProfile.profile.host ? serviceProfile.profile.host :
//                 (baseProfile ? baseProfile.profile.host : undefined),
//             port: serviceProfile.profile.port ? serviceProfile.profile.port :
//                 (baseProfile ? baseProfile.profile.port : 0),
//             basePath: serviceProfile.profile.basePath ? serviceProfile.profile.basePath :
//                 (baseProfile ? baseProfile.profile.basePath : undefined),
//             rejectUnauthorized: serviceProfile.profile.rejectUnauthorized !== null ?
//                 serviceProfile.profile.rejectUnauthorized :
//                 (baseProfile ? baseProfile.profile.rejectUnauthorized : true),
//             user: serviceProfile.profile.user ? serviceProfile.profile.user :
//                 (baseProfile ? baseProfile.profile.user : undefined),
//             password: serviceProfile.profile.password ? serviceProfile.profile.password :
//                 (baseProfile ? baseProfile.profile.password : undefined),
//             tokenType: "apimlAuthenticationToken",
//             tokenValue: (baseProfile && !serviceProfile.profile.password) ? baseProfile.profile.tokenValue : undefined
//         };
//         return zowe.ZosmfSession.createBasicZosmfSessionFromArguments(cmdArgs);
//     } else if (baseProfile) {
//         // baseProfile exists, so APIML login is possible
//         const sessCfg = {
//             rejectUnauthorized: (serviceProfile.profile.rejectUnauthorized != null ? serviceProfile.profile.rejectUnauthorized :
//                 baseProfile.profile.rejectUnauthorized),
//             basePath: serviceProfile.profile.basePath,
//             hostname: serviceProfile.profile.host ? serviceProfile.profile.host : baseProfile.profile.host,
//             port: serviceProfile.profile.port ? serviceProfile.profile.port : baseProfile.profile.port,
//         };

//         const cmdArgs: ICommandArguments = {
//             $0: "zowe",
//             _: [""],
//             tokenType: "apimlAuthenticationToken",
//             tokenValue: baseProfile.profile.tokenValue
//         };

//         try {
//             let connectableSessCfg: ISession;
//             if (prompt) {
//                 connectableSessCfg = await ConnectionPropsForSessCfg.addPropsOrPrompt<ISession>(sessCfg,
//                     cmdArgs,
//                     {
//                         requestToken: false,
//                         doPrompting: prompt,
//                         getValuesBack: this.collectProfileDetails
//                     });
//             } else {
//                 connectableSessCfg = await ConnectionPropsForSessCfg.addPropsOrPrompt<ISession>(sessCfg,
//                     cmdArgs,
//                     { requestToken: false, doPrompting: false });
//             }

//             return new Session(connectableSessCfg);
//         } catch (error) {
//             // tslint:disable:no-magic-numbers
//             // if (error.mDetails && error.mDetails.errorCode === 401) {
//             //     if (globals.ISTHEIA) {
//             //         vscode.window.showErrorMessage(error.message);
//             //         this.getValidSession(serviceProfile, serviceProfile.name, true);
//             //     } else {
//             //         vscode.window.showErrorMessage(error.message, "Check Credentials").then(async (selection) => {
//             //             if (selection) {
//             //                 delete serviceProfile.profile.user;
//             //                 delete serviceProfile.profile.password;
//             //                 await this.getValidSession(serviceProfile, serviceProfile.name, true);
//             //             }
//             //         });
//             //     }
//             // } else { throw error; }
//             await errorHandling(error);
//         }
//     } else {
//         // Neither baseProfile nor serviceProfile exists. It is impossible to login with the currently-provided information.
//         throw new Error(localize("getValidSession.loginImpossible",
//             "Profile {0} is invalid. Please check your login details and try again.", profileName));
//     }
// }

export async function collectProfileDetails(detailsToGet?: string[], oldDetails?: any, schema?: any): Promise<any> {
    let newUrl: any;
    let newPort: number;
    let newUser: string;
    let newPass: string;
    let newRU: boolean;
    const schemaValues: any = {};

    if (!detailsToGet || detailsToGet === []) { detailsToGet = Object.keys(schema); }

    // Go through array of schema for input values
    for (const profileDetail of detailsToGet) {
        switch (profileDetail) {
            case "hostname":
                const hostOptions: vscode.InputBoxOptions = {
                    ignoreFocusOut: true,
                    value: oldDetails && oldDetails[profileDetail] ? oldDetails[profileDetail] : null,
                    placeHolder: localize("collectProfileDetails.option.prompt.url.placeholder", "url:port"),
                    prompt: localize("collectProfileDetails.option.prompt.url", "Enter a z/OS URL in the format 'url:port'."),
                    validateInput: (inputValue) => validateHostInput(inputValue, newUrl)
                };

                newUrl = await vscode.window.showInputBox(hostOptions);
                if (newUrl) {
                    newUrl = newUrl.replace(/https:\/\//g, "");
                    newUrl = new URL("https://" + newUrl);
                    newUrl.host = newUrl.host.replace(/'/g, "");
                    schemaValues[profileDetail] = newUrl.port ? newUrl.host.substring(0, newUrl.host.indexOf(":")) : newUrl.host;
                    if (newUrl.port !== 0) { schemaValues.port = Number(newUrl.port); }
                } else {
                    return;
                }
                break;
            case "port":
                if (!schemaValues[profileDetail] || schemaValues[profileDetail] === 0) {
                    let portOptions: vscode.InputBoxOptions = {
                        ignoreFocusOut: true,
                        value: oldDetails && oldDetails[profileDetail] ? oldDetails[profileDetail] : null,
                        validateInput: (value) => {
                            if (Number.isNaN(Number(value))) {
                                return localize("collectProfileDetails.invalidPort", "Please enter a valid port number");
                            } else if (Number(value) > globals.MAX_PORT) {
                                return localize("collectProfileDetails.invalidPort", "Please enter a valid port number");
                            } else { return null; }
                        }
                    };

                    // Use as default value the port number from the profile type's default schema
                    // (default is defined for each profile type in ...node_modules\@zowe\cli\lib\imperative.js)
                    if (schema[profileDetail].optionDefinition.hasOwnProperty("defaultValue")) {
                        // Default value defined in schema
                        portOptions = {
                            prompt: schema[profileDetail].optionDefinition.description.toString(),
                            value: oldDetails && oldDetails[profileDetail] ?
                                oldDetails[profileDetail] : schema[profileDetail].optionDefinition.defaultValue.toString()
                        };
                    } else {
                        // No default value defined
                        portOptions = {
                            placeHolder: localize("collectProfileDetails.option.prompt.port.placeholder", "Port Number"),
                            prompt: schema[profileDetail].optionDefinition.description.toString(),
                        };
                    }

                    let port;
                    const portFromUser = await vscode.window.showInputBox(portOptions);
                    if (typeof portFromUser === "undefined") {
                        return;
                    } else if (portFromUser && Number.isNaN(Number(portFromUser))) {
                        throw new Error(localize("collectProfileDetails.undefined.port",
                            "Invalid Port number provided or operation was cancelled"));
                    } else { port = Number(portFromUser); }

                    // Use default from schema if user entered 0 as port number
                    if (port === 0 && schema[profileDetail].optionDefinition.hasOwnProperty("defaultValue")) {
                        port = Number(schema[profileDetail].optionDefinition.defaultValue.toString());
                    } else if (schemaValues.host === "") { port = 0; }

                    schemaValues[profileDetail] = newPort = port;
                    break;
                }
                break;
            case "user":
                const userOptions = {
                    placeHolder: localize("collectProfileDetails.option.prompt.username.placeholder", "Optional: User Name"),
                    prompt: localize("collectProfileDetails.option.prompt.username", "Enter the user name for the connection."),
                    ignoreFocusOut: true,
                    value: oldDetails && oldDetails[profileDetail] ? oldDetails[profileDetail] : null,
                    validateInput: async (inputValue) => {
                        if (inputValue === undefined || inputValue.trim() === undefined) {
                            return localize("collectProfileDetails.invalidUser", "Please enter a valid username");
                        } else { return null; }
                    }
                };

                newUser = await vscode.window.showInputBox(userOptions);
                if (newUser === undefined) { return; }
                if (!newUser) {
                    vscode.window.showInformationMessage(localize("collectProfileDetails.undefined.username", "No username defined."));
                    newUser = null;
                }
                schemaValues[profileDetail] = newUser;
                break;
            case "password":
                const passOptions = {
                    placeHolder: localize("collectProfileDetails.option.prompt.password.placeholder", "Optional: Password"),
                    prompt: localize("collectProfileDetails.option.prompt.password", "Enter the password for the connection."),
                    password: true,
                    ignoreFocusOut: true,
                    value: oldDetails && oldDetails[profileDetail] ? oldDetails[profileDetail] : null,
                    validateInput: (inputValue) => {
                        if (inputValue === undefined || inputValue.trim() === undefined) {
                            return localize("collectProfileDetails.invalidUser", "Please enter a valid password");
                        } else { return null; }
                    }
                };

                newPass = await vscode.window.showInputBox(passOptions);
                if (typeof newPass === "undefined") { return; }
                if (!newPass) {
                    vscode.window.showInformationMessage(localize("collectProfileDetails.undefined.password", "No password defined."));
                    newPass = null;
                }
                schemaValues[profileDetail] = newPass;
                break;
            case "rejectUnauthorized":
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: localize("collectProfileDetails.option.prompt.ru.placeholder", "Reject Unauthorized Connections"),
                    ignoreFocusOut: true,
                    canPickMany: false
                };
                const ruOptions = ["True - Reject connections with self-signed certificates",
                    "False - Accept connections with self-signed certificates"];

                const chosenRU = await vscode.window.showQuickPick(ruOptions, quickPickOptions);

                if (chosenRU === ruOptions[0]) { newRU = true; }
                else if (chosenRU === ruOptions[1]) { newRU = false; }
                else {
                    return;
                }

                schemaValues[profileDetail] = newRU;
                break;
            default:
                let defaultOptions: vscode.InputBoxOptions;
                let responseDescription: string;

                const isTrue = Array.isArray(schema[profileDetail].type);
                let index: number;
                let schemaType;
                if (isTrue) {
                    if (schema[profileDetail].type.includes("boolean")) {
                        index = schema[profileDetail].type.indexOf("boolean");
                        schemaType = schema[profileDetail].type[index];
                    }
                    if (schema[profileDetail].type.includes("number")) {
                        index = schema[profileDetail].type.indexOf("number");
                        schemaType = schema[profileDetail].type[index];
                    }
                    if (schema[profileDetail].type.includes("string")) {
                        index = schema[profileDetail].type.indexOf("string");
                        schemaType = schema[profileDetail].type[index];
                    }
                } else { schemaType = schema[profileDetail].type; }

                switch (schemaType) {
                    case "number":
                        let numberOptions: vscode.InputBoxOptions;
                        responseDescription = schema[profileDetail].optionDefinition.description.toString();

                        // Use the default value from the schema in the prompt
                        // (defaults are defined in ...node_modules\@zowe\cli\lib\imperative.js)
                        if (schema[profileDetail].optionDefinition.hasOwnProperty("defaultValue")) {
                            // A default value is defined
                            numberOptions = {
                                prompt: responseDescription,
                                value: schema[profileDetail].optionDefinition.defaultValue
                            };
                        } else {
                            // No default value is defined
                            numberOptions = {
                                placeHolder: responseDescription,
                                prompt: responseDescription
                            };
                        }

                        const userInput = await vscode.window.showInputBox(numberOptions);

                        // Validate numerical input
                        if (!Number.isNaN(Number(userInput))) { schemaValues[profileDetail] = Number(userInput); }
                        else {
                            // Input is invalid, either use default value form schema or leave undefined
                            if (schema[profileDetail].optionDefinition.hasOwnProperty("defaultValue")) {
                                schemaValues[profileDetail] = schema[profileDetail].optionDefinition.defaultValue;
                            } else { schemaValues[profileDetail] = undefined; }
                        }
                        break;
                    case "boolean":
                        let boolVal: boolean;
                        const selectBoolean = ["True", "False"];
                        const booleanOptions: vscode.QuickPickOptions = {
                            placeHolder: schema[profileDetail].optionDefinition.description.toString(),
                            ignoreFocusOut: true,
                            canPickMany: false
                        };

                        const chosenValue = await vscode.window.showQuickPick(selectBoolean, booleanOptions);

                        if (chosenValue === selectBoolean[0]) { boolVal = true; }
                        else if (chosenValue === selectBoolean[1]) { boolVal = false; }
                        else { boolVal = undefined; }

                        if (boolVal === undefined) {
                            return;
                        } else {
                            schemaValues[profileDetail] = boolVal;
                            break;
                        }
                    default:
                        responseDescription = schema[profileDetail].optionDefinition.description.toString();

                        // Use the default value from the schema in the prompt
                        // (defaults are defined in ...node_modules\@zowe\cli\lib\imperative.js)
                        if (schema[profileDetail].optionDefinition.hasOwnProperty("defaultValue")) {
                            // A default value is defined
                            defaultOptions = {
                                prompt: responseDescription,
                                value: schema[profileDetail].optionDefinition.defaultValue
                            };
                        } else {
                            // No default value is defined
                            defaultOptions = {
                                placeHolder: responseDescription,
                                prompt: responseDescription,
                                value: oldDetails && oldDetails[profileDetail] ? oldDetails[profileDetail] : null,
                            };
                        }

                        const defValue = await vscode.window.showInputBox(defaultOptions);

                        if (typeof defValue === "undefined") { return; }
                        else if (defValue === "") { schemaValues[profileDetail] = null; }
                        else {
                            schemaValues[profileDetail] = defValue;
                            break;
                        }
                }
        }
    }

    return schemaValues;
}

// Validates the user input for host name
export function validateHostInput(inputValue, validationResult) {
    validationResult = {
        valid: false,
        protocol: null,
        host: null,
        port: null
    };

    // Check that the URL is valid
    let newInfo;
    try {
        newInfo = inputValue.replace(/https:\/\//g, "");
        newInfo = new URL("https://" + inputValue);
    } catch (error) {
        return localize("collectProfileDetails.invalidzosURL",
            "Please enter a valid host URL in the format 'url:port'.");
    }

    if (inputValue === "https://") {
        // User did not enter a host/port
        validationResult.port = 0;
        validationResult.host = "";
        validationResult.valid = true;
    } else {
        // User would like to store host/port
        validationResult.port = Number(newInfo.port);
        validationResult.host = newInfo.hostname;
        validationResult.valid = true;
    }

    return null;
}
