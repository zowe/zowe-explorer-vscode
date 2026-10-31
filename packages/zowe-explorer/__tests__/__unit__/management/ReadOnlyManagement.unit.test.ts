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

import * as vscode from "vscode";
import { Gui, IZoweTreeNode, ZoweScheme } from "@zowe/zowe-explorer-api";
import { ReadOnlyManagement } from "../../../src/management/ReadOnlyManagement";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { Constants } from "../../../src/configuration/Constants";
import { MockedProperty } from "../../__mocks__/mockUtils";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";

describe("ReadOnlyManagement - dsMaskToRegex", () => {
    const matches = (mask: string, dsName: string, includeLowerLevels?: boolean): boolean =>
        ReadOnlyManagement.dsMaskToRegex(mask, includeLowerLevels).test(dsName);

    describe("mask without wildcards", () => {
        it.each([
            ["IBMUSER.LOADLIB", "IBMUSER.LOADLIB", true],
            ["IBMUSER.LOADLIB", "IBMUSER.LOADLIB.BACKUP", true],
            ["IBMUSER.LOADLIB", "IBMUSER.LOAD", false],
            ["IBMUSER.LOADLIB", "IBMUSER", false],
            ["IBMUSER.LOADLIB", "IBMUSER.JCL", false],
            ["IBMUSER.LOADLIB", "XIBMUSER.LOADLIB", false],
            ["IBMUSER.LOADLIB", "ZXP.IBMUSER.LOADLIB", false],
            ["ZXP", "ZXP", true],
            ["ZXP", "ZXP.PUBLIC.JCL", true],
            ["ZXP", "ZXPUBLIC.JCL", false],
            ["ZXP.PUBLIC", "ZXP.PUBLIC.JCL", true],
            ["ZXP.PUBLIC", "ZXP.PUBLICX.JCL", false],
            ["SYS1.PROCLIB", "SYS1.PROCLIB", true],
            ["SYS1.PROCLIB", "SYS1.PARMLIB", false],
        ])("%s matches %s: %s", (mask, dsName, expected) => {
            expect(matches(mask, dsName)).toBe(expected);
        });

        it("treats the qualifier separator as a literal dot", () => {
            expect(matches("IBMUSER.JCL", "IBMUSERXJCL")).toBe(false);
            expect(matches("SYS1.PROCLIB", "SYS1XPROCLIB")).toBe(false);
        });
    });

    describe("* wildcard (zero or more characters within one qualifier)", () => {
        it.each([
            ["IBMUSER.*", "IBMUSER.JCL", true],
            ["IBMUSER.*", "IBMUSER.SOURCE", true],
            ["IBMUSER.*", "IBMUSER.LOADLIB", true],
            ["IBMUSER.*", "IBMUSER.SOURCE.COBOL", true],
            ["IBMUSER.*", "IBMUSER0.JCL", false],
            ["IBMUSER.*", "IBMUSE.JCL", false],
            ["IBMUSER.*", "ZXP.PUBLIC.JCL", false],
            ["IBMUSER.LOAD*", "IBMUSER.LOAD", true],
            ["IBMUSER.LOAD*", "IBMUSER.LOADLIB", true],
            ["IBMUSER.LOAD*", "IBMUSER.LOADLIB.BACKUP", true],
            ["IBMUSER.LOAD*", "IBMUSER.JCL", false],
            ["IBMUSER.*LIB", "IBMUSER.LOADLIB", true],
            ["IBMUSER.*LIB", "IBMUSER.LIB", true],
            ["IBMUSER.*LIB", "IBMUSER.LIBRARY", false],
            ["Z02589*.JCL", "Z02589.JCL", true],
            ["Z0*.JCL", "Z00001.JCL", true],
            ["Z0*.JCL", "ZXP.JCL", false],
            ["*.JCL", "IBMUSER.JCL", true],
            ["*.JCL", "ZXP.JCL", true],
            ["*.JCL", "IBMUSER.JCL.BACKUP", true],
            ["*.JCL", "ZXP.PUBLIC.JCL", false],
            ["ZXP.*.JCL", "ZXP.PUBLIC.JCL", true],
            ["ZXP.*.JCL", "ZXP.JCL", false],
            ["ZXP.*.JCL", "ZXP.PUBLIC.SOURCE", false],
            ["IBMUSER.*.*", "IBMUSER.SOURCE.COBOL", true],
            ["IBMUSER.*.*", "IBMUSER.JCL", false],
            ["*PR*", "NDRPR", true],
            ["*PR*", "PROD.APP", true],
            ["*PR*", "ZXP.PUBLIC", false],
        ])("%s matches %s: %s", (mask, dsName, expected) => {
            expect(matches(mask, dsName)).toBe(expected);
        });
    });

    describe("% wildcard (exactly one character within a qualifier)", () => {
        it.each([
            ["IBMUSE%.JCL", "IBMUSER.JCL", true],
            ["IBMUSE%.JCL", "IBMUSE0.JCL", true],
            ["IBMUSE%.JCL", "IBMUSER9.JCL", false],
            ["IBMUSE%.JCL", "IBMUSE.JCL", false],
            ["IBMUSER.%%%", "IBMUSER.JCL", true],
            ["IBMUSER.%%%", "IBMUSER.CBL", true],
            ["IBMUSER.%%%", "IBMUSER.LOADLIB", false],
            ["IBMUSER.%%%", "IBMUSER.JC", false],
            ["IBMUSER.%%%", "IBMUSER.JCL.BACKUP", true],
            ["SYS%.**", "SYS1.PROCLIB", true],
            ["SYS%.**", "SYS2.PARMLIB", true],
            ["SYS%.**", "SYS10.PROCLIB", false],
            ["SYS%.**", "SYS.PROCLIB", false],
            ["%%%PR*", "NDRPR", true],
            ["%%%PR*", "NXTPR", true],
            ["%%%PR*", "NDRPR.SRC.COBOL", true],
            ["%%%PR*", "NXTPROD.LOADLIB", true],
            ["%%%PR*", "NDRD0.SRC.COBOL", false],
            ["%%%PR*", "NXTQA.SRC.COBOL", false],
            ["%%%PR*", "NDPR.SRC", false],
            ["%%%PR*", "NDRXPR.SRC", false],
            ["IBMUSER.%*", "IBMUSER.JCL", true],
        ])("%s matches %s: %s", (mask, dsName, expected) => {
            expect(matches(mask, dsName)).toBe(expected);
        });

        it("does not let % match the qualifier separator", () => {
            expect(matches("ZXP%PUBLIC", "ZXP.PUBLIC")).toBe(false);
            expect(matches("IBMUSER%JCL", "IBMUSER.JCL")).toBe(false);
        });
    });

    describe("** wildcard (zero or more qualifiers)", () => {
        it.each([
            ["**", "IBMUSER.JCL", true],
            ["**", "SYS1.PROCLIB", true],
            ["**", "ZXP", true],
            ["ZXP.**", "ZXP", true],
            ["ZXP.**", "ZXP.PUBLIC", true],
            ["ZXP.**", "ZXP.PUBLIC.JCL", true],
            ["ZXP.**", "ZXP.PUBLIC.SOURCE.COBOL", true],
            ["ZXP.**", "ZXPUBLIC.JCL", false],
            ["ZXP.**", "IBMUSER.ZXP", false],
            ["**.JCL", "IBMUSER.JCL", true],
            ["**.JCL", "ZXP.PUBLIC.JCL", true],
            ["**.JCL", "JCL", true],
            ["**.JCL", "IBMUSER.JCL.BACKUP", true],
            ["**.JCL", "IBMUSER.MYJCL", false],
            ["**.JCL", "IBMUSER.JCLLIB", false],
            ["ZXP.**.JCL", "ZXP.JCL", true],
            ["ZXP.**.JCL", "ZXP.PUBLIC.JCL", true],
            ["ZXP.**.JCL", "ZXP.PUBLIC.ARCHIVE.JCL", true],
            ["ZXP.**.JCL", "ZXP.PUBLIC.SOURCE", false],
            ["ZXP.**.JCL", "ZXPX.JCL", false],
            ["ZXP.**.JCL", "IBMUSER.JCL", false],
            ["ZXP.**.JCL", "ZXP.PUBLIC.XJCL", false],
            ["ZXP.**.JCL", "ZXP.PUBLIC.JCLX.SOURCE", false],
            ["**.LOADLIB.**", "IBMUSER.LOADLIB", true],
            ["**.LOADLIB.**", "IBMUSER.LOADLIB.BACKUP", true],
            ["**.LOADLIB.**", "LOADLIB", true],
            ["**.LOADLIB.**", "IBMUSER.LOAD", false],
            ["SYS1.**.LINKLIB", "SYS1.LINKLIB", true],
            ["SYS1.**.LINKLIB", "SYS1.CSSLIB", false],
        ])("%s matches %s: %s", (mask, dsName, expected) => {
            expect(matches(mask, dsName)).toBe(expected);
        });
    });

    describe("combined wildcards", () => {
        it.each([
            ["IBMUSE%.LOAD*.**", "IBMUSER.LOADLIB.BACKUP", true],
            ["IBMUSE%.LOAD*.**", "IBMUSER.LOAD", true],
            ["IBMUSE%.LOAD*.**", "IBMUSER.JCL", false],
            ["%%%PR*.**", "NDRPR", true],
            ["%%%PR*.**", "NDRPR.SRC.COBOL", true],
            ["%%%PR*.**", "NDRD0.SRC.COBOL", false],
            ["**.%%%", "IBMUSER.JCL", true],
            ["**.%%%", "ZXP.PUBLIC.CBL", true],
            ["*.**.LOAD*", "IBMUSER.LOADLIB", true],
            ["*.**.LOAD*", "IBMUSER.TEST.LOADLIB", true],
            ["*.**.LOAD*", "LOADLIB", false],
        ])("%s matches %s: %s", (mask, dsName, expected) => {
            expect(matches(mask, dsName)).toBe(expected);
        });
    });

    describe("case and whitespace", () => {
        it("ignores case in the mask and the data set name", () => {
            expect(matches("ibmuser.loadlib", "IBMUSER.LOADLIB")).toBe(true);
            expect(matches("zxp.**", "ZXP.PUBLIC.JCL")).toBe(true);
            expect(matches("IBMUSER.LOADLIB", "ibmuser.loadlib")).toBe(true);
        });

        it("ignores leading and trailing whitespace in the mask", () => {
            expect(matches("  ZXP.**  ", "ZXP.PUBLIC.JCL")).toBe(true);
            expect(matches("\tIBMUSER.LOADLIB ", "IBMUSER.LOADLIB")).toBe(true);
        });
    });

    describe("national characters and regex special characters", () => {
        it.each([
            ["IBMUSER.$TEMP", "IBMUSER.$TEMP", true],
            ["IBMUSER.$TEMP", "IBMUSER.TEMP", false],
            ["IBMUSER.#BACKUP.*", "IBMUSER.#BACKUP.JCL", true],
            ["IBMUSER.#BACKUP.*", "IBMUSER.BACKUP.JCL", false],
            ["IBMUSER.@PARMS", "IBMUSER.@PARMS", true],
            ["$*.**", "$SYSTEM.DATA", true],
            ["$*.**", "SYSTEM.DATA", false],
        ])("%s matches %s: %s", (mask, dsName, expected) => {
            expect(matches(mask, dsName)).toBe(expected);
        });

        it("does not treat ? as a wildcard since it is not a data set mask character", () => {
            expect(matches("IBMUSE?.JCL", "IBMUSER.JCL")).toBe(false);
            expect(matches("IBMUSER.JC?", "IBMUSER.JCL")).toBe(false);
        });
    });

    describe("without lower levels", () => {
        it.each([
            ["IBMUSER.JCL", "IBMUSER.JCL", true],
            ["IBMUSER.JCL", "IBMUSER.JCL.BACKUP", false],
            ["ZXP.PUBLIC.*", "ZXP.PUBLIC.JCL", true],
            ["ZXP.PUBLIC.*", "ZXP.PUBLIC.JCL.ARCHIVE", false],
            ["ZXP.PUBLIC", "ZXP.PUBLIC.JCL", false],
            ["ZXP.**", "ZXP.PUBLIC.JCL", true],
            ["ZXP.**", "ZXP", true],
            ["**.JCL", "ZXP.PUBLIC.JCL", true],
            ["**.JCL", "ZXP.PUBLIC.JCL.ARCHIVE", false],
        ])("%s matches %s: %s", (mask, dsName, expected) => {
            expect(matches(mask, dsName, false)).toBe(expected);
        });
    });
});

