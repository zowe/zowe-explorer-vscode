process.on("unhandledRejection", (reason) => {
    fail(reason);
});
