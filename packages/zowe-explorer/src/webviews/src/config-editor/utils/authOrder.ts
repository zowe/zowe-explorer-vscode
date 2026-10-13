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

export const AUTH_METHODS = [
    { name: "token", tooltip: "API ML token authentication", icon: "codicon-key" },
    { name: "basic", tooltip: "User & password authentication", icon: "codicon-account" },
    { name: "bearer", tooltip: "Bearer token authentication", icon: "codicon-shield" },
    { name: "cert-pem", tooltip: "PEM certificate authentication", icon: "codicon-verified" },
] as const;

export function isAuthOrderProperty(key: string): boolean {
    return typeof key === "string" && key.toLowerCase() === "authorder";
}

export function parseAuthOrder(value: string): string[] {
    return value.trim() ? value.split(",").map((method) => method.trim()) : [];
}

export function toggleAuthMethod(value: string, authMethod: string): string {
    const methods = parseAuthOrder(value);
    return (methods.includes(authMethod) ? methods.filter((method) => method !== authMethod) : [...methods, authMethod]).join(", ");
}

export function isValidAuthOrder(value: string): boolean {
    const methods = parseAuthOrder(value);
    return new Set(methods).size === methods.length && methods.every((method) => AUTH_METHODS.some(({ name }) => name === method));
}
