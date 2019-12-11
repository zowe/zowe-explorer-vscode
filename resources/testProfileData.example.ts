import { IProfile } from "@brightside/imperative";

export const profile: IProfile = {
    type : "zosmf",
    host: "192.86.32.67",
    port: 10443,
    user: "Z40642",
    password: "zowe13",
    rejectUnauthorized: false,
    name: "zTrial" // @NOTE: This profile name must match an existing zowe profile in the ~/.zowe/profiles/zosmf folder
};

export const normalPattern = "zTrial";
export const orPattern = "";
export const ussPattern = "/u/z40642/temp";  // @NOTE: This directory will be created and deleted