describe("ReadOnlyManagement - compileDsPattern", () => {
    describe("pattern without a member mask", () => {
        it.each([
            ["IBMUSER.LOADLIB", "IBMUSER.LOADLIB", undefined, true],
            ["IBMUSER.LOADLIB", "IBMUSER.LOADLIB", "HELLO", true],
            ["IBMUSER.LOADLIB", "IBMUSER.LOADLIB.BACKUP", "HELLO", true],
            ["IBMUSER.LOADLIB", "IBMUSER.JCL", "HELLO", false],
            ["ZXP.**", "ZXP.PUBLIC.JCL", "README", true],
            ["ZXP.**", "IBMUSER.JCL", "README", false],
            ["IBMUSER.*", "IBMUSER.JCL", "HELLO", true],
            ["IBMUSER.*", "IBMUSER.JCL", undefined, true],
        ])("%s matches %s(%s): %s", (pattern, dsName, member, expected) => {
            expect(ReadOnlyManagement.compileDsPattern(pattern)(dsName, member)).toBe(expected);
        });
    });

    describe("pattern with a member mask", () => {
        it.each([
            ["IBMUSER.JCL(HELLO)", "IBMUSER.JCL", "HELLO", true],
            ["IBMUSER.JCL(HELLO)", "IBMUSER.JCL", undefined, false],
            ["IBMUSER.JCL(HELLO)", "IBMUSER.JCL", "HELLO2", false],
            ["IBMUSER.JCL(HELLO)", "IBMUSER.JCL", "HELL", false],
            ["IBMUSER.JCL(HELLO)", "IBMUSER.JCL.BACKUP", "HELLO", false],
            ["IBMUSER.JCL(HELLO)", "IBMUSER.SOURCE", "HELLO", false],
            ["IBMUSER.JCL(HELLO*)", "IBMUSER.JCL", "HELLO", true],
            ["IBMUSER.JCL(HELLO*)", "IBMUSER.JCL", "HELLOJOB", true],
            ["IBMUSER.JCL(HELLO*)", "IBMUSER.JCL", "XHELLO", false],
            ["IBMUSER.JCL(*JOB)", "IBMUSER.JCL", "RUNJOB", true],
            ["IBMUSER.JCL(*JOB)", "IBMUSER.JCL", "JOB", true],
            ["IBMUSER.JCL(*JOB)", "IBMUSER.JCL", "JOBLIB", false],
            ["IBMUSER.JCL(PROD*)", "IBMUSER.JCL", "PRODJOB", true],
            ["IBMUSER.JCL(PROD*)", "IBMUSER.JCL", "HELLO", false],
            ["IBMUSER.JCL(%%%%%)", "IBMUSER.JCL", "HELLO", true],
            ["IBMUSER.JCL(%%%%%)", "IBMUSER.JCL", "HELL", false],
            ["IBMUSER.JCL(%%%%%)", "IBMUSER.JCL", "HELLO1", false],
            ["IBMUSER.JCL(HEL%O)", "IBMUSER.JCL", "HELLO", true],
            ["IBMUSER.JCL(HEL%O)", "IBMUSER.JCL", "HELO", false],
            ["IBMUSER.JCL(*)", "IBMUSER.JCL", "HELLO", true],
            ["IBMUSER.JCL(*)", "IBMUSER.JCL", undefined, false],
            ["IBMUSE%.JCL(PROD*)", "IBMUSER.JCL", "PRODJOB", true],
            ["IBMUSE%.JCL(PROD*)", "IBMUSER9.JCL", "PRODJOB", false],
            ["ZXP.PUBLIC.*(*)", "ZXP.PUBLIC.JCL", "README", true],
            ["ZXP.PUBLIC.*(*)", "ZXP.PUBLIC.SOURCE", "HELLO", true],
            ["ZXP.PUBLIC.*(*)", "ZXP.PUBLIC.SOURCE.ARCHIVE", "HELLO", false],
            ["ZXP.PUBLIC(*)", "ZXP.PUBLIC.JCL", "README", false],
            ["ZXP.PUBLIC.**(README)", "ZXP.PUBLIC.JCL", "README", true],
            ["ZXP.PUBLIC.**(README)", "ZXP.PUBLIC.SOURCE.ARCHIVE", "README", true],
            ["ZXP.PUBLIC.**(README)", "ZXP.PUBLIC.JCL", "HELLO", false],
            ["**(PROD*)", "IBMUSER.JCL", "PRODJOB", true],
            ["**(PROD*)", "ZXP.PUBLIC.JCL", "PRODRUN", true],
            ["**(PROD*)", "IBMUSER.JCL", undefined, false],
        ])("%s matches %s(%s): %s", (pattern, dsName, member, expected) => {
            expect(ReadOnlyManagement.compileDsPattern(pattern)(dsName, member)).toBe(expected);
        });

        it("ignores case in the member mask and the member name", () => {
            expect(ReadOnlyManagement.compileDsPattern("IBMUSER.JCL(hello)")("IBMUSER.JCL", "HELLO")).toBe(true);
            expect(ReadOnlyManagement.compileDsPattern("ibmuser.jcl(HELLO)")("IBMUSER.JCL", "hello")).toBe(true);
        });

        it("ignores whitespace around the pattern and inside the brackets", () => {
            expect(ReadOnlyManagement.compileDsPattern(" IBMUSER.JCL(HELLO) ")("IBMUSER.JCL", "HELLO")).toBe(true);
            expect(ReadOnlyManagement.compileDsPattern("IBMUSER.JCL( HELLO )")("IBMUSER.JCL", "HELLO")).toBe(true);
        });

        it("treats national characters in member names literally", () => {
            expect(ReadOnlyManagement.compileDsPattern("IBMUSER.JCL($TEMP)")("IBMUSER.JCL", "$TEMP")).toBe(true);
            expect(ReadOnlyManagement.compileDsPattern("IBMUSER.JCL($TEMP)")("IBMUSER.JCL", "TEMP")).toBe(false);
            expect(ReadOnlyManagement.compileDsPattern("IBMUSER.JCL(#*)")("IBMUSER.JCL", "#BACKUP")).toBe(true);
            expect(ReadOnlyManagement.compileDsPattern("IBMUSER.JCL(@%%)")("IBMUSER.JCL", "@01")).toBe(true);
        });

        it("matches no member for an empty member mask", () => {
            const matcher = ReadOnlyManagement.compileDsPattern("IBMUSER.JCL()");
            expect(matcher("IBMUSER.JCL", "HELLO")).toBe(false);
            expect(matcher("IBMUSER.JCL", undefined)).toBe(false);
        });

        it("matches nothing for a pattern with unbalanced brackets", () => {
            const matcher = ReadOnlyManagement.compileDsPattern("IBMUSER.JCL(HELLO");
            expect(matcher("IBMUSER.JCL", "HELLO")).toBe(false);
            expect(matcher("IBMUSER.JCL", undefined)).toBe(false);
        });
    });
});

