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

import { Types } from "../Types";

export class Poller {
    public static pollRequests: { [key: string]: Types.PollRequest } = {};

    private static poll(uniqueId: string, requestData: Types.PollRequest): Promise<unknown> {
        const pollHandler = async (resolve?: (uniqueId: string, data: any) => unknown, reject?: (typeof Promise)["reject"]): Promise<unknown> => {
            if (!Poller.pollRequests[uniqueId]) {
                // Poll request was discarded, return
                return resolve(uniqueId, null);
            }

            // Dispose the poll request if it was marked for disposal before next fetch attempt
            const shouldDispose = Poller.pollRequests[uniqueId].dispose;
            if (shouldDispose) {
                Poller.removeRequest(uniqueId);
                return resolve(uniqueId, null);
            }

            let data = null;
            try {
                data = await requestData.request();
            } catch (err) {
                return requestData.reject ? requestData.reject(err) : reject(err);
            }

            if (data && requestData.resolve) {
                requestData.resolve(uniqueId, data);
            }

            setTimeout(() => void pollHandler(resolve, reject), requestData.msInterval);
        };

        return pollHandler(requestData.resolve, requestData.reject?.bind(pollHandler));
    }

    public static addRequest(uniqueId: string, request: Types.PollRequest): void {
        Poller.pollRequests[uniqueId] = request;
        // Initialize the poll request
        void this.poll(uniqueId, request);
    }

    public static removeRequest(uniqueId: string): void {
        delete Poller.pollRequests[uniqueId];
    }
}
