class Cache {
    private static instance;
    private uss = {
        ignoreDownloadSizeCheck: false
    };

    constructor() {
        if (!Cache.instance) {
            Cache.instance = this;
        }

        return Cache.instance;
    }

    public get ignoreUSSDownloadCheck(): boolean {
        return this.uss.ignoreDownloadSizeCheck;
    }

    public set ignoreUSSDownloadCheck(value: boolean) {
        this.uss.ignoreDownloadSizeCheck = value;
    }
}

export default new Cache();