describe("ReadOnlyManagement - ussGlobToRegex", () => {
    const matches = (glob: string, path: string): boolean => ReadOnlyManagement.ussGlobToRegex(glob).test(path);

    describe("trailing /** (a directory and everything in it)", () => {
        it.each([
            ["/z/public/**", "/z/public", true],
            ["/z/public/**", "/z/public/hello.txt", true],
            ["/z/public/**", "/z/public/cobol/hello.cbl", true],
            ["/z/public/**", "/z/publicity", false],
            ["/z/public/**", "/z/public2/hello.txt", false],
            ["/z/public/**", "/z/ibmuser/hello.txt", false],
            ["/z/public/**", "/u/z/public/hello.txt", false],
            ["/PROD/**", "/PROD", true],
            ["/PROD/**", "/PROD/app/config.yaml", true],
            ["/PROD/**", "/PRODUCTION/app/config.yaml", false],
            ["/bin/**", "/bin", true],
            ["/bin/**", "/bin/sh", true],
            ["/bin/**", "/usr/bin/sh", false],
            ["/etc/**", "/etc/profile", true],
            ["/etc/**", "/etc/ssh/sshd_config", true],
            ["/www/**", "/www/index.html", true],
            ["/www/**", "/www/zxplore/images/logo.png", true],
        ])("%s matches %s: %s", (glob, path, expected) => {
            expect(matches(glob, path)).toBe(expected);
        });
    });

    describe("path without wildcards", () => {
        it.each([
            ["/z/public", "/z/public", true],
            ["/z/public", "/z/public/hello.txt", false],
            ["/z/public", "/z/publicity", false],
            ["/etc/profile", "/etc/profile", true],
            ["/etc/profile", "/etc/profile.bak", false],
            ["/", "/", true],
            ["/", "/bin", false],
        ])("%s matches %s: %s", (glob, path, expected) => {
            expect(matches(glob, path)).toBe(expected);
        });
    });

    describe("* wildcard (within one path segment)", () => {
        it.each([
            ["/z/*", "/z/ibmuser", true],
            ["/z/*", "/z/public", true],
            ["/z/*", "/z/ibmuser/hello.txt", false],
            ["/z/*", "/z", false],
            ["/z/ibmuser/*", "/z/ibmuser/hello.txt", true],
            ["/z/ibmuser/*", "/z/ibmuser/cobol", true],
            ["/z/ibmuser/*", "/z/ibmuser/cobol/hello.cbl", false],
            ["/z/ibmuser/*.cbl", "/z/ibmuser/hello.cbl", true],
            ["/z/ibmuser/*.cbl", "/z/ibmuser/cobol/hello.cbl", false],
            ["/z/ibmuser/*.cbl", "/z/ibmuser/hello.cpy", false],
            ["/z/ibmuser/*.cbl", "/z/ibmuser/hellocbl", false],
            ["/z/ibmuser/hello.*", "/z/ibmuser/hello.cbl", true],
            ["/z/ibmuser/hello.*", "/z/ibmuser/hello.jcl", true],
            ["/z/ibmuser/hello.*", "/z/ibmuser/goodbye.cbl", false],
            ["/usr/lpp/java/*/bin", "/usr/lpp/java/JDK21/bin", true],
            ["/usr/lpp/java/*/bin", "/usr/lpp/java/JDK21/lib/bin", false],
            ["/usr/lpp/java/*/bin", "/usr/lpp/java/bin", false],
            ["/z/*/public", "/z/ibmuser/public", true],
            ["/z/*/public", "/z/public", false],
        ])("%s matches %s: %s", (glob, path, expected) => {
            expect(matches(glob, path)).toBe(expected);
        });
    });

    describe("? wildcard (exactly one character within a path segment)", () => {
        it.each([
            ["/z/ibmuse?", "/z/ibmuser", true],
            ["/z/ibmuse?", "/z/ibmuse0", true],
            ["/z/ibmuse?", "/z/ibmuser9", false],
            ["/z/ibmuse?", "/z/ibmuse", false],
            ["/z/ibmuse?/**", "/z/ibmuser/hello.txt", true],
            ["/z/i??????/**", "/z/ibmuser/hello.txt", true],
            ["/z/i??????/**", "/z/public/hello.txt", false],
            ["/z/ibmuser/hello.??l", "/z/ibmuser/hello.cbl", true],
            ["/z/ibmuser/hello.??l", "/z/ibmuser/hello.jcl", true],
            ["/z/ibmuser/hello.??l", "/z/ibmuser/hello.cpy", false],
        ])("%s matches %s: %s", (glob, path, expected) => {
            expect(matches(glob, path)).toBe(expected);
        });

        it("does not let ? match the path separator", () => {
            expect(matches("/z?public", "/z/public")).toBe(false);
            expect(matches("/z/ibmuse?hello.txt", "/z/ibmuse/hello.txt")).toBe(false);
        });
    });

    describe("** wildcard (zero or more path segments)", () => {
        it.each([
            ["**", "/z/ibmuser/hello.txt", true],
            ["**", "/", true],
            ["/**", "/etc/profile", true],
            ["/**", "/", true],
            ["/usr/lpp/**/bin", "/usr/lpp/bin", true],
            ["/usr/lpp/**/bin", "/usr/lpp/java/JDK21/bin", true],
            ["/usr/lpp/**/bin", "/usr/lpp/java/JDK21/bin/java", false],
            ["/usr/lpp/**/bin", "/usr/lpp/java/JDK21/sbin", false],
            ["**/.profile", "/z/ibmuser/.profile", true],
            ["**/.profile", "/.profile", true],
            ["**/.profile", "/etc/profile", false],
            ["**/.profile", "/z/ibmuser/x.profile", false],
            ["/z/ibmuser/**/*.jcl", "/z/ibmuser/hello.jcl", true],
            ["/z/ibmuser/**/*.jcl", "/z/ibmuser/jcl/hello.jcl", true],
            ["/z/ibmuser/**/*.jcl", "/z/ibmuser/jcl/archive/hello.jcl", true],
            ["/z/ibmuser/**/*.jcl", "/z/ibmuser/hello.cbl", false],
            ["/z/ibmuser/**/*.jcl", "/z/public/hello.jcl", false],
            ["/**/bin/**", "/bin/sh", true],
            ["/**/bin/**", "/usr/lpp/java/JDK21/bin/java", true],
            ["/**/bin/**", "/z/ibmuser/hello.txt", false],
        ])("%s matches %s: %s", (glob, path, expected) => {
            expect(matches(glob, path)).toBe(expected);
        });

        it("treats ** that is not a whole path segment like *", () => {
            expect(matches("/z/ibmuser/cobol**", "/z/ibmuser/cobolold")).toBe(true);
            expect(matches("/z/ibmuser/cobol**", "/z/ibmuser/cobol/hello.cbl")).toBe(false);
            expect(matches("/z/**02589", "/z/z02589")).toBe(true);
            expect(matches("/z/**02589", "/z/public/z02589")).toBe(false);
        });
    });

    describe("case and special characters", () => {
        it("is case sensitive", () => {
            expect(matches("/PROD/**", "/prod/app/config.yaml")).toBe(false);
            expect(matches("/z/IBMUSER/**", "/z/ibmuser/hello.txt")).toBe(false);
            expect(matches("/z/ibmuser/*.CBL", "/z/ibmuser/hello.cbl")).toBe(false);
        });

        it.each([
            ["/z/ibmuser/notes(1).txt", "/z/ibmuser/notes(1).txt", true],
            ["/z/ibmuser/notes(1).txt", "/z/ibmuser/notes1.txt", false],
            ["/z/ibmuser/a+b.txt", "/z/ibmuser/a+b.txt", true],
            ["/z/ibmuser/a+b.txt", "/z/ibmuser/aab.txt", false],
            ["/z/ibmuser/$HOME", "/z/ibmuser/$HOME", true],
            ["/z/ibmuser/hello.txt", "/z/ibmuser/helloxtxt", false],
            ["/z/ibmuser/^start", "/z/ibmuser/^start", true],
            ["/z/ibmuser/end|pipe", "/z/ibmuser/end|pipe", true],
            ["/z/ibmuser/end|pipe", "/z/ibmuser/end", false],
        ])("%s matches %s: %s", (glob, path, expected) => {
            expect(matches(glob, path)).toBe(expected);
        });
    });
});

const ds = (path: string, query?: string): vscode.Uri => vscode.Uri.from({ scheme: ZoweScheme.DS, path, query });
const uss = (path: string, query?: string): vscode.Uri => vscode.Uri.from({ scheme: ZoweScheme.USS, path, query });

const zxploreRules = [
    { ds: "ZXP.**" },
    { ds: "SYS1.**" },
    { ds: "IBMUSER.LOADLIB" },
    { ds: "IBMUSER.JCL(PROD*)" },
    { uss: "/PROD/**" },
    { uss: "/bin/**" },
    { uss: "/etc/**" },
    { uss: "/www/**" },
    { profile: "zosmf", uss: "/usr/lpp/**" },
    { profile: "zosmf", ds: "CEE.**" },
    { profile: "zosmf_prod" },
];

let getDirectValueSpy: ReturnType<typeof vi.spyOn>;
const useRules = (rules: unknown): void => {
    (ReadOnlyManagement as any).ruleCache = undefined;
    getDirectValueSpy = vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key: string) => {
        return key === Constants.SETTINGS_READ_ONLY_RULES ? rules : undefined;
    });
};

describe("ReadOnlyManagement - isReadOnly with zowe.readOnly.rules", () => {
    beforeEach(() => {
        (ReadOnlyManagement as any).overrides.clear();
        useRules(zxploreRules);
    });

    afterEach(() => {
        (ReadOnlyManagement as any).ruleCache = undefined;
        vi.restoreAllMocks();
    });

    describe("data sets", () => {
        it.each([
            ["/zosmf/IBMUSER.JCL", false],
            ["/zosmf/IBMUSER.JCL/HELLO", false],
            ["/zosmf/IBMUSER.JCL/PRODJOB", true],
            ["/zosmf/IBMUSER.SOURCE", false],
            ["/zosmf/IBMUSER.SOURCE/HELLO", false],
            ["/zosmf/IBMUSER.LOADLIB", true],
            ["/zosmf/IBMUSER.LOADLIB/HELLO", true],
            ["/zosmf/IBMUSER.LOADLIB.BACKUP", true],
            ["/zosmf/IBMUSER.LOAD", false],
            ["/zosmf/ZXP.PUBLIC.JCL", true],
            ["/zosmf/ZXP.PUBLIC.JCL/README", true],
            ["/zosmf/ZXP.PUBLIC.SOURCE/HELLO", true],
            ["/zosmf/SYS1.PROCLIB", true],
            ["/zosmf/SYS1.PARMLIB/IEASYS00", true],
            ["/zosmf/CEE.SCEELKED", true],
            ["/zosmf", false],
        ])("%s is read-only: %s", (path, expected) => {
            expect(ReadOnlyManagement.isReadOnly(ds(path))).toBe(expected);
        });

        it("ignores the file extension added to data set and member URIs", () => {
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/PRODJOB.jcl"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO.jcl"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.CBL/HELLO.cbl"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.SOURCE.CBL/HELLO.cbl"))).toBe(false);
        });

        it("only applies profile-scoped rules to that profile", () => {
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/CEE.SCEELKED"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/ssh/CEE.SCEELKED"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/ssh/ZXP.PUBLIC.JCL"))).toBe(true);
        });

        it("matches profile names case sensitively", () => {
            expect(ReadOnlyManagement.isReadOnly(ds("/ZOSMF/CEE.SCEELKED"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/ZOSMF_PROD/IBMUSER.JCL"))).toBe(false);
        });

        it("makes everything in a profile read-only for a profile-only rule", () => {
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf_prod"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf_prod/IBMUSER.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf_prod/IBMUSER.JCL/HELLO"))).toBe(true);
        });

        it("does not apply USS rules to data sets", () => {
            useRules([{ uss: "/**" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(false);
        });
    });

    describe("USS files and directories", () => {
        it.each([
            ["/zosmf/z/ibmuser", false],
            ["/zosmf/z/ibmuser/hello.txt", false],
            ["/zosmf/z/ibmuser/cobol/hello.cbl", false],
            ["/zosmf/z/public", false],
            ["/zosmf/z/public/hello.txt", false],
            ["/zosmf/PROD", true],
            ["/zosmf/PROD/app/config.yaml", true],
            ["/zosmf/prod/app/config.yaml", false],
            ["/zosmf/bin/sh", true],
            ["/zosmf/etc/profile", true],
            ["/zosmf/www/index.html", true],
            ["/zosmf/tmp/hello.txt", false],
            ["/zosmf/usr/lpp/java/JDK21/bin/java", true],
            ["/zosmf", false],
        ])("%s is read-only: %s", (path, expected) => {
            expect(ReadOnlyManagement.isReadOnly(uss(path))).toBe(expected);
        });

        it("only applies profile-scoped rules to that profile", () => {
            expect(ReadOnlyManagement.isReadOnly(uss("/ssh/usr/lpp/java/JDK21/bin/java"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/ssh/bin/sh"))).toBe(true);
        });

        it("makes everything in a profile read-only for a profile-only rule", () => {
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf_prod"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf_prod/z/ibmuser/hello.txt"))).toBe(true);
        });

        it("does not apply data set rules to USS", () => {
            useRules([{ ds: "**" }]);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/ZXP/hello.txt"))).toBe(false);
        });
    });

    describe("rule setting edge cases", () => {
        it.each([
            ["no rules", []],
            ["an unset setting", undefined],
            ["a setting that is not an array", { ds: "ZXP.**" }],
            ["empty and null rules", [null, {}]],
        ])("makes nothing read-only for %s", (_desc, rules) => {
            useRules(rules);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/bin/sh"))).toBe(false);
        });

        it("makes a resource read-only if any rule matches", () => {
            useRules([{ ds: "IBMUSER.JCL" }, { ds: "IBMUSER.LOADLIB" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.LOADLIB"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.SOURCE"))).toBe(false);
        });

        it("applies a rule with both a data set pattern and a USS glob to both", () => {
            useRules([{ ds: "ZXP.**", uss: "/z/public/**" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/public/hello.txt"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
        });
    });

    describe("other URIs", () => {
        it("is read-only for a readonly=true URI even if no rule matches", () => {
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO", "readonly=true"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt", "readonly=true"))).toBe(true);
        });

        it("is not read-only for URIs outside the data set and USS file systems", () => {
            useRules([{ ds: "**", uss: "/**" }]);
            expect(ReadOnlyManagement.isReadOnly(vscode.Uri.from({ scheme: ZoweScheme.Jobs, path: "/zosmf/IBMUSER/JOB01234" }))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(vscode.Uri.file("/z/ibmuser/hello.txt"))).toBe(false);
        });
    });

    describe("rule cache", () => {
        it("reads the setting once for repeated checks", () => {
            ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"));
            ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"));
            ReadOnlyManagement.isReadOnly(uss("/zosmf/bin/sh"));
            expect(getDirectValueSpy.mock.calls.filter(([key]) => key === Constants.SETTINGS_READ_ONLY_RULES)).toHaveLength(1);
        });

        it("uses the new rules after the setting changes", () => {
            let onConfigChange: (e: vscode.ConfigurationChangeEvent) => void;
            const configChangeMock = new MockedProperty(
                vscode.workspace,
                "onDidChangeConfiguration",
                undefined,
                vi.fn().mockImplementation((listener) => {
                    onConfigChange = listener;
                    return new vscode.Disposable(vi.fn());
                })
            );
            ReadOnlyManagement.initialize({ subscriptions: [] } as any);

            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            getDirectValueSpy.mockReturnValue([{ ds: "IBMUSER.**" }]);
            onConfigChange({ affectsConfiguration: (key: string) => key === Constants.SETTINGS_READ_ONLY_RULES });
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(true);
            configChangeMock[Symbol.dispose]();
        });

        it("keeps the cached rules when an unrelated setting changes", () => {
            let onConfigChange: (e: vscode.ConfigurationChangeEvent) => void;
            const configChangeMock = new MockedProperty(
                vscode.workspace,
                "onDidChangeConfiguration",
                undefined,
                vi.fn().mockImplementation((listener) => {
                    onConfigChange = listener;
                    return new vscode.Disposable(vi.fn());
                })
            );
            ReadOnlyManagement.initialize({ subscriptions: [] } as any);

            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            getDirectValueSpy.mockReturnValue([{ ds: "IBMUSER.**" }]);
            onConfigChange({ affectsConfiguration: (key: string) => key === "zowe.ds.paginate.dataSetsPerPage" });
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            configChangeMock[Symbol.dispose]();
        });
    });
});

