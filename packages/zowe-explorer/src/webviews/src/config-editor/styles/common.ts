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

export const commonStyles = {
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky" as const,
        top: 0,
        background: "var(--vscode-editor-background)",
    },
    headerButtons: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    profileList: {
        width: "250px",
        paddingRight: "1rem",
    },
    profileListItem: {
        cursor: "pointer",
        margin: "8px 0",
        padding: "8px",
        borderRadius: "4px",
        border: "2px solid var(--vscode-button-background)",
        position: "relative" as const,
    },
    profileListSelected: {
        backgroundColor: "var(--vscode-button-hoverBackground)",
    },
    profileListUnselected: {
        backgroundColor: "transparent",
    },
    profileName: {
        display: "block",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
        paddingRight: "24px",
    },
    actionButton: {
        position: "absolute" as const,
        top: "4px",
        right: "4px",
        padding: "2px",
        height: "20px",
        width: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        color: "var(--vscode-button-secondaryForeground)",
        borderRadius: "3px",
        cursor: "pointer",
        fontSize: "12px",
        lineHeight: "1",
    },
    dropdownMenu: {
        position: "absolute" as const,
        top: "28px",
        right: "4px",
        backgroundColor: "var(--vscode-dropdown-background)",
        border: "1px solid var(--vscode-dropdown-border)",
        borderRadius: "4px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        zIndex: 1000,
        minWidth: "120px",
    },
    dropdownItem: {
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: "8px 12px",
        border: "none",
        background: "none",
        color: "var(--vscode-dropdown-foreground)",
        cursor: "pointer",
        textAlign: "left" as const,
        fontSize: "12px",
    },
    dropdownItemError: {
        color: "var(--vscode-errorForeground)",
    },
};
