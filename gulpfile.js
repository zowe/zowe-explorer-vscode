/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const gulp = require('gulp');
const filter = require('gulp-filter');

const ts = require('gulp-typescript');
const typescript = require('typescript');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const nls = require('vscode-nls-dev');

const tsProject = ts.createProject('./tsconfig.json', { typescript });
const outDest = 'dist';

// If all VS Code languages are supported, you can use nls.coreLanguages
// For new languages, add { folderName: 'ISO-639-3-Code-for-language', id: 'vscode-locale-id' } to array below
// Ex. for Chinese add: { folderName: 'zho', id: 'zh-cn' }
/* ************************* ADD NEW LANGUAGES HERE ******************************** */
const languages = [];
/* ********************************************************************************* */
const cleanTask = function() {
	return del(['dist/**', 'package.nls.*.json', 'vscode-extension-for-zowe*.vsix']);
}

const generateI18nTask = function() {
	return gulp.src(['package.nls.json'])
		.pipe(nls.createAdditionalLanguageFiles(languages, 'i18n'))
		.pipe(gulp.dest('.'));
};

const generateLocalizationBundle = () => {
	// Transpile the TS to JS, and let vscode-nls-dev scan the files for calls to localize
	// PROJECT ID is "<PUBLISHER>.<NAME>" (found in package.json)
	return tsProject.src()
		.pipe(sourcemaps.init())
        .pipe(tsProject()).js
        .pipe(nls.createMetaDataFiles())
        .pipe(nls.createAdditionalLanguageFiles(languages, "i18n"))
		.pipe(nls.bundleMetaDataFiles('Zowe.vscode-extension-for-zowe', outDest))
		.pipe(nls.bundleLanguageFiles())
		.pipe(filter(['**/nls.bundle.*.json', '**/nls.metadata.header.json', '**/nls.metadata.json']))
		.pipe(gulp.dest(outDest));
}

const localizationTask = gulp.series(cleanTask, generateLocalizationBundle, generateI18nTask);

const buildTask = gulp.series(localizationTask);

gulp.task('default', buildTask);

gulp.task('clean', cleanTask);

gulp.task('localization', localizationTask);

gulp.task('build', buildTask);