const resetState = (): void => {
    (ReadOnlyManagement as any).overrides.clear();
    useRules(zxploreRules);
};

const treeNode = (uri: vscode.Uri | undefined, contextValue: string | undefined, extra: Partial<IZoweTreeNode> = {}): IZoweTreeNode =>
    ({ label: uri?.path.split("/").pop(), resourceUri: uri, contextValue, ...extra }) as IZoweTreeNode;

describe("ReadOnlyManagement - isSupportedUri", () => {
    it.each([
        ["a data set", ds("/zosmf/IBMUSER.JCL"), true],
        ["a PDS member", ds("/zosmf/IBMUSER.JCL/HELLO"), true],
        ["a data set profile", ds("/zosmf"), true],
        ["a USS file", uss("/zosmf/z/ibmuser/hello.txt"), true],
        ["a USS profile", uss("/zosmf"), true],
        ["a job spool file", vscode.Uri.from({ scheme: ZoweScheme.Jobs, path: "/zosmf/IBMUSER/JOB01234/JES2.JESMSGLG.2" }), false],
        ["a local file", vscode.Uri.file("/z/ibmuser/hello.txt"), false],
        ["an untitled document", vscode.Uri.from({ scheme: "untitled", path: "Untitled-1" }), false],
        ["an undefined URI", undefined, false],
    ])("for %s returns %s", (_desc, uri, expected) => {
        expect(ReadOnlyManagement.isSupportedUri(uri as vscode.Uri)).toBe(expected);
    });
});

describe("ReadOnlyManagement - applyPermission", () => {
    const fileStat = (): vscode.FileStat => ({ type: vscode.FileType.File, ctime: 1, mtime: 2, size: 3 });
    const dirStat = (): vscode.FileStat => ({ type: vscode.FileType.Directory, ctime: 1, mtime: 2, size: 0 });

    beforeEach(resetState);
    afterEach(() => {
        (ReadOnlyManagement as any).ruleCache = undefined;
        vi.restoreAllMocks();
    });

    it("marks a read-only file as read-only and keeps its other stats", () => {
        const stat = fileStat();
        expect(ReadOnlyManagement.applyPermission(ds("/zosmf/ZXP.PUBLIC.JCL/README"), stat)).toStrictEqual({
            ...stat,
            permissions: vscode.FilePermission.Readonly,
        });
    });

    it("does not modify the original stat object", () => {
        const stat = fileStat();
        ReadOnlyManagement.applyPermission(uss("/zosmf/bin/sh"), stat);
        expect(stat.permissions).toBeUndefined();
    });

    it("returns the same stat for a writable file", () => {
        const stat = fileStat();
        expect(ReadOnlyManagement.applyPermission(ds("/zosmf/IBMUSER.JCL/HELLO"), stat)).toBe(stat);
        expect(ReadOnlyManagement.applyPermission(uss("/zosmf/z/ibmuser/hello.txt"), stat)).toBe(stat);
    });

    it("does not mark directories as read-only", () => {
        const stat = dirStat();
        expect(ReadOnlyManagement.applyPermission(ds("/zosmf/ZXP.PUBLIC.JCL"), stat)).toBe(stat);
        expect(ReadOnlyManagement.applyPermission(uss("/zosmf/etc"), stat)).toBe(stat);
    });

    it("marks a file opened from a readonly=true link as read-only", () => {
        expect(ReadOnlyManagement.applyPermission(ds("/zosmf/IBMUSER.JCL/HELLO", "readonly=true"), fileStat()).permissions).toBe(
            vscode.FilePermission.Readonly
        );
    });

    it("marks a file made read-only from the tree as read-only", () => {
        ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
        expect(ReadOnlyManagement.applyPermission(ds("/zosmf/IBMUSER.JCL/HELLO"), fileStat()).permissions).toBe(vscode.FilePermission.Readonly);
    });

    it("returns a null or undefined stat as-is", () => {
        expect(ReadOnlyManagement.applyPermission(ds("/zosmf/ZXP.PUBLIC.JCL/README"), null as any)).toBeNull();
        expect(ReadOnlyManagement.applyPermission(ds("/zosmf/ZXP.PUBLIC.JCL/README"), undefined as any)).toBeUndefined();
    });

    it("returns the stat as-is for URIs outside the data set and USS file systems", () => {
        const stat = fileStat();
        expect(ReadOnlyManagement.applyPermission(vscode.Uri.file("/bin/sh"), stat)).toBe(stat);
    });
});

describe("ReadOnlyManagement - setReadOnly", () => {
    beforeEach(resetState);
    afterEach(() => {
        (ReadOnlyManagement as any).ruleCache = undefined;
        vi.restoreAllMocks();
    });

    describe("data sets", () => {
        it("makes a writable PDS and its members read-only", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.SOURCE/HELLO"))).toBe(false);
        });

        it("makes a PDS that a rule makes read-only writable, along with its members", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"), false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL/README"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.SOURCE/HELLO"))).toBe(true);
        });

        it("makes a single member read-only without affecting the other members", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"), true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/COMPILE"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
        });

        it("lets a member override its PDS", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"), false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/COMPILE"))).toBe(true);
        });

        it("clears member overrides when their PDS is changed", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"), false);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/COMPILE"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/COMPILE"))).toBe(true);
        });

        it("does not treat data sets with more qualifiers as children", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL.BACKUP"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL.BACKUP"))).toBe(true);

            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL.BACKUP/HELLO"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCLLIB"))).toBe(false);
        });

        it("lets a member override a member rule", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/PRODJOB"), false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/PRODJOB"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/PRODRUN"))).toBe(true);
        });

        it("ignores the file extension added to member URIs", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO.jcl"), true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(true);

            ReadOnlyManagement.setReadOnly(ds("/zosmf/ZXP.PUBLIC.CBL/HELLO"), false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.CBL/HELLO.cbl"))).toBe(false);
        });

        it("makes everything in a profile read-only, then back to what the rules decide", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf"), true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/ssh/IBMUSER.JCL/HELLO"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);

            ReadOnlyManagement.setReadOnly(ds("/zosmf"), false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL/README"))).toBe(true);
        });

        it("makes a profile that a profile rule makes read-only writable", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf_prod"), false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf_prod/IBMUSER.JCL/HELLO"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf_prod/z/ibmuser/hello.txt"))).toBe(true);
        });
    });

    describe("USS", () => {
        it("makes a writable directory and everything in it read-only", () => {
            ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser/cobol"), true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/cobol"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/cobol/hello.cbl"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/cobol/copybooks/record.cpy"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
        });

        it("makes a directory that a rule makes read-only writable", () => {
            ReadOnlyManagement.setReadOnly(uss("/zosmf/PROD"), false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/PROD/app/config.yaml"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/bin/sh"))).toBe(true);
        });

        it("does not treat directories with the same prefix as children", () => {
            ReadOnlyManagement.setReadOnly(uss("/zosmf/z/public"), true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/publicity/hello.txt"))).toBe(false);
        });

        it("lets a file override its directory", () => {
            ReadOnlyManagement.setReadOnly(uss("/zosmf/etc/profile"), false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/etc/profile"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/etc/ssh/sshd_config"))).toBe(true);
        });

        it("clears file overrides when their directory is changed", () => {
            ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser/hello.txt"), true);
            ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser"), false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
        });

        it("keeps data set and USS overrides separate for the same profile", () => {
            ReadOnlyManagement.setReadOnly(uss("/zosmf"), true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(false);
        });
    });

    describe("override lifecycle", () => {
        it("does not store an override when the resource is already in the requested state", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), false);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"), true);
            expect((ReadOnlyManagement as any).overrides.size).toBe(0);

            // With no override stored, later rule changes still apply
            useRules([{ ds: "IBMUSER.**" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(false);
        });

        it("removes the override when a resource is changed back", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            expect((ReadOnlyManagement as any).overrides.size).toBe(0);
        });

        it("keeps overrides in place when the rules change", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"), false);
            ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser"), true);
            useRules([]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(true);
        });

        it("does not let an override make a readonly=true link writable", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO", "readonly=true"), false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO", "readonly=true"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(false);
        });

        it("ignores the query when storing an override", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO", "readonly=true"), true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO", "fetch=true"))).toBe(true);
        });

        it("only keeps overrides for the current session", () => {
            const setValueSpy = vi.spyOn(ZoweLocalStorage, "setValue");
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
            ReadOnlyManagement.setReadOnly(uss("/zosmf/PROD"), false);
            expect(setValueSpy).not.toHaveBeenCalled();
        });

        it("fires onDidChange once for each change", () => {
            const listener = vi.fn();
            const subscription = ReadOnlyManagement.onDidChange(listener);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
            ReadOnlyManagement.setReadOnly(uss("/zosmf/PROD"), false);
            expect(listener).toHaveBeenCalledTimes(2);
            subscription.dispose();
        });
    });
});

