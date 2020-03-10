import * as vscode from "vscode";

interface IExtTextEditor extends vscode.TextEditor {
    id: string;
}

/**
 * Opens the next tab in editor with given delay
 */
function openNextTab(delay: number) {
    return new Promise((resolve) => {
        vscode.commands.executeCommand("workbench.action.nextEditor");
        setTimeout(() => resolve(), delay);
    });
}

/**
 * Checks if file is opened using iteration through tabs
 * This kind of method is caused by incompleteness of VSCode API, which allows to check only buffered status of files
 * There's an issue on GitHub for such feature: https://github.com/Microsoft/vscode/issues/15178 let's track it
 * Idea of the approach was borrowed from the another extension: https://github.com/eamodio/vscode-restore-editors/blob/master/src/documentManager.ts
 * Also notice that timer delay as well as iteration through opened tabs can cause side-effects on slow machines
 */
export async function checkTextFileIsOpened(path: string) {
    const tabSwitchDelay = 200;
    const openedWindows = [] as IExtTextEditor[];

    let selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
    while (selectedEditor && !openedWindows.some((window) => window.id === selectedEditor.id)) {
        openedWindows.push(selectedEditor);

        await openNextTab(tabSwitchDelay);
        selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
    }

    return openedWindows.some((window) => window.document.fileName === path);
}

/**
 * Closes opened file tab using iteration through the tabs
 * This kind of method is caused by incompleteness of VSCode API, which allows to close only currently selected editor
 * For us it means we need to select editor first, which is again not possible via existing VSCode APIs
 */
export async function closeOpenedTextFile(path: string) {
    const tabSwitchDelay = 200;
    const openedWindows = [] as IExtTextEditor[];

    let selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
    while (selectedEditor && !openedWindows.some((window) => window.id === selectedEditor.id)) {
        openedWindows.push(selectedEditor);

        await openNextTab(tabSwitchDelay);
        selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;

        if (selectedEditor && selectedEditor.document.fileName === path) {
            vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            return true;
        }
    }

    return false;
}
