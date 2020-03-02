import * as vscode from "vscode";

interface IExtTextEditor extends vscode.TextEditor {
    id: string;
}

export async function checkTextFileIsOpened(path: string) {
    const openedWindows = [] as IExtTextEditor[];

    const tabSwitchDelay = 200;
    const openNextTab = () => {
        return new Promise((resolve) => {
            vscode.commands.executeCommand("workbench.action.nextEditor");
            setTimeout(() => resolve, tabSwitchDelay);
        });
    };

    let selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
    while (selectedEditor && !openedWindows.some((window) => window.id === selectedEditor.id)) {
        openedWindows.push(selectedEditor);

        await openNextTab();
        selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
    }

    return openedWindows.some((window) => window.document.fileName === path);
}