describe("ReadOnlyManagement - initialize and onDidChange", () => {
    let onConfigChange: (e: vscode.ConfigurationChangeEvent) => void;
    let configChangeMock: MockedProperty;
    const disposable = new vscode.Disposable(vi.fn());

    beforeEach(() => {
        resetState();
        configChangeMock = new MockedProperty(
            vscode.workspace,
            "onDidChangeConfiguration",
            undefined,
            vi.fn().mockImplementation((listener) => {
                onConfigChange = listener;
                return disposable;
            })
        );
    });

    afterEach(() => {
        configChangeMock[Symbol.dispose]();
        (ReadOnlyManagement as any).ruleCache = undefined;
        vi.restoreAllMocks();
    });

    it("registers its configuration listener with the extension context", () => {
        const context = { subscriptions: [] as vscode.Disposable[] };
        ReadOnlyManagement.initialize(context as any);
        expect(context.subscriptions).toContain(disposable);
    });

    it("fires onDidChange when the rules setting changes", () => {
        ReadOnlyManagement.initialize({ subscriptions: [] } as any);
        const listener = vi.fn();
        const subscription = ReadOnlyManagement.onDidChange(listener);
        onConfigChange({ affectsConfiguration: (key: string) => key === Constants.SETTINGS_READ_ONLY_RULES });
        expect(listener).toHaveBeenCalledTimes(1);
        subscription.dispose();
    });

    it("does not fire onDidChange when an unrelated setting changes", () => {
        ReadOnlyManagement.initialize({ subscriptions: [] } as any);
        const listener = vi.fn();
        const subscription = ReadOnlyManagement.onDidChange(listener);
        onConfigChange({ affectsConfiguration: (key: string) => key === "zowe.ds.default.sort" });
        expect(listener).not.toHaveBeenCalled();
        subscription.dispose();
    });

    it("fires onDidChange when notifyChanged is called", () => {
        const listener = vi.fn();
        const subscription = ReadOnlyManagement.onDidChange(listener);
        ReadOnlyManagement.notifyChanged();
        expect(listener).toHaveBeenCalledTimes(1);
        subscription.dispose();
    });
});

describe("ReadOnlyManagement - isEligibleNode", () => {
    it.each([
        ["a sequential data set", ds("/zosmf/IBMUSER.OUTPUT"), Constants.DS_DS_CONTEXT],
        ["a binary sequential data set", ds("/zosmf/IBMUSER.LOAD.BIN"), Constants.DS_DS_BINARY_CONTEXT],
        ["a favorited sequential data set", ds("/zosmf/IBMUSER.OUTPUT"), Constants.DS_FAV_CONTEXT],
        ["a PDS", ds("/zosmf/IBMUSER.JCL"), Constants.DS_PDS_CONTEXT],
        ["a favorited PDS", ds("/zosmf/IBMUSER.JCL"), Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX],
        ["a filtered PDS", ds("/zosmf/IBMUSER.JCL"), Constants.DS_PDS_CONTEXT + Constants.CONTEXT_PREFIX + Constants.FILTER_SEARCH],
        ["a PDS member", ds("/zosmf/IBMUSER.JCL/HELLO"), Constants.DS_MEMBER_CONTEXT],
        ["a binary PDS member", ds("/zosmf/IBMUSER.LOADLIB/HELLO"), Constants.DS_MEMBER_BINARY_CONTEXT],
        ["a data set profile", ds("/zosmf"), Constants.DS_SESSION_CONTEXT + Constants.ACTIVE_CONTEXT],
        ["a favorited data set profile", ds("/zosmf"), Constants.DS_SESSION_FAV_CONTEXT],
        ["a USS profile", uss("/zosmf"), Constants.USS_SESSION_CONTEXT + Constants.ACTIVE_CONTEXT],
        ["a filtered USS profile", uss("/zosmf"), Constants.USS_SESSION_CONTEXT + Constants.CONTEXT_PREFIX + Constants.FILTER_SEARCH],
        ["a USS directory", uss("/zosmf/z/ibmuser/cobol"), Constants.USS_DIR_CONTEXT],
        ["a favorited USS directory", uss("/zosmf/z/ibmuser/cobol"), Constants.USS_FAV_DIR_CONTEXT],
        ["a USS text file", uss("/zosmf/z/ibmuser/hello.cbl"), Constants.USS_TEXT_FILE_CONTEXT],
        ["a favorited USS text file", uss("/zosmf/z/ibmuser/hello.cbl"), Constants.USS_FAV_TEXT_FILE_CONTEXT],
        ["a USS binary file", uss("/zosmf/z/ibmuser/hello"), Constants.USS_BINARY_FILE_CONTEXT],
    ])("returns true for %s", (_desc, uri, contextValue) => {
        expect(ReadOnlyManagement.isEligibleNode(treeNode(uri, contextValue))).toBe(true);
    });

    it.each([
        ["a VSAM data set", ds("/zosmf/IBMUSER.KSDS"), Constants.VSAM_CONTEXT],
        ["a migrated data set", ds("/zosmf/IBMUSER.OLD.JCL"), Constants.DS_MIGRATED_FILE_CONTEXT],
        ["a member that failed to load", ds("/zosmf/IBMUSER.JCL/BROKEN"), Constants.DS_FILE_ERROR_MEMBER_CONTEXT],
        ["an information placeholder", ds("/zosmf/IBMUSER.JCL"), Constants.INFORMATION_CONTEXT],
        ["a jobs profile", vscode.Uri.from({ scheme: ZoweScheme.Jobs, path: "/zosmf" }), Constants.JOBS_SESSION_CONTEXT],
        ["a job", vscode.Uri.from({ scheme: ZoweScheme.Jobs, path: "/zosmf/JOB01234" }), Constants.JOBS_JOB_CONTEXT],
        ["a spool file", vscode.Uri.from({ scheme: ZoweScheme.Jobs, path: "/zosmf/JOB01234/JES2.JESMSGLG.2" }), Constants.JOBS_SPOOL_CONTEXT],
        ["a data set node without a resource URI", undefined, Constants.DS_PDS_CONTEXT],
        ["a data set node without a context value", ds("/zosmf/IBMUSER.JCL"), undefined],
    ])("returns false for %s", (_desc, uri, contextValue) => {
        expect(ReadOnlyManagement.isEligibleNode(treeNode(uri, contextValue))).toBe(false);
    });

    it("returns false for an undefined node", () => {
        expect(ReadOnlyManagement.isEligibleNode(undefined as any)).toBe(false);
    });
});

