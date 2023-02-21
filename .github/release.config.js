module.exports = {
    branches: [
        {
            name: "main",
            channel: "latest",
            level: "minor",
        },
        {
            name: "maintenance",
            channel: "latest",
            level: "patch",
        },
        {
            name: "v1-lts",
            channel: "zowe-v1-lts",
            level: "patch",
        },
        // {
        //     name: "next",
        //     prerelease: true,
        // }
    ],
    plugins: [
        [
            "@octorelease/changelog",
            {
                displayNames: {
                    "zowe-explorer": "Zowe Explorer",
                    "zowe-explorer-ftp-extension": "Zowe Explorer Extension for FTP",
                    "zowe-explorer-api": "Zowe Explorer APIs",
                },
                headerLine: "## TBD Release",
            },
        ],
        [
            "@octorelease/lerna",
            {
                // Use Lerna only for versioning and publish packages independently
                npmPublish: false,
            },
        ],
        [
            "@octorelease/npm",
            {
                $cwd: "packages/zowe-explorer-api",
                aliasTags: {
                    "latest": ["zowe-v2-lts"],
                },
                npmPublish: true,
                tarballDir: "dist",
            },
        ],
        [
            "@octorelease/vsce",
            {
                $cwd: "packages/zowe-explorer",
                ovsxPublish: true,
                vscePublish: true,
                vsixDir: "dist",
            },
            {
                $cwd: "packages/zowe-explorer-ftp-extension",
                ovsxPublish: true,
                vscePublish: true,
                vsixDir: "dist",
            },
        ],
        [
            "@octorelease/github",
            {
                assets: ["dist/*.tgz", "dist/*.vsix"],
                draftRelease: true,
            },
        ],
        "@octorelease/git",
    ],
};
