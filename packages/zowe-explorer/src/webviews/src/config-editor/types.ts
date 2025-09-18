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

// Types
export type Configuration = {
  configPath: string;
  properties: any;
  secure: string[];
  global?: boolean;
  user?: boolean;
  schemaPath?: string;
};

export type PendingChange = {
  value: string | number | boolean | Record<string, any>;
  path: string[];
  profile: string;
  secure?: boolean;
};

export type PendingDefault = {
  value: string;
  path: string[];
};

// Property sort order options
export type PropertySortOrder = "alphabetical" | "merged-first" | "non-merged-first";

// Profile sort order options
export type ProfileSortOrder = "natural" | "alphabetical" | "reverse-alphabetical";
