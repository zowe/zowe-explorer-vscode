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
import * as path from "path";
import * as fs from "fs";
import { Profiles } from "./Profiles";
import { ZoweTreeNode } from "./ZoweTreeNode";
import { IZoweTreeNode } from "./IZoweTreeNode";
import { getZoweDir } from "./Utils";
import * as nls from "vscode-nls";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

const LINKS_FOLDER = "profile_links";
const FILE_SUFFIX = ".yaml";

export async function getLinkedProfile(
    node: IZoweTreeNode,
    type: string,
    logger?: Logger
) {
    try {
        if (node instanceof ZoweTreeNode) {
            return findLinkedProfile(await getProfile(node), type);
        }
        throw new Error(
            localize(
                "profileLink.notTreeItem",
                "Tree Item is not a Zowe Explorer item."
            )
        );
    } catch (err) {
        if (logger) {
            logger.warn(err.message);
        }
        throw err;
    }
}

export function getProfile(node: vscode.TreeItem) {
    if (node instanceof ZoweTreeNode) {
        return (node as ZoweTreeNode).getProfile();
    }
    throw new Error(
        localize("profileLink.notTreeItem", "Tree Item is not a Zowe Explorer item.")
    );
}

export async function linkProfileDialog(aProfile: IProfileLoaded) {
    let chosenName;
    let chosenType;
    if (aProfile) {
        const possibles = Profiles.getInstance()
            .getAllTypes()
            .filter((value) => value !== aProfile.type);
        const quickPickOptions1: vscode.QuickPickOptions = {
            placeHolder: localize(
                "profileLink.selectAltProfile",
                "Select a type of alternative profile to associate with this primary profile"
            ),
            ignoreFocusOut: true,
            canPickMany: false,
        };
        chosenType = await vscode.window.showQuickPick(possibles, quickPickOptions1);
        if (chosenType) {
            const profiles = Profiles.getInstance().getNamesForType(chosenType);
            const quickPickOptions2: vscode.QuickPickOptions = {
                placeHolder: localize(
                    "profileLink.selectFileName",
                    "Select the file name to associate with this primary profile"
                ),
                ignoreFocusOut: true,
                canPickMany: false,
            };
            chosenName = await vscode.window.showQuickPick(
                profiles,
                quickPickOptions2
            );
            if (chosenName) {
                try {
                    await saveLinkedProfile(aProfile, chosenType, chosenName);
                    vscode.window.showInformationMessage(
                        localize(
                            "profileLink.associated",
                            "Associated secondary profile {0}:{1} with {2}:{3} primary.",
                            chosenType,
                            chosenName,
                            aProfile.type,
                            aProfile.name
                        )
                    );
                } catch (err) {
                    vscode.window.showErrorMessage(
                        localize(
                            "profileLink.unableToSave",
                            "Unable to save profile association. "
                        ) + err.message
                    );
                }
            }
        }
    }
}

async function findLinkedProfile(aProfile: IProfileLoaded, type: string) {
    let profile: IProfileLoaded;
    if (aProfile) {
        const linkRootDirectory = path.join(getZoweDir(), LINKS_FOLDER);
        if (!fs.existsSync(linkRootDirectory)) {
            fs.mkdirSync(linkRootDirectory);
        }
        const file = path.join(
            linkRootDirectory,
            aProfile.type,
            aProfile.name + FILE_SUFFIX
        );
        if (fs.existsSync(file)) {
            const properties = readYaml.safeLoad(fs.readFileSync(file));
            if (properties) {
                const links = properties.secondaries;
                if (links) {
                    for (const element of Object.keys(links)) {
                        if (element === type) {
                            try {
                                profile = await Profiles.getInstance().directLoad(
                                    type,
                                    links[type]
                                );
                            } catch (err) {
                                throw new Error(
                                    localize(
                                        "profileLink.missingProfile",
                                        "Attempted to load a missing profile."
                                    ) +
                                        " + " +
                                        err.message
                                );
                            }
                        }
                    }
                }
            }
        }
    }
    return profile;
}

async function saveLinkedProfile(
    primary: IProfileLoaded,
    secondaryType: string,
    secondaryName: string
) {
    const secondaryArray: { [secondaryType: string]: string } = {};
    let content = {
        secondaries: secondaryArray,
    };
    if (primary) {
        let targetfile = path.join(getZoweDir(), LINKS_FOLDER);
        if (!fs.existsSync(targetfile)) {
            fs.mkdirSync(targetfile);
        }
        targetfile = path.join(targetfile, primary.type);
        if (!fs.existsSync(targetfile)) {
            fs.mkdirSync(targetfile);
        }
        targetfile = path.join(targetfile, primary.name + FILE_SUFFIX);
        if (fs.existsSync(targetfile)) {
            content = readYaml.safeLoad(fs.readFileSync(targetfile));
        }
        if (!content || !(content instanceof Object)) {
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
