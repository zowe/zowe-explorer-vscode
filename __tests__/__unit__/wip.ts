    describe("Add Session Unit Test", () => {
        const qpItem: vscode.QuickPickItem = new utils.FilterDescriptor("\uFF0B " + "Create a new filter");

        beforeEach(() => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [profileOne, {name: "secondName"}],
                        defaultProfile: profileOne,
                        validProfile: ValidProfileEnum.VALID,
                        checkCurrentProfile: jest.fn(),
                        createNewConnection: jest.fn(()=>{
                            return {newprofile: "fake"};
                        }),
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });
            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(qpItem)
            );
        });

        afterEach(() => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
        });

        it("Testing that addSession will cancel if there is no profile name", async () => {
            const entered = undefined;
            showInputBox.mockResolvedValueOnce(entered);

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testTree);
            expect(showInformationMessage.mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");
        });

        it("Testing that addSession with supplied profile name", async () => {
            const entered = undefined;
            const addSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            showInputBox.mockReturnValueOnce("fake");
            await extension.createZoweSession(testTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });

        it("Testing that addSession with existing profile", async () => {
            const entered = "";
            const addSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: "firstName",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.createZoweSession(testTree);
            expect(extension.createZoweSession).toHaveBeenCalled();
        });

        it("Testing that addSession with supplied resolveQuickPickHelper", async () => {
            const entered = "fake";
            const addSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });

        it("Testing that addSession with undefined profile", async () => {
            const entered = "";
            const addSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: undefined,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.createZoweSession(testTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });


        it("Testing that addSession if createNewConnection is invalid", async () => {
            const entered = "fake";
            const addSession = jest.spyOn(extension, "createZoweSession");

            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });

        it("Testing that addSession if listProfile is invalid", async () => {
            const entered = "fake";
            const addSession = jest.spyOn(extension, "createZoweSession");

            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        createNewConnection: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });
    });

    it("Test Get Profile", async () => {
        const ProfNode = new ZoweDatasetNode("[sestest1,sestest2]", vscode.TreeItemCollapsibleState.Expanded, null, session);
        await ProfNode.getProfile();
        expect(ProfNode).not.toBeUndefined();
    });

        describe("Add USS Session Unit Test", () => {
        const qpItem: vscode.QuickPickItem = new utils.FilterDescriptor("\uFF0B " + "Create a new filter");

        beforeEach(() => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        createNewConnection: jest.fn(()=>{
                            return {newprofile: "fake"};
                        }),
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });
            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(qpItem)
            );
        });

        afterEach(() => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
        });

        it("Testing that createZoweSession will cancel if there is no profile name", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
            const entered = undefined;
            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testTree);
            expect(showInformationMessage.mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");
        });

        it("Testing that createZoweSession with supplied profile name", async () => {
            const entered = undefined;
            const createZoweSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            showInputBox.mockReturnValueOnce("fake");
            await extension.createZoweSession(testUSSTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });

        it("Testing that createZoweSession with theia", async () => {
            const entered = "";
            const createZoweSession = jest.spyOn(extension, "createZoweSession");
            Object.defineProperty(globals, "ISTHEIA", { get: () => true });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: "firstName",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.createZoweSession(testUSSTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

            Object.defineProperty(globals, "ISTHEIA", { get: () => false });
        });

        it("Testing that createZoweSession with theia fails if no choice", async () => {
            const entered = null;
            const createZoweSession = jest.spyOn(extension, "createZoweSession");
            Object.defineProperty(globals, "ISTHEIA", { get: () => true });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [],
                ignoreFocusOut: true,
                items: [],
                value: null,
                label: "firstName",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.createZoweSession(testUSSTree);
            expect(extension.createZoweSession).toHaveBeenCalled();
            expect(showInformationMessage).toHaveBeenCalled();

            Object.defineProperty(globals, "ISTHEIA", { get: () => false });
        });

        it("Testing that createZoweSession with existing profile", async () => {
            const entered = "";
            const createZoweSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: "firstName",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.createZoweSession(testUSSTree);
            expect(extension.createZoweSession).toHaveBeenCalled();
        });

        it("Testing that createZoweSession with supplied resolveQuickPickHelper", async () => {
            const entered = "fake";
            const createZoweSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testUSSTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });

        it("Testing that createZoweSession with undefined profile", async () => {
            const entered = "";
            const createZoweSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: undefined,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.createZoweSession(testUSSTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });


        it("Testing that createZoweSession if createNewConnection is invalid", async () => {
            const entered = "fake";
            const createZoweSession = jest.spyOn(extension, "createZoweSession");

            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testUSSTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });

        it("Testing that createZoweSession if listProfile is invalid", async () => {
            const entered = "fake";
            const createZoweSession = jest.spyOn(extension, "createZoweSession");

            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        createNewConnection: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testUSSTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });
    });

            it("Testing that addJobsSession will cancel if there is no profile name", async () => {
            const entered = undefined;

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testJobsTree);
            expect(showInformationMessage.mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");
        });

        it("Testing that addJobsSession with supplied profile name", async () => {
            const entered = undefined;
            const addJobsSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            showInputBox.mockReturnValueOnce("fake");
            await extension.createZoweSession(testJobsTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });

        it("Testing that addJobsSession with existing profile", async () => {
            const entered = "";
            const addJobsSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: "firstName",
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.createZoweSession(testJobsTree);
            expect(extension.createZoweSession).toHaveBeenCalled();
        });

        it("Testing that addJobsSession with supplied resolveQuickPickHelper", async () => {
            const entered = "fake";
            const addJobsSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testJobsTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });

        it("Testing that addJobsSession with undefined profile", async () => {
            const entered = "";
            const addJobsSession = jest.spyOn(extension, "createZoweSession");

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                label: undefined,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            const resolveQuickPickHelper = jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
                () => Promise.resolve(createQuickPick())
            );

            await extension.createZoweSession(testJobsTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });


        it("Testing that addJobsSession if createNewConnection is invalid", async () => {
            const entered = "fake";
            const addJobsSession = jest.spyOn(extension, "createZoweSession");

            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testJobsTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });

        it("Testing that addJobsSession if listProfile is invalid", async () => {
            const entered = "fake";
            const addJobsSession = jest.spyOn(extension, "createZoweSession");

            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        createNewConnection: jest.fn(()=>{
                            return {};
                        }),
                        loadNamedProfile: mockLoadNamedProfile
                    };
                })
            });

            // Assert edge condition user cancels the input path box
            createQuickPick.mockReturnValue({
                placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
                activeItems: [qpItem],
                ignoreFocusOut: true,
                items: [qpItem],
                value: entered,
                show: jest.fn(()=>{
                    return {};
                }),
                hide: jest.fn(()=>{
                    return {};
                }),
                onDidAccept: jest.fn(()=>{
                    return {};
                })
            });

            await extension.createZoweSession(testJobsTree);
            expect(extension.createZoweSession).toHaveBeenCalled();

        });
    });