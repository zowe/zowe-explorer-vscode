module.exports = async ({ github, context }) => {
    // Ignore PR "opened" events if the PR was opened as draft
    const wasJustOpened = context.action === "opened";
    if (wasJustOpened && context.payload.pull_request.draft) {
        return;
    }

    const wasJustPushed = context.action === "synchronize";
    
    const comments = (await github.rest.issues.listComments({ owner, repo, issue_number: context.payload.pull_request.number }))?.data;
    const existingComment = comments?.find((comment) => 
        comment.user.login === "github-actions[bot]" && comment.body.includes("**📅 Suggested merge-by date:"));
    
    // For existing PRs, only post the date if a bot comment doesn't already exist.
    if (context.payload.pull_request.draft || (wasJustPushed && existingComment != null)) {
        return;
    }
    
    // Determine new merge-by date based on the last time the PR was marked as ready
    const currentTime = new Date();
    const mergeBy = new Date();
    mergeBy.setDate(currentTime.getDate() + 14);
    const mergeByDate = mergeBy.toLocaleDateString("en-US");
    
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    
    // Check if the bot already made a comment on this PR
    const body = `**📅 Suggested merge-by date:** ${mergeByDate}`;
    
    // Update the existing comment if one exists, or post a new comment with the merge-by date
    if (existingComment != null) {
        console.log(`Updated existing comment (ID ${existingComment.id}) with new merge-by date: ${mergeByDate}`);
        await github.rest.issues.updateComment({
            owner,
            repo,
            comment_id: existingComment.id,
            body
        });
    } else {
        console.log(`Posted comment with new merge-by date: ${mergeByDate}`);
        await github.rest.issues.createComment({
            owner,
            repo,
            issue_number: context.payload.pull_request.number,
            body,
        });
    }
}