import { IProfile } from "@zowe/imperative";

export const profile: IProfile = {
    type: "zosmf",
    host: "tvt4119.svl.ibm.com",
    port: 443,
    user: "zoweph",
    password: "wazi4me",
    rejectUnauthorized: false,
    name: "tvt4119zosmf", // @NOTE: This profile name must match an existing zowe profile in the ~/.zowe/profiles/zosmf folder
};

export const normalPattern = "ZOWEPH";
export const orPattern = "ZOWEPH";
export const ussPattern = "/u/zoweph/temp1"; // @NOTE: This directory will be created and deleted
