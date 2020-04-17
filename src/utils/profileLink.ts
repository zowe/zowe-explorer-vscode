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

import * as yaml from "js-yaml";
import * as vscode from "vscode";
import { IProfileLoaded, Logger } from "@zowe/imperative";
import * as extension from "../extension";
import * as path from "path";
import * as fs from "fs";
import { Profiles } from "../Profiles";
import { ZoweTreeNode } from "../abstract/ZoweTreeNode";
import { IZoweTreeNode } from "../api/IZoweTreeNode";
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
                saveLinkedProfile(aProfile, chosenType, chosenName);
                vscode.window.showInformationMessage("Associated " + chosenType + ":" + chosenName +
                " with " + aProfile.type + ":"+ aProfile.name); // TODO
            }
        }
    }
}

async function findLinkedProfile(aProfile: IProfileLoaded, type: string) {
    let profile: IProfileLoaded;
    if (aProfile) {
        const linkRootDirectory = path.join(extension.getZoweDir(), "links");
        if (!fs.existsSync(linkRootDirectory)) {
            fs.mkdirSync(linkRootDirectory);
        }
        const file = path.join(linkRootDirectory, aProfile.type, aProfile.name + ".yaml");
        if (fs.existsSync(file)) {
            const properties = await yaml.safeLoad(fs.readFileSync(file, "utf8"));
            const links = properties.configuration;
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
    let properties = {
        configuration: secondaryArray,
    };
    if (primary) {
        const linkRootDirectory = path.join(extension.getZoweDir(), "links");
        if (!fs.existsSync(linkRootDirectory)) {
            fs.mkdirSync(linkRootDirectory);
        }
        const file = path.join(linkRootDirectory, primary.type, primary.name + ".yaml");
        if (fs.existsSync(file)) {
            properties = await yaml.safeLoad(fs.readFileSync(file, "utf8"));
        }
        properties.configuration[`${secondaryType}`] = secondaryName;
        const output = yaml.safeDump(properties);
        fs.writeFileSync(file, output, "utf8");
    }
}
