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
 * This script extracts localizable strings from release-notes.md and generates
 * l10n entries that can be used for translation. 
 *
 * The script parses markdown content and extracts:
 * - Section headings (### Heading)
 * - Paragraphs
 * - List items
 */

const fs = require("fs");
const path = require("path");

const RELEASE_NOTES_PATH = path.join(__dirname, "../src/webviews/dist/resources/release-notes.md");
const L10N_BUNDLE_PATH = path.join(__dirname, "../l10n/bundle.l10n.json");
const RELEASE_NOTES_L10N_PATH = path.join(__dirname, "../l10n/release-notes.l10n.json");

function cleanMarkdownText(text) {
    return text
        // Remove image markdown syntax
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        // Remove link URLs but keep link text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, "")
        // Remove inline code backticks but keep content
        .replace(/`([^`]+)`/g, "$1")
        // Normalize whitespace
        .replace(/\s+/g, " ")
        .trim();
}

function isImageOnlyLine(line) {
    const trimmed = line.trim();
    return /^!\[[^\]]*\]\([^)]+\)$/.test(trimmed);
}

function parseReleaseNotes(markdown) {
    const entries = {};
    const lines= markdown.split("\n");
    let currentVersion = null;
    let currentSection = null;
    let currentParagraph = [];
    const flushParagraph = () => {
        if (currentParagraph.length > 0 && currentVersion && currentSection) {
            const text = cleanMarkdownText(currentParagraph.join(" "));
            if (text.length > 0 && !entries[text]) {
                entries[text] = text;
            }
            currentParagraph = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        if (trimmedLine === "") {
            flushParagraph();
            continue;
        }
        if (isImageOnlyLine(trimmedLine)) {
            flushParagraph();
            continue;
        }
        if (trimmedLine.startsWith("<!--") || trimmedLine.endsWith("-->")) {
            continue;
        }
        const versionMatch = trimmedLine.match(/^## `(\d+\.\d+)\.\d+`$/);
        if (versionMatch) {
            flushParagraph();
            currentVersion = versionMatch[1];
            currentSection = null;
            continue;
        }
        const sectionMatch = trimmedLine.match(/^### (.+)$/);
        if (sectionMatch) {
            flushParagraph();
            currentSection = sectionMatch[1];
            const text = cleanMarkdownText(currentSection);
            if (text.length > 0 && !entries[text]) {
                entries[text] = text;
            }
            continue;
        }
        if (!currentVersion || !currentSection) {
            continue;
        }
        if (trimmedLine.match(/^[-*]\s+/)) {
            flushParagraph();
            const text = cleanMarkdownText(trimmedLine.replace(/^[-*]\s+/, ""));
            if (text.length > 0 && !entries[text]) {
                entries[text] = text;
            }
        } else {
            currentParagraph.push(trimmedLine);
        }
    }

    flushParagraph();

    return entries;
}
function main() {
    let releaseNotesContent;
    try {
        releaseNotesContent = fs.readFileSync(RELEASE_NOTES_PATH, "utf-8");
    } catch (error) {
        console.error(`Error reading release notes file: ${error.message}`);
        console.log("Skipping release notes l10n generation.");
        return;
    }

    const entries = parseReleaseNotes(releaseNotesContent);
    const entryCount = Object.keys(entries).length;

    console.log(`Extracted ${entryCount} localizable strings from release notes.`);

    fs.writeFileSync(RELEASE_NOTES_L10N_PATH, JSON.stringify(entries, null, 2) + "\n");
    console.log(`Written to: ${RELEASE_NOTES_L10N_PATH}`);

    let bundle = {};
    try {
        bundle = JSON.parse(fs.readFileSync(L10N_BUNDLE_PATH, "utf-8"));
    } catch (error) {
        console.warn(`Could not read existing bundle: ${error.message}`);
    }

    Object.assign(bundle, entries);
    const sortedBundle = Object.fromEntries(
        Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))
    );

    fs.writeFileSync(L10N_BUNDLE_PATH, JSON.stringify(sortedBundle, null, 2) + "\n");
    console.log(`Merged ${entryCount} entries into: ${L10N_BUNDLE_PATH}`);
}

main();
