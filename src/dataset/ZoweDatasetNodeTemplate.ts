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

import * as zowe from "@zowe/cli";
import { dir } from "console";

/**
 * Common implementation of properties associated with the ZoweDatasetNodeTemplate
 *
 * @export
 * @class ZoweDatasetNodeTemplate
 */
export class ZoweDatasetNodeTemplate {
    public templateName: string;
    public nodeLabel = "Undefined";
    public blockSize = 0;
    public dataClass = "Undefined";
    public nodeType = zowe.CreateDataSetTypeEnum.DATA_SET_BINARY;
    public deviceType = "Undefined";
    public directoryBlocks = 0;
    public managementClass = "Undefined";
    public primarySpace = 0;
    public recordFormat = "U";
    public recordLength = 0;
    public secondarySpace = 0;
    public showAttributes = false;
    public size = "Undefined";
    public storageClass = "Undefined";
    public volumeSerial = "Undefined";

    /**
     * Creates an instance of ZoweDatasetNode
     *
     * @param {string} templateName - The name of the template (only used within the extension)
     * @param {string} nodeLabel - The stored node label
     * @param {number} blockSize - The block size for the data set (for example, 6160). Default value: 27998
     * @param {string} dataClass - The SMS data class to use for the allocation
     * @param {zowe.CreateDataSetTypeEnum} nodeType - The data set type
     * @param {string} deviceType - The device type, also known as 'unit'
     * @param {number} directoryBlocks - The number of directory blocks. Default value: 25
     * @param {string} managementClass - The SMS management class to use for the allocation
     * @param {number} primarySpace - The primary space allocation (for example, 5). Default value: 10
     * @param {string} recordFormat - The record format for the data set (for example, FB for "Fixed Block"). Default value: U
     * @param {number} recordLength - The logical record length. Analogous to the length of a line (for example, 80). Default value: 27998
     * @param {number} secondarySpace - The secondary space allocation. Default value: 1
     * @param {boolean} showAttributes - Show the full allocation attributes?
     * @param {string} size - The size of the data set. Sets the primary allocation (the secondary allocation becomes ~10% of the primary).
     * @param {string} storageClass - The SMS storage class to use for the allocation
     * @param {string} volumeSerial - The volume serial (VOLSER) on which the data set should be placed. A VOLSER is analogous to a PC drive name.
     */
    constructor(templateName: string,
                nodeLabel?: string,
                blockSize?: number,
                dataClass?: string,
                nodeType?: zowe.CreateDataSetTypeEnum,
                deviceType?: string,
                directoryBlocks?: number,
                managementClass?: string,
                primarySpace?: number,
                recordFormat?: string,
                recordLength?: number,
                secondarySpace?: number,
                showAttributes?: boolean,
                size?: string,
                storageClass?: string,
                volumeSerial?: string) {
                    this.templateName = templateName;
                    if (nodeLabel) { this.nodeLabel = nodeLabel; }
                    if (blockSize) { this.blockSize = blockSize; }
                    if (dataClass) { this.dataClass = dataClass; }
                    if (nodeType) { this.nodeType = nodeType; }
                    if (deviceType) { this.deviceType = deviceType; }
                    if (directoryBlocks) { this.directoryBlocks = directoryBlocks; }
                    if (managementClass) { this.managementClass = managementClass; }
                    if (primarySpace) { this.primarySpace = primarySpace; }
                    if (recordFormat) { this.recordFormat = recordFormat; }
                    if (recordLength) { this.recordLength = recordLength; }
                    if (secondarySpace) { this.secondarySpace = secondarySpace; }
                    if (showAttributes) { this.showAttributes = showAttributes; }
                    if (size) { this.size = size; }
                    if (storageClass) { this.storageClass = storageClass; }
                    if (volumeSerial) { this.volumeSerial = volumeSerial; }
                }
}
