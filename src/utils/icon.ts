import * as path from "path";

/**
 * Gets path to the icon, which is located in resources folder
 * @param iconFileName {string} Name of icon file with extension
 * @returns {object}
 */
export function getIconPathInResources(iconFileName: string) {
   return {
       light: path.join(__dirname, "..", "..", "..", "resources", "light", iconFileName),
       dark: path.join(__dirname, "..", "..", "..", "resources", "dark", iconFileName)
   };
}
