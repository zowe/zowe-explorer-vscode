import { IProfile } from "@brightside/imperative";

export const profile: IProfile = {
    type : "zosmf",
    host: "",
    port: 0,
    user: "",
    pass: "",
    rejectUnauthorized: false,
    name: "" // @NOTE: This profile name must match an existing zowe profile in the ~/.zowe/profiles/zosmf folder
};

export const normalPattern = "";
export const orPattern = "";
