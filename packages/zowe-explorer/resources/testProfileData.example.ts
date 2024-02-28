import { imperative } from "@zowe/zowe-explorer-api";

export const profile: imperative.IProfile = {
    type: "zosmf",
    host: "",
    port: 0,
    user: "",
    password: "",
    rejectUnauthorized: false,
    name: "", // @NOTE: This profile name must match an existing zowe profile in the ~/.zowe/profiles/zosmf folder
};

export const tsoProfile = "myTsoProfile"; // @NOTE: TSO profile name must match an existing tso profile with account number for TSO session
export const normalPattern = "";
export const orPattern = "";
export const ussPattern = "/u/myhlq/temp1"; // @NOTE: This directory will be created and deleted
