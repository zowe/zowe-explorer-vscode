import { TreeViewUtils } from "../../../src/utils/TreeViewUtils";
import * as globals from "../../../src/globals";

describe("TreeViewUtils Unit Tests", () => {
    it("refreshIconOnCollapse - generated listener function works as intended", () => {
        const testTreeProvider = { mOnDidChangeTreeData: { fire: jest.fn() } } as any;
        const listenerFn = TreeViewUtils.refreshIconOnCollapse(
            [(node): boolean => (node.contextValue as any).includes(globals.DS_PDS_CONTEXT) as boolean],
            testTreeProvider
        );
        const element = { label: "somenode", contextValue: globals.DS_PDS_CONTEXT } as any;
        listenerFn({ element });
        expect(testTreeProvider.mOnDidChangeTreeData.fire).toHaveBeenCalledWith(element);
    });
});
