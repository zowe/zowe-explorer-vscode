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

import * as readYaml from "js-yaml";
import * as writeYaml from "yamljs";
import * as vscode from "vscode";
import { IProfileLoaded, Logger } from "@zowe/imperative";
import * as extension from "../extension";
import * as path from "path";
import * as fs from "fs";
import { Profiles } from "../Profiles";
import { ZoweTreeNode } from "../abstract/ZoweTreeNode";
import { IZoweTreeNode } from "../api/IZoweTreeNode";
import { getZoweDir } from "../utils";
import * as nls from "vscode-nls";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export async function getLinkedProfile(node: IZoweTreeNode, type: string, logger?: Logger) {
    try {
        if (node instanceof ZoweTreeNode) {
            return findLinkedProfile(await getProfile(node), type);
        }
        throw new Error(localize("profileLink.notTreeItem", "Tree Item is not a Zowe Explorer item."));
    } catch (err) {
        if (logger) {
            logger.warn(err.message);
        }
        throw (err);
    }
}

export function getProfile(node: vscode.TreeItem) {
    if (node instanceof ZoweTreeNode) {
        return (node as ZoweTreeNode).getProfile();
    }
    throw new Error(localize("profileLink.notTreeItem", "Tree Item is not a Zowe Explorer item."));
}

export async function linkProfileDialog(aProfile: IProfileLoaded) {
    let chosenName;
    let chosenType;
    if (aProfile) {
        const possibles = Profiles.getInstance().getAllTypes().filter( (value) => value !== aProfile.type);
        const quickPickOptions1: vscode.QuickPickOptions = {
            placeHolder: localize("profileLink.selectAltProfile", "Select a type of alternative profile to associate with this primary profile"),
            ignoreFocusOut: true,
            canPickMany: false
        };
        chosenType = await vscode.window.showQuickPick(possibles, quickPickOptions1);
        if (chosenType) {
            const profiles = Profiles.getInstance().getNamesForType(chosenType);
            const quickPickOptions2: vscode.QuickPickOptions = {
                placeHolder: localize("profileLink.selectFileName", "Select the file name to associate with this primary profile"),
                ignoreFocusOut: true,
                canPickMany: false
            };
            chosenName = await vscode.window.showQuickPick(profiles, quickPickOptions2);
            if (chosenName) {
                try {
                    await saveLinkedProfile(aProfile, chosenType, chosenName);
                    vscode.window.showInformationMessage(localize("profileLink.associated", "Associated secondary profile {0}:{1} with {2}:{3} primary.",
                                     chosenType,chosenName,aProfile.type,aProfile.name));
                } catch (err) {
                    vscode.window.showErrorMessage("Unable to save profile association. " + err.message);
                }
            }
        }
    }
}

async function findLinkedProfile(aProfile: IProfileLoaded, type: string) {
    let profile: IProfileLoaded;
    if (aProfile) {
        const linkRootDirectory = path.join(getZoweDir(), "links");
        if (!fs.existsSync(linkRootDirectory)) {
            createDirsSync(linkRootDirectory);
        }
        const file = path.join(linkRootDirectory, aProfile.type, aProfile.name + ".yaml");
        if (fs.existsSync(file)) {
            const properties = readYaml.safeLoad(fs.readFileSync(file));
            const links = properties.secondaries;
            for (const element of Object.keys(links)) {
                if (element === type) {
                    try {
                        profile = await Profiles.getInstance().directLoad(type, links[type]);
                    } catch (err) {
                        throw new Error(localize("profileLink.missingProfile", "Attempted to load a missing profile.") + " + " + err.message);
                    }
                }
            }
        }
    }
    return profile;
}

async function saveLinkedProfile(primary: IProfileLoaded, secondaryType: string, secondaryName: string) {
    const secondaryArray: { [secondaryType: string]: string } = {};
    if (primary) {
        const targetfile = path.join(path.join(getZoweDir(), "links"), primary.type, primary.name + ".yaml");
        if (!fs.existsSync(targetfile)) {
            createDirsSync(targetfile);
        }
        const input = fs.readFileSync(targetfile);
        let content = readYaml.safeLoad(input);
        if (!input || !content || !(content instanceof Object)) {
            content = {
                secondaries: secondaryArray,
            };
        } else if (!content.secondaries) {
            content.secondaries = secondaryArray;
        }
        content.secondaries[`${secondaryType}`] = secondaryName;
        fs.writeFileSync(targetfile, writeYaml.stringify(content));
    }
}

/**
 * Create all needed directories for an input directory in the form of:
 * first/second/third where first will contain director second and second
 * will contain directory third
 * @static
 * @param {string} dir - directory to create all sub directories for
 * origin in IO
 */
function createDirsSync(dir: string) {
    const FILE_DELIM: string = "/";
    const dirs = path.resolve(path.dirname(dir)).replace(/\\/g, FILE_DELIM).split(FILE_DELIM);
    let createDir: string = "";
    for (const crDir of dirs) {
        createDir += (crDir + FILE_DELIM);
        fs.mkdirSync(createDir);
    }
}
