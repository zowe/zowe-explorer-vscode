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

export type PollRequest = {
    msInterval: number;
    dispose?: boolean;

    reject?<T = never>(reason?: any): Promise<T>;
    resolve?: (uniqueId: string, data: any) => any;
    request: () => Promise<unknown>;

    // Indexable for storing custom items
    [key: string]: any;
};

export class Poller {
    public static pollRequests: { [key: string]: PollRequest } = {};

    private static poll(uniqueId: string, requestData: PollRequest): Promise<unknown> {
        const pollHandler = async (resolve, reject): Promise<unknown> => {
            if (!Poller.pollRequests[uniqueId]) {
                // Poll request was discarded, return
                return resolve() as unknown;
            }

            // Dispose the poll request if it was marked for disposal before next fetch attempt
            const shouldDispose = Poller.pollRequests[uniqueId].dispose;
            if (shouldDispose) {
                Poller.removeRequest(uniqueId);
                return resolve() as unknown;
            }

            let data = null;
            try {
                data = await requestData.request();
            } catch (err) {
                if (requestData.reject) {
                    // eslint-disable-next-line zowe-explorer/no-floating-promises
                    requestData.reject(err);
                } else {
                    reject(err);
                }
            }

            if (data && requestData.resolve) {
                requestData.resolve(uniqueId, data);
            }

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            setTimeout(pollHandler, requestData.msInterval, resolve, reject);
        };

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        return new Promise(pollHandler);
    }

    public static addRequest(uniqueId: string, request: PollRequest): void {
        Poller.pollRequests[uniqueId] = request;

        // Initialize the poll request
        // eslint-disable-next-line zowe-explorer/no-floating-promises
        this.poll(uniqueId, request);
    }

    public static removeRequest(uniqueId: string): void {
        delete Poller.pollRequests[uniqueId];
    }
}
