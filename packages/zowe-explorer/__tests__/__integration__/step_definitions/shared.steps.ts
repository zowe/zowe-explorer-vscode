import { ViewSection } from "wdio-vscode-service";

/* Helper functions */
export async function paneDivForTree(tree: string): Promise<ViewSection> {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    await activityBar.wait();
    const zeContainer = await activityBar.getViewControl("Zowe Explorer");
    await zeContainer.wait();
    const sidebarContent = (await zeContainer.openView()).getContent();
    switch (tree.toLowerCase()) {
        case "data sets":
            return sidebarContent.getSection("DATA SETS");
        case "uss":
        case "unix system services (uss)":
            return sidebarContent.getSection("UNIX SYSTEM SERVICES (USS)");
        case "jobs":
        default:
            return sidebarContent.getSection("JOBS");
    }
}
