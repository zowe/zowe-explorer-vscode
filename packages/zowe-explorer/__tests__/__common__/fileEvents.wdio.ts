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

/**
 * Helpers for observing the file change events that Zowe Explorer's file system providers emit.
 *
 * VS Code only surfaces these events inside the extension host, so the recorder is installed there
 * with `executeWorkbench` and stashed on `globalThis`. The test process then polls for the events it
 * expects, since providers debounce their events rather than firing them synchronously.
 */

export interface RecordedFileEvent {
    type: "created" | "changed" | "deleted";
    path: string;
}

/**
 * Installs a file system watcher in the extension host that records every event for the given scheme.
 * Replaces any recorder a previous scenario left behind, so each scenario starts from an empty log.
 *
 * @param scheme The URI scheme to watch, e.g. `zowe-ds` or `zowe-uss`
 */
export async function startRecordingFileEvents(scheme: string): Promise<void> {
    await browser.executeWorkbench((vsc, watchedScheme: string) => {
        const globals = globalThis as any;
        globals.__zeFileEvents?.watcher?.dispose();

        const recorded: unknown[] = [];
        const watcher = vsc.workspace.createFileSystemWatcher(
            new vsc.RelativePattern(vsc.Uri.from({ scheme: watchedScheme, path: "/" }), "**/*"),
            false,
            false,
            false
        );
        watcher.onDidCreate((uri) => recorded.push({ type: "created", path: uri.path }));
        watcher.onDidChange((uri) => recorded.push({ type: "changed", path: uri.path }));
        watcher.onDidDelete((uri) => recorded.push({ type: "deleted", path: uri.path }));

        globals.__zeFileEvents = { recorded, watcher };
    }, scheme);
}

/**
 * @returns Every event recorded since {@link startRecordingFileEvents} was called
 */
export async function recordedFileEvents(): Promise<RecordedFileEvent[]> {
    return (await browser.executeWorkbench(() => (globalThis as any).__zeFileEvents?.recorded ?? [])) as RecordedFileEvent[];
}

/**
 * Disposes the recorder installed by {@link startRecordingFileEvents}.
 */
export async function stopRecordingFileEvents(): Promise<void> {
    await browser.executeWorkbench(() => {
        const globals = globalThis as any;
        globals.__zeFileEvents?.watcher?.dispose();
        delete globals.__zeFileEvents;
    });
}

/**
 * Waits for a recorded event that satisfies {@link matches}, then returns the full event log.
 *
 * Returns the log rather than throwing on timeout, so the caller's assertion can report which events
 * were actually recorded instead of a bare timeout message.
 *
 * @param matches Predicate identifying the event being waited for
 * @param timeout How long to wait, in milliseconds
 */
export async function waitForFileEvent(matches: (event: RecordedFileEvent) => boolean, timeout = 30000): Promise<RecordedFileEvent[]> {
    let events: RecordedFileEvent[] = [];
    try {
        await browser.waitUntil(
            async () => {
                events = await recordedFileEvents();
                return events.some(matches);
            },
            { timeout, interval: 500 }
        );
    } catch {
        // Fall through: the caller asserts on the returned log, which reports what was seen.
    }
    return events;
}
