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

import { RecordedFileEvent } from "../../../__common__/fileEvents.wdio";

/**
 * Asserts that an expected file change event was recorded, failing with the full event log so a
 * missing event can be told apart from a recorder that saw nothing at all.
 *
 * @param events Every event recorded for the scenario
 * @param matches Predicate identifying the expected event
 * @param description How to describe the expected event in the failure message
 */
export function assertRecorded(events: RecordedFileEvent[], matches: (event: RecordedFileEvent) => boolean, description: string): void {
    if (!events.some(matches)) {
        throw new Error(`Expected ${description}, but it was not emitted. Recorded events: ${JSON.stringify(events)}`);
    }
}
