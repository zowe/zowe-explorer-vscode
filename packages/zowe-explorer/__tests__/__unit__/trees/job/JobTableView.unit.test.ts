import { JobTableView } from "../../../../src/trees/job/JobTableView";
import { createJobNode, createJobSessionNode } from "../../../__mocks__/mockCreators/jobs";
import { createIProfile, createISession } from "../../../__mocks__/mockCreators/shared";

describe("JobTableView unit tests", () => {
    function getBlockMocks() {
        const sessionNode = createJobSessionNode(createISession(), createIProfile());
        const jobNode = createJobNode(sessionNode, sessionNode.getProfile());

        sessionNode.children = [jobNode];
        return {
            jobNode,
            sessionNode,
        };
    }
    describe("buildTitle", () => {
        it("adjusts the title for searching by ID", async () => {
            const blockMocks = getBlockMocks();
            blockMocks.jobNode.searchId = "TSID1234";
            expect(await (JobTableView as any).buildTitle(blockMocks.jobNode)).toBe("Jobs with ID: TSID1234");
        });
        it("adjusts the title for searching by owner, prefix and status", async () => {
            const blockMocks = getBlockMocks();
            blockMocks.jobNode.owner = "OWNER000";
            blockMocks.jobNode.status = "ACTIVE";
            blockMocks.jobNode.prefix = "JOB*";
            expect(await (JobTableView as any).buildTitle(blockMocks.jobNode)).toBe("Jobs: OWNER000 | JOB* | ACTIVE");
        });

        it("returns a generic title if none of the above properties are supplied", async () => {
            const blockMocks = getBlockMocks();
            expect(await (JobTableView as any).buildTitle(blockMocks.jobNode)).toBe("Jobs");
        });
    });

    describe("cacheChildren", () => {
        it("calls getChildren to retrieve the session node's children", async () => {
            const blockMocks = getBlockMocks();
            await expect((JobTableView as any).cacheChildren(blockMocks.sessionNode)).resolves.toStrictEqual(blockMocks.sessionNode.children);
        });
    });
});