describe("ReadOnlyManagement - getTreeItem", () => {
    beforeEach(resetState);
    afterEach(() => {
        (ReadOnlyManagement as any).ruleCache = undefined;
        vi.restoreAllMocks();
    });

    it("returns the node itself if it is not eligible", () => {
        const node = treeNode(ds("/zosmf/IBMUSER.KSDS"), Constants.VSAM_CONTEXT);
        expect(ReadOnlyManagement.getTreeItem(node)).toBe(node);
    });

    it("adds the writable context to a writable node", () => {
        const item = ReadOnlyManagement.getTreeItem(treeNode(ds("/zosmf/IBMUSER.JCL"), Constants.DS_PDS_CONTEXT));
        expect(item.contextValue).toBe(Constants.DS_PDS_CONTEXT + Constants.WRITABLE_CONTEXT);
    });

    it("adds the read-only context to a node that a rule makes read-only", () => {
        const item = ReadOnlyManagement.getTreeItem(treeNode(ds("/zosmf/ZXP.PUBLIC.JCL"), Constants.DS_PDS_CONTEXT));
        expect(item.contextValue).toBe(Constants.DS_PDS_CONTEXT + Constants.READ_ONLY_CONTEXT);
    });

    it("adds the context after any existing suffixes", () => {
        const contextValue = Constants.USS_SESSION_CONTEXT + Constants.ACTIVE_CONTEXT;
        const item = ReadOnlyManagement.getTreeItem(treeNode(uss("/zosmf_prod"), contextValue));
        expect(item.contextValue).toBe(contextValue + Constants.READ_ONLY_CONTEXT);
    });

    it("reflects changes made with setReadOnly", () => {
        const node = treeNode(uss("/zosmf/z/ibmuser/hello.txt"), Constants.USS_TEXT_FILE_CONTEXT);
        expect(ReadOnlyManagement.getTreeItem(node).contextValue).toBe(Constants.USS_TEXT_FILE_CONTEXT + Constants.WRITABLE_CONTEXT);
        ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser"), true);
        expect(ReadOnlyManagement.getTreeItem(node).contextValue).toBe(Constants.USS_TEXT_FILE_CONTEXT + Constants.READ_ONLY_CONTEXT);
    });

    it("does not change the node's own context value", () => {
        const node = treeNode(ds("/zosmf/ZXP.PUBLIC.JCL"), Constants.DS_PDS_CONTEXT);
        const item = ReadOnlyManagement.getTreeItem(node);
        expect(item).not.toBe(node);
        expect(node.contextValue).toBe(Constants.DS_PDS_CONTEXT);
    });

    it("copies the properties used to render the node", () => {
        const command = { command: "vscode.open", title: "", arguments: [ds("/zosmf/IBMUSER.JCL/HELLO")] };
        const iconPath = new vscode.ThemeIcon("file");
        const accessibilityInformation = { label: "HELLO member" };
        const node = treeNode(ds("/zosmf/IBMUSER.JCL/HELLO"), Constants.DS_MEMBER_CONTEXT, {
            label: "HELLO",
            id: "zosmf.IBMUSER.JCL.HELLO",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            iconPath,
            description: "2026/10/10",
            tooltip: "IBMUSER.JCL(HELLO)",
            command,
            accessibilityInformation,
            checkboxState: 0,
        });

        const item = ReadOnlyManagement.getTreeItem(node);
        expect(item.label).toBe("HELLO");
        expect(item.id).toBe("zosmf.IBMUSER.JCL.HELLO");
        expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
        expect(item.iconPath).toBe(iconPath);
        expect(item.description).toBe("2026/10/10");
        expect(item.resourceUri).toBe(node.resourceUri);
        expect(item.tooltip).toBe("IBMUSER.JCL(HELLO)");
        expect(item.command).toBe(command);
        expect(item.accessibilityInformation).toBe(accessibilityInformation);
        expect(item.checkboxState).toBe(0);
    });

    describe("USS profile filtered to a directory", () => {
        const filteredContext = Constants.USS_SESSION_CONTEXT + Constants.CONTEXT_PREFIX + Constants.FILTER_SEARCH;
        const filteredProfile = (fullPath: string): IZoweTreeNode => treeNode(uss("/zosmf"), filteredContext, { fullPath } as any);
        const allButHomeRules = [{ uss: "/**" }, { uss: "!/z/ibmuser/**" }, { uss: "!/z/public/**" }, { uss: "/z/ibmuser/file3.py" }];

        it("uses the filtered directory rather than the profile root", () => {
            useRules(allButHomeRules);
            expect(ReadOnlyManagement.getTreeItem(filteredProfile("/z/ibmuser")).contextValue).toBe(filteredContext + Constants.WRITABLE_CONTEXT);
            expect(ReadOnlyManagement.getTreeItem(filteredProfile("/etc")).contextValue).toBe(filteredContext + Constants.READ_ONLY_CONTEXT);
        });

        it("uses the filtered directory when a parent directory is negated", () => {
            useRules([{ uss: "/**" }, { uss: "!/z/**" }]);
            expect(ReadOnlyManagement.getTreeItem(filteredProfile("/z/ibmuser")).contextValue).toBe(filteredContext + Constants.WRITABLE_CONTEXT);
        });

        it("uses the profile root when the profile is not filtered", () => {
            useRules(allButHomeRules);
            const contextValue = Constants.USS_SESSION_CONTEXT + Constants.ACTIVE_CONTEXT;
            const item = ReadOnlyManagement.getTreeItem(treeNode(uss("/zosmf"), contextValue, { fullPath: "" } as any));
            expect(item.contextValue).toBe(contextValue + Constants.READ_ONLY_CONTEXT);
        });

        it("reflects an override set on the filtered directory", () => {
            useRules(allButHomeRules);
            const node = filteredProfile("/z/ibmuser");
            ReadOnlyManagement.setReadOnly(ReadOnlyManagement.getNodeUri(node), true);
            expect(ReadOnlyManagement.getTreeItem(node).contextValue).toBe(filteredContext + Constants.READ_ONLY_CONTEXT);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/public/notes.txt"))).toBe(false);
        });
    });
});

describe("ReadOnlyManagement - getNodeUri", () => {
    it.each([
        ["a data set", ds("/zosmf/IBMUSER.JCL"), Constants.DS_PDS_CONTEXT],
        ["a data set profile", ds("/zosmf"), Constants.DS_SESSION_CONTEXT + Constants.ACTIVE_CONTEXT],
        ["a USS directory", uss("/zosmf/z/ibmuser"), Constants.USS_DIR_CONTEXT],
        ["a USS file", uss("/zosmf/z/ibmuser/hello.txt"), Constants.USS_TEXT_FILE_CONTEXT],
    ])("returns the resource URI of %s", (_desc, uri, contextValue) => {
        expect(ReadOnlyManagement.getNodeUri(treeNode(uri, contextValue, { fullPath: "/somewhere/else" } as any))).toBe(uri);
    });

    it("returns the filtered directory of a USS profile", () => {
        const node = treeNode(uss("/zosmf"), Constants.USS_SESSION_CONTEXT + Constants.ACTIVE_CONTEXT, { fullPath: "/z/ibmuser" } as any);
        expect(ReadOnlyManagement.getNodeUri(node).toString()).toBe(uss("/zosmf/z/ibmuser").toString());
    });

    it.each([
        ["an empty", ""],
        ["an undefined", undefined],
        ["a root", "/"],
    ])("returns the profile root of a USS profile with %s full path", (_desc, fullPath) => {
        const node = treeNode(uss("/zosmf"), Constants.USS_SESSION_CONTEXT + Constants.ACTIVE_CONTEXT, { fullPath } as any);
        expect(ReadOnlyManagement.getNodeUri(node).path).toBe("/zosmf");
    });

    it("drops the query from a USS profile's URI", () => {
        const node = treeNode(uss("/zosmf").with({ query: "readonly=true" }), Constants.USS_SESSION_CONTEXT + Constants.ACTIVE_CONTEXT, {
            fullPath: "/z/ibmuser",
        } as any);
        expect(ReadOnlyManagement.getNodeUri(node).query).toBe("");
    });
});

