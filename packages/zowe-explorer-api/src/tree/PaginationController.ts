import { Constants } from "../globals";
import { VscSettings } from "../vscode/doc/VscSettings";

export class PaginationController<T> {
    private childrenReference: T[] = [];

    private currentPage: number = 0;
    private itemsPerPage: number;
    private totalPageCount: number = 0;

    public constructor(numItems?: number) {
        this.itemsPerPage = numItems ?? VscSettings.getDirectValue<number>("zowe.trees.itemsPerPage", Constants.DEFAULT_ITEMS_PER_PAGE);
    }

    public setChildren(children: T[]): void {
        this.childrenReference = children;
        this.totalPageCount = Math.ceil(this.childrenReference.length / this.itemsPerPage) - 1;
    }

    public nextPage(): void {
        this.currentPage = Math.min(this.currentPage + 1, this.totalPageCount);
    }

    public previousPage(): void {
        this.currentPage = Math.max(this.currentPage - 1, 0);
    }

    public moveForward(numPages: number): void {
        this.currentPage = this.currentPage + numPages > this.totalPageCount ? this.totalPageCount : this.currentPage + numPages;
    }

    public moveBack(numPages: number): void {
        this.currentPage = this.currentPage - numPages < 0 ? 0 : this.currentPage - numPages;
    }

    public jumpToPage(page: number): void {
        this.currentPage = page;
    }

    public getPage(page: number): T[] {
        const lastPage = this.currentPage;
        this.currentPage = page;
        const children = this.getCurrentPage();
        this.currentPage = lastPage;

        return children;
    }

    public getCurrentPage(): T[] {
        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.childrenReference.length);
        return this.childrenReference.slice(startIndex, endIndex);
    }
}
