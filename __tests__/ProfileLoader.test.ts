/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

jest.mock("child_process");
import * as child_process from "child_process";

import { loadNamedProfile, loadAllProfiles, loadDefaultProfile } from "../src/ProfileLoader";


describe("ProfileLoader", ()=>{

    const profileOne = {name: "profile1", profile: {}, type: "zosmf"};
    const profileTwo = {name: "profile2", profile: {}, type: "zosmf"};

    (child_process.spawnSync as any) = jest.fn((program: string, args: string[], options: any)=>{
        
        const createFakeChildProcess =(status: number, stdout:string, stderr: string) =>{
            return {
                status,
                stdout: {
                    toString : jest.fn(()=>{ 
                        return stdout;
                    })
                },
                stderr: {
                    toString : jest.fn(()=>{ 
                        return stderr;
                    })
                },
            };
        };

        if (args[0].indexOf("getAllProfiles") >=0){
            return createFakeChildProcess(0, JSON.stringify([profileOne, profileTwo]), "");
        } else {
            // load default profile            
            return createFakeChildProcess(0, JSON.stringify(profileOne), "");
        }
    })

    it("should return a named profile", ()=>{

       const loadedProfile = loadNamedProfile("profile1");
       expect(loadedProfile).toEqual(profileOne);
    });

    it ("should return all profiles ", ()=>{
        const loadedProfiles = loadAllProfiles();
        expect(loadedProfiles).toEqual([profileOne, profileTwo]);
    });

    it("should return a default profile", ()=>{

        const loadedProfile = loadDefaultProfile();
        expect(loadedProfile).toEqual(profileOne);
     });
});