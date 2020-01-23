import { ZoweUSSNode } from "../ZoweUSSNode";
// tslint:disable-next-line: no-implicit-dependencies
import * as moment from "moment";

/**
 * Injects extra data to tooltip based on node status and other conditions
 * @param node
 * @param tooltip
 * @returns {string}
 */
export function injectAdditionalDataToTooltip(node: ZoweUSSNode, tooltip: string) {
    if (node.downloaded && node.downloadedTime) {
        // TODO: Add time formatter to localization so we will use not just US variant
        return `${tooltip} (Last Pulled: ${moment(node.downloadedTime).format("HH:mm MM/DD/YY")})`;
    }

    return tooltip;
}