describe("ReadOnlyManagement - negated rules", () => {
    beforeEach(() => {
        (ReadOnlyManagement as any).overrides.clear();
    });
    afterEach(() => {
        (ReadOnlyManagement as any).ruleCache = undefined;
        vi.restoreAllMocks();
    });

    describe("USS: everything read-only except some directories", () => {
        beforeEach(() => {
            useRules([{ uss: "/**" }, { uss: "!/z/ibmuser/**" }, { uss: "!/z/public/**" }, { uss: "!/tmp/**" }]);
        });

        it.each([
            ["/zosmf/z/ibmuser", false],
            ["/zosmf/z/ibmuser/hello.txt", false],
            ["/zosmf/z/ibmuser/cobol/hello.cbl", false],
            ["/zosmf/z/public", false],
            ["/zosmf/z/public/hello.txt", false],
            ["/zosmf/tmp/hello.txt", false],
            ["/zosmf/z", true],
            ["/zosmf/z/ibmuse8/hello.txt", true],
            ["/zosmf/z/ibmuser0/hello.txt", true],
            ["/zosmf/z/publicity/hello.txt", true],
            ["/zosmf/bin/sh", true],
            ["/zosmf/etc/profile", true],
            ["/zosmf/PROD/app/config.yaml", true],
            ["/zosmf/usr/lpp/java/JDK21/bin/java", true],
            ["/zosmf", true],
        ])("%s is read-only: %s", (path, expected) => {
            expect(ReadOnlyManagement.isReadOnly(uss(path))).toBe(expected);
        });

        it("does not affect data sets", () => {
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(false);
        });
    });

    describe("data sets: everything read-only except your own, apart from your load library", () => {
        beforeEach(() => {
            useRules([{ ds: "**" }, { ds: "!IBMUSER.**" }, { ds: "IBMUSER.LOADLIB" }]);
        });

        it.each([
            ["/zosmf/IBMUSER.JCL", false],
            ["/zosmf/IBMUSER.JCL/HELLO", false],
            ["/zosmf/IBMUSER.SOURCE.COBOL/HELLO", false],
            ["/zosmf/IBMUSER.LOADLIB", true],
            ["/zosmf/IBMUSER.LOADLIB/HELLO", true],
            ["/zosmf/IBMUSER.LOADLIB.BACKUP", true],
            ["/zosmf/IBMUSE8.JCL", true],
            ["/zosmf/ZXP.PUBLIC.JCL/README", true],
            ["/zosmf/SYS1.PROCLIB", true],
            ["/zosmf/CEE.SCEELKED", true],
            ["/zosmf", false],
        ])("%s is read-only: %s", (path, expected) => {
            expect(ReadOnlyManagement.isReadOnly(ds(path))).toBe(expected);
        });

        it("does not affect USS", () => {
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/bin/sh"))).toBe(false);
        });
    });

    describe("rule order", () => {
        it("lets a later rule make part of a negated match read-only again", () => {
            useRules([{ uss: "/**" }, { uss: "!/z/ibmuser/**" }, { uss: "/z/ibmuser/.ssh/**" }]);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/.ssh/authorized_keys"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
        });

        it("lets a later read-only rule cancel an earlier negated rule", () => {
            useRules([{ uss: "!/z/ibmuser/**" }, { uss: "/**" }]);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(true);
        });

        it("does nothing for a negated rule with no earlier read-only match", () => {
            useRules([{ uss: "!/z/ibmuser/**" }, { ds: "!IBMUSER.**" }]);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
        });

        it("lets a later profile-only rule make a whole profile read-only again", () => {
            useRules([{ ds: "**" }, { ds: "!IBMUSER.**" }, { profile: "zosmf" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/ssh/IBMUSER.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/ssh/ZXP.PUBLIC.JCL"))).toBe(true);
        });

        it("can be negated more than once with the last match winning", () => {
            useRules([{ ds: "ZXP.**" }, { ds: "!ZXP.PUBLIC.**" }, { ds: "ZXP.PUBLIC.JCL" }, { ds: "!ZXP.PUBLIC.JCL(README)" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PRIVATE.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.SOURCE/HELLO"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL/HELLO"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL/README"))).toBe(false);
        });
    });

    describe("wildcards and members", () => {
        it.each([
            [[{ uss: "/z/ibmuser/**" }, { uss: "!/z/ibmuser/**/*.txt" }], "/zosmf/z/ibmuser/notes/todo.txt", false],
            [[{ uss: "/z/ibmuser/**" }, { uss: "!/z/ibmuser/**/*.txt" }], "/zosmf/z/ibmuser/hello.cbl", true],
            [[{ uss: "/z/*/**" }, { uss: "!/z/ibmuse?/**" }], "/zosmf/z/ibmuser/hello.txt", false],
            [[{ uss: "/z/*/**" }, { uss: "!/z/ibmuse?/**" }], "/zosmf/z/public/hello.txt", true],
            [[{ uss: "/etc/**" }, { uss: "!/etc/profile" }], "/zosmf/etc/profile", false],
            [[{ uss: "/etc/**" }, { uss: "!/etc/profile" }], "/zosmf/etc/ssh/sshd_config", true],
        ])("USS rules %j make %s read-only: %s", (rules, path, expected) => {
            useRules(rules);
            expect(ReadOnlyManagement.isReadOnly(uss(path))).toBe(expected);
        });

        it.each([
            [[{ ds: "%%%PR*" }, { ds: "!NDRPR.TEST.**" }], "/zosmf/NDRPR.TEST.COBOL", false],
            [[{ ds: "%%%PR*" }, { ds: "!NDRPR.TEST.**" }], "/zosmf/NDRPR.SRC.COBOL", true],
            [[{ ds: "%%%PR*" }, { ds: "!NDRPR.TEST.**" }], "/zosmf/NXTPR.TEST.COBOL", true],
            [[{ ds: "ZXP.PUBLIC.JCL" }, { ds: "!ZXP.PUBLIC.JCL(README)" }], "/zosmf/ZXP.PUBLIC.JCL/README", false],
            [[{ ds: "ZXP.PUBLIC.JCL" }, { ds: "!ZXP.PUBLIC.JCL(README)" }], "/zosmf/ZXP.PUBLIC.JCL/HELLO", true],
            [[{ ds: "ZXP.PUBLIC.JCL" }, { ds: "!ZXP.PUBLIC.JCL(README)" }], "/zosmf/ZXP.PUBLIC.JCL", true],
            [[{ ds: "IBMUSER.JCL(PROD*)" }, { ds: "!IBMUSER.**" }], "/zosmf/IBMUSER.JCL/PRODJOB", false],
            [[{ ds: "IBMUSER.**" }, { ds: "!IBMUSER.JCL(*)" }], "/zosmf/IBMUSER.JCL/HELLO", false],
            [[{ ds: "IBMUSER.**" }, { ds: "!IBMUSER.JCL(*)" }], "/zosmf/IBMUSER.JCL", true],
            [[{ ds: "IBMUSER.**" }, { ds: "!IBMUSER.JCL(*)" }], "/zosmf/IBMUSER.SOURCE/HELLO", true],
        ])("data set rules %j make %s read-only: %s", (rules, path, expected) => {
            useRules(rules);
            expect(ReadOnlyManagement.isReadOnly(ds(path))).toBe(expected);
        });

        it("ignores the file extension added to member URIs", () => {
            useRules([{ ds: "ZXP.**" }, { ds: "!ZXP.PUBLIC.CBL(HELLO)" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.CBL/HELLO.cbl"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.CBL/GOODBYE.cbl"))).toBe(true);
        });
    });

    describe("profiles", () => {
        it("makes everything in a profile read-only except your own data sets and home directory", () => {
            useRules([{ profile: "zosmf" }, { profile: "zosmf", ds: "!IBMUSER.**", uss: "!/z/ibmuser/**" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/bin/sh"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/ssh/ZXP.PUBLIC.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/ssh/bin/sh"))).toBe(false);
        });

        it("only applies a profile-scoped negated rule to that profile", () => {
            useRules([{ ds: "ZXP.**" }, { profile: "ssh", ds: "!ZXP.PUBLIC.**" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/ssh/ZXP.PUBLIC.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/ssh/ZXP.PRIVATE.JCL"))).toBe(true);
        });

        it("can make a profile-only rule's profile writable again for some data sets", () => {
            useRules([{ profile: "zosmf_prod" }, { ds: "!IBMUSER.**" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf_prod/IBMUSER.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf_prod/ZXP.PUBLIC.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf_prod/z/ibmuser/hello.txt"))).toBe(true);
        });
    });

    describe("rules with both a data set pattern and a USS glob", () => {
        it("negates both when both start with !", () => {
            useRules([
                { ds: "**", uss: "/**" },
                { ds: "!IBMUSER.**", uss: "!/z/ibmuser/**" },
            ]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/bin/sh"))).toBe(true);
        });

        it("negates each field separately", () => {
            useRules([
                { ds: "**", uss: "/**" },
                { ds: "!IBMUSER.**", uss: "/z/ibmuser/.ssh/**" },
            ]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/.ssh/id_rsa"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/public/hello.txt"))).toBe(true);
        });

        it("does not let a negated USS glob affect data sets or a negated data set pattern affect USS", () => {
            useRules([{ ds: "**", uss: "/**" }, { uss: "!/**" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);

            useRules([{ ds: "**", uss: "/**" }, { ds: "!**" }]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(true);
        });
    });

    describe("malformed negated rules", () => {
        it("ignores whitespace around and after the !", () => {
            useRules([{ uss: " /** " }, { uss: " ! /z/ibmuser/** " }, { ds: " ** " }, { ds: "  !  IBMUSER.** " }]);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL"))).toBe(true);
        });

        it.each([["!"], ["!  "], [""], ["   "]])("ignores a rule whose pattern is only %j", (value) => {
            useRules([{ uss: "/**", ds: "**" }, { uss: value }, { ds: value }]);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(true);
        });

        it("does not treat a profile rule with an empty negated pattern as a profile-only rule", () => {
            useRules([
                { profile: "zosmf", ds: "!" },
                { profile: "zosmf", uss: "" },
            ]);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf"))).toBe(false);
        });

        it("only removes the first ! so !! is not a double negation", () => {
            useRules([{ uss: "/**" }, { uss: "!!/z/ibmuser/**" }, { ds: "**" }, { ds: "!!IBMUSER.**" }]);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(true);
        });

        it("ignores rule values that are not strings", () => {
            useRules([{ uss: "/**" }, { uss: 123 }, { ds: ["IBMUSER.**"] }]);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL"))).toBe(false);
        });
    });

    describe("precedence over negated rules", () => {
        beforeEach(() => {
            useRules([{ uss: "/**" }, { uss: "!/z/ibmuser/**" }]);
        });

        it("still lets an override make a negated path read-only", () => {
            ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser/cobol"), true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/cobol/hello.cbl"))).toBe(true);
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(false);
        });

        it("still makes a readonly=true link read-only", () => {
            expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt", "readonly=true"))).toBe(true);
        });
    });
});

describe("ReadOnlyManagement - throwIfReadOnly", () => {
    beforeEach(resetState);
    afterEach(() => {
        (ReadOnlyManagement as any).ruleCache = undefined;
        vi.restoreAllMocks();
    });

    const expectReadOnlyError = (fn: () => void, name: string): void => {
        const noPermissionsSpy = vi.spyOn(vscode.FileSystemError, "NoPermissions");
        expect(fn).toThrow();
        expect(noPermissionsSpy).toHaveBeenCalledWith(`${name} is read-only.`);
        noPermissionsSpy.mockRestore();
    };

    it.each([
        ["a member", ds("/zosmf/ZXP.PUBLIC.JCL/README"), "ZXP.PUBLIC.JCL(README)"],
        ["a member URI with an extension", ds("/zosmf/ZXP.PUBLIC.CBL/HELLO.cbl"), "ZXP.PUBLIC.CBL(HELLO)"],
        ["a data set", ds("/zosmf/SYS1.PROCLIB"), "SYS1.PROCLIB"],
        ["a USS file", uss("/zosmf/etc/profile"), "/etc/profile"],
        ["a USS directory", uss("/zosmf/PROD/app"), "/PROD/app"],
        ["a data set profile", ds("/zosmf_prod"), "zosmf_prod"],
    ])("throws a NoPermissions error naming %s", (_desc, uri, name) => {
        expectReadOnlyError(() => ReadOnlyManagement.throwIfReadOnly(uri), name);
    });

    it("does not throw for a writable resource", () => {
        expect(() => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"))).not.toThrow();
        expect(() => ReadOnlyManagement.throwIfReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).not.toThrow();
    });

    it("gives the link error for a readonly=true URI", () => {
        expect(() => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO", "readonly=true"))).toThrow(
            "HELLO was opened in read-only mode and cannot be modified."
        );
    });

    it("does not throw for URIs outside the data set and USS file systems", () => {
        useRules([{ ds: "**", uss: "/**" }]);
        expect(() => ReadOnlyManagement.throwIfReadOnly(vscode.Uri.file("/etc/profile"), { checkParent: true })).not.toThrow();
        expect(() =>
            ReadOnlyManagement.throwIfReadOnly(vscode.Uri.from({ scheme: ZoweScheme.Jobs, path: "/zosmf/JOB01234" }), { checkParent: true })
        ).not.toThrow();
        expect(() => ReadOnlyManagement.throwIfReadOnly(undefined as any)).not.toThrow();
    });

    describe("checkParent", () => {
        it("throws for a writable member in a read-only PDS, naming the PDS", () => {
            useRules([{ ds: "ZXP.PUBLIC.JCL" }, { ds: "!ZXP.PUBLIC.JCL(README)" }]);
            expect(() => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL/README"))).not.toThrow();
            expectReadOnlyError(
                () => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL/README"), { checkParent: true }),
                "ZXP.PUBLIC.JCL"
            );
        });

        it("throws for a new member in a read-only PDS", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/NEWJOB"), false);
            expectReadOnlyError(() => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/IBMUSER.JCL/NEWJOB"), { checkParent: true }), "IBMUSER.JCL");
        });

        it("throws for a new file in a read-only directory, naming the directory", () => {
            useRules([{ uss: "/PROD" }]);
            expect(() => ReadOnlyManagement.throwIfReadOnly(uss("/zosmf/PROD/new.txt"))).not.toThrow();
            expectReadOnlyError(() => ReadOnlyManagement.throwIfReadOnly(uss("/zosmf/PROD/new.txt"), { checkParent: true }), "/PROD");
        });

        it("names the parent when both the resource and its parent are read-only", () => {
            expectReadOnlyError(
                () => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL/README"), { checkParent: true }),
                "ZXP.PUBLIC.JCL"
            );
            expectReadOnlyError(() => ReadOnlyManagement.throwIfReadOnly(uss("/zosmf/etc/new.conf"), { checkParent: true }), "/etc");
        });

        it("names the resource itself when only checking it", () => {
            expectReadOnlyError(() => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/ZXP.PUBLIC.JCL/README")), "ZXP.PUBLIC.JCL(README)");
        });

        it("checks the profile for a data set", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.NEW.JCL"), false);
            expectReadOnlyError(() => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/IBMUSER.NEW.JCL"), { checkParent: true }), "zosmf");
        });

        it("does not throw when the resource and its parent are writable", () => {
            expect(() => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/IBMUSER.JCL/NEWJOB"), { checkParent: true })).not.toThrow();
            expect(() => ReadOnlyManagement.throwIfReadOnly(uss("/zosmf/z/ibmuser/new.txt"), { checkParent: true })).not.toThrow();
            expect(() => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf/IBMUSER.NEW.JCL"), { checkParent: true })).not.toThrow();
        });

        it("only checks the resource itself for a profile", () => {
            expect(() => ReadOnlyManagement.throwIfReadOnly(ds("/zosmf"), { checkParent: true })).not.toThrow();
        });

        it("ignores the query of the resource when checking its parent", () => {
            useRules([{ uss: "/z/ibmuser" }]);
            expectReadOnlyError(
                () => ReadOnlyManagement.throwIfReadOnly(uss("/zosmf/z/ibmuser/new.txt", "fetch=true"), { checkParent: true }),
                "/z/ibmuser"
            );
        });
    });
});

describe("ReadOnlyManagement - showErrorIfReadOnly", () => {
    beforeEach(resetState);
    afterEach(() => {
        (ReadOnlyManagement as any).ruleCache = undefined;
        vi.restoreAllMocks();
    });

    it("shows the error and returns true for a read-only resource", async () => {
        const errorMessageSpy = vi.spyOn(Gui, "errorMessage").mockResolvedValue(undefined);
        await expect(ReadOnlyManagement.showErrorIfReadOnly(uss("/zosmf/bin/sh"))).resolves.toBe(true);
        expect(errorMessageSpy).toHaveBeenCalledWith("/bin/sh is read-only.");
    });

    it("checks the parent when asked to", async () => {
        const errorMessageSpy = vi.spyOn(Gui, "errorMessage").mockResolvedValue(undefined);
        useRules([{ uss: "/PROD" }]);
        await expect(ReadOnlyManagement.showErrorIfReadOnly(uss("/zosmf/PROD/new.txt"))).resolves.toBe(false);
        await expect(ReadOnlyManagement.showErrorIfReadOnly(uss("/zosmf/PROD/new.txt"), { checkParent: true })).resolves.toBe(true);
        expect(errorMessageSpy).toHaveBeenCalledTimes(1);
        expect(errorMessageSpy).toHaveBeenCalledWith("/PROD is read-only.");
    });

    it("returns false without showing an error for a writable resource", async () => {
        const errorMessageSpy = vi.spyOn(Gui, "errorMessage").mockResolvedValue(undefined);
        await expect(ReadOnlyManagement.showErrorIfReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"), { checkParent: true })).resolves.toBe(false);
        expect(errorMessageSpy).not.toHaveBeenCalled();
    });
});

describe("ReadOnlyManagement - throwIfCannotRename", () => {
    beforeEach(resetState);
    afterEach(() => {
        (ReadOnlyManagement as any).ruleCache = undefined;
        (ReadOnlyManagement as any).overrides.clear();
        vi.restoreAllMocks();
    });

    const expectRenameError = (oldUri: vscode.Uri, newUri: vscode.Uri, name: string): void => {
        const noPermissionsSpy = vi.spyOn(vscode.FileSystemError, "NoPermissions");
        expect(() => ReadOnlyManagement.throwIfCannotRename(oldUri, newUri)).toThrow();
        expect(noPermissionsSpy).toHaveBeenCalledWith(`${name} is read-only.`);
        noPermissionsSpy.mockRestore();
    };

    describe("data sets", () => {
        it("allows renaming a writable data set or member to a writable name", () => {
            expect(() => ReadOnlyManagement.throwIfCannotRename(ds("/zosmf/IBMUSER.JCL"), ds("/zosmf/IBMUSER.JCL.OLD"))).not.toThrow();
            expect(() => ReadOnlyManagement.throwIfCannotRename(ds("/zosmf/IBMUSER.JCL/HELLO"), ds("/zosmf/IBMUSER.JCL/GOODBYE"))).not.toThrow();
        });

        it("rejects renaming a read-only data set or member", () => {
            expectRenameError(ds("/zosmf/ZXP.PUBLIC.JCL"), ds("/zosmf/ZXP.PUBLIC.JCL2"), "ZXP.PUBLIC.JCL");
            expectRenameError(ds("/zosmf/ZXP.PUBLIC.JCL/README"), ds("/zosmf/ZXP.PUBLIC.JCL/README2"), "ZXP.PUBLIC.JCL(README)");
        });

        it("rejects renaming a data set to a read-only name", () => {
            expectRenameError(ds("/zosmf/IBMUSER.TEMP"), ds("/zosmf/ZXP.TEMP"), "ZXP.TEMP");
        });

        it("rejects renaming a member to a name a member rule makes read-only", () => {
            expectRenameError(ds("/zosmf/IBMUSER.JCL/HELLO"), ds("/zosmf/IBMUSER.JCL/PRODJOB"), "IBMUSER.JCL(PRODJOB)");
        });

        it("allows renaming a member made writable in a read-only PDS", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.CBL"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.CBL/BLAH"), false);
            expect(() => ReadOnlyManagement.throwIfCannotRename(ds("/zosmf/IBMUSER.CBL/BLAH"), ds("/zosmf/IBMUSER.CBL/BLAH2"))).not.toThrow();
        });

        it("allows renaming a member made writable even when its new name matches a member rule", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"), false);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"), false);
            expect(() => ReadOnlyManagement.throwIfCannotRename(ds("/zosmf/IBMUSER.JCL/HELLO"), ds("/zosmf/IBMUSER.JCL/PRODJOB"))).not.toThrow();
        });

        it("rejects renaming a member made writable by a negated rule, since its new name is not covered by the rule", () => {
            useRules([{ ds: "IBMUSER.CBL" }, { ds: "!IBMUSER.CBL(BLAH)" }]);
            expectRenameError(ds("/zosmf/IBMUSER.CBL/BLAH"), ds("/zosmf/IBMUSER.CBL/BLAH2"), "IBMUSER.CBL(BLAH2)");
        });

        it("checks the new location like creating a member when it moves to another PDS", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.CBL"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.CBL/BLAH"), false);
            expectRenameError(ds("/zosmf/IBMUSER.CBL/BLAH"), ds("/zosmf/ZXP.PUBLIC.JCL/BLAH"), "ZXP.PUBLIC.JCL");
        });

        it("ignores member extensions when comparing parents", () => {
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.CBL"), true);
            ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.CBL/BLAH"), false);
            expect(() => ReadOnlyManagement.throwIfCannotRename(ds("/zosmf/IBMUSER.CBL/BLAH.cbl"), ds("/zosmf/IBMUSER.CBL/BLAH2.cbl"))).not.toThrow();
        });

        it("gives the link error for a data set opened from a readonly=true link", () => {
            expect(() =>
                ReadOnlyManagement.throwIfCannotRename(ds("/zosmf/IBMUSER.JCL/HELLO", "readonly=true"), ds("/zosmf/IBMUSER.JCL/GOODBYE"))
            ).toThrow("HELLO was opened in read-only mode and cannot be modified.");
        });
    });

    describe("USS", () => {
        it("allows renaming a file made writable in a read-only directory", () => {
            useRules([{ uss: "/z/ibmuser/cobol/**" }]);
            ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser/cobol/scratch.cbl"), false);
            expect(() =>
                ReadOnlyManagement.throwIfCannotRename(uss("/zosmf/z/ibmuser/cobol/scratch.cbl"), uss("/zosmf/z/ibmuser/cobol/scratch2.cbl"))
            ).not.toThrow();
        });

        it("rejects renaming a file that inherits read-only from its directory", () => {
            expectRenameError(uss("/zosmf/etc/profile"), uss("/zosmf/etc/profile.bak"), "/etc/profile");
        });

        it("rejects renaming a writable directory to a read-only path", () => {
            useRules([{ uss: "/z/ibmuser/archive/**" }]);
            expectRenameError(uss("/zosmf/z/ibmuser/old"), uss("/zosmf/z/ibmuser/archive"), "/z/ibmuser/archive");
        });

        it("checks the new location like creating a file when it moves to another directory", () => {
            expectRenameError(uss("/zosmf/z/ibmuser/hello.txt"), uss("/zosmf/etc/hello.txt"), "/etc");
        });
    });

    it("does nothing for URIs outside the data set and USS file systems", () => {
        useRules([{ ds: "**", uss: "/**" }]);
        expect(() => ReadOnlyManagement.throwIfCannotRename(vscode.Uri.file("/etc/profile"), vscode.Uri.file("/etc/profile.bak"))).not.toThrow();
        expect(() => ReadOnlyManagement.throwIfCannotRename(undefined as any, undefined as any)).not.toThrow();
    });
});

describe("ReadOnlyManagement - moveOverrides and removeOverrides", () => {
    beforeEach(resetState);
    afterEach(() => {
        (ReadOnlyManagement as any).ruleCache = undefined;
        (ReadOnlyManagement as any).overrides.clear();
        vi.restoreAllMocks();
    });

    it("moves an override to the renamed member", () => {
        ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.CBL"), true);
        ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.CBL/BLAH"), false);
        ReadOnlyManagement.moveOverrides(ds("/zosmf/IBMUSER.CBL/BLAH"), ds("/zosmf/IBMUSER.CBL/BLAH2"));
        expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.CBL/BLAH2"))).toBe(false);
        expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.CBL/BLAH"))).toBe(true);
    });

    it("moves the overrides on a renamed directory and everything in it", () => {
        ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser/cobol"), true);
        ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser/cobol/scratch.cbl"), false);
        ReadOnlyManagement.moveOverrides(uss("/zosmf/z/ibmuser/cobol"), uss("/zosmf/z/ibmuser/src"));
        expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/src/hello.cbl"))).toBe(true);
        expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/src/scratch.cbl"))).toBe(false);
        expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/cobol/hello.cbl"))).toBe(false);
    });

    it("does not move overrides on resources that only share a prefix", () => {
        ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL.BACKUP"), true);
        ReadOnlyManagement.moveOverrides(ds("/zosmf/IBMUSER.JCL"), ds("/zosmf/IBMUSER.JCL2"));
        expect(ReadOnlyManagement.isReadOnly(ds("/zosmf/IBMUSER.JCL.BACKUP"))).toBe(true);
    });

    it("fires onDidChange only when an override was moved", () => {
        const listener = vi.fn();
        const subscription = ReadOnlyManagement.onDidChange(listener);
        ReadOnlyManagement.moveOverrides(ds("/zosmf/IBMUSER.JCL/HELLO"), ds("/zosmf/IBMUSER.JCL/GOODBYE"));
        expect(listener).not.toHaveBeenCalled();
        ReadOnlyManagement.setReadOnly(ds("/zosmf/IBMUSER.JCL/HELLO"), true);
        listener.mockClear();
        ReadOnlyManagement.moveOverrides(ds("/zosmf/IBMUSER.JCL/HELLO"), ds("/zosmf/IBMUSER.JCL/GOODBYE"));
        expect(listener).toHaveBeenCalledTimes(1);
        subscription.dispose();
    });

    it("removes the overrides on a deleted resource and everything in it", () => {
        ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser/cobol"), true);
        ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser/cobol/scratch.cbl"), false);
        ReadOnlyManagement.setReadOnly(uss("/zosmf/z/ibmuser/hello.txt"), true);
        ReadOnlyManagement.removeOverrides(uss("/zosmf/z/ibmuser/cobol"));
        expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/cobol/hello.cbl"))).toBe(false);
        expect(ReadOnlyManagement.isReadOnly(uss("/zosmf/z/ibmuser/hello.txt"))).toBe(true);
    });

    it("ignores URIs outside the data set and USS file systems", () => {
        expect(() => ReadOnlyManagement.moveOverrides(vscode.Uri.file("/a"), vscode.Uri.file("/b"))).not.toThrow();
        expect(() => ReadOnlyManagement.removeOverrides(undefined as any)).not.toThrow();
    });
});
