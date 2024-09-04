/**
 * Builds a row for the Markdown table given the GitHub repo owner, repo name and pull request. 
 * @param {string} owner The owner of the repository (user or organization)
 * @param {string} repo The name of the repository on GitHub
 * @param {Object} pr The pull request data to use for the table row
  * @param {number} pr.number The number for the pull request
  * @param {string} pr.author The author of the pull request
  * @param {string} pr.title The title of the pull request
  * @param {boolean} pr.hasReviews Whether the pull request has 2 or more approvals
  * @param {boolean} pr.mergeable Whether the pull request is able to be merged
  * @param {Object[]} pr.reviewers The list of requested reviewers for the pull request
  * @param {string} pr.mergeBy (optional) The merge-by date for the pull request
 * @returns 
 */
const buildTableRow = (owner, repo, pr) =>
  `| [#${pr.number}](https://github.com/${owner}/${repo}/pull/${pr.number}) | [**${pr.title.trim()}**](https://github.com/${owner}/${repo}/pull/${pr.number}) | ${pr.author} | ${pr.mergeBy ?? "N/A"} | ${pr.hasReviews ? ":white_check_mark:" : ":white_large_square:"} |`;

const tableHeader = `
| # | Title | Author | Merge by | Ready to merge? |
| - | ----- | ------ | ------------- | -------------- |`;

/**
 * Scans PRs and builds a table using Markdown. Updates an issue or creates a new one with the table.
 * 
 * @param {Object} github The OctoKit/rest.js API for making requests to GitHub
 * @param {string} owner The owner of the repository (user or organization)
 * @param {Object[]} pullRequests The list of pull requests to include in the table
  * @param {number} pullRequests[].number The number for the pull request
  * @param {string} pullRequests[].author The author of the pull request
  * @param {string} pullRequests[].title The title of the pull request
  * @param {boolean} pullRequests[].hasReviews Whether the pull request has 2 or more approvals
  * @param {boolean} pullRequests[].mergeable Whether the pull request is able to be merged
  * @param {Object[]} pullRequests[].reviewers The list of requested reviewers for the pull request
  * @param {string} pullRequests[].mergeBy (optional) The merge-by date for the pull request
 * @param {string} repo The name of the repository on GitHub
 */
const scanPRsAndUpdateTable = async ({ github, owner, pullRequests, repo }) => {
  // Build a table using Markdown to post within the issue
  const body = `${tableHeader}\n${pullRequests.map((pr) => buildTableRow(owner, repo, pr)).join("\n")}`;
  
  const graphqlQuery = `query($owner:String!, $repo:String!) {
        repository(owner:$owner, name:$repo) {
            id

            discussionCategories(first: 100) {
                nodes {
                    id
                    name
                }
            }

            discussions(first: 100) {
                nodes {
                    id
                    body
                    title
                }
            }
        }
    }`;

  const discussionsQuery = await github.graphql(graphqlQuery, {
    owner,
    repo,
  });
  const discussion = discussionsQuery?.repository?.discussions?.nodes?.find((d) => d.title === "PR Status List");

  if (discussion != null) {
    const mutation = `mutation($input:UpdateDiscussionInput!) {
      updateDiscussion(input: $input) {
        discussion {
          id
        }
      }
    }`
    await github.graphql(mutation, {
      input: {
        discussionId: discussion.id,
        body,
      }
    });
  } else {
    const mutation = `mutation($input:CreateDiscussionInput!) {
      createDiscussion(input: $input) {
        discussion {
          id
        }
      }
    }`;
    const generalCategory = discussionsQuery.repository?.discussionCategories?.nodes?.find((cat) => cat.name === "General");
    await github.graphql(mutation, {
      input: {
        categoryId: generalCategory.id,
        repositoryId: discussionsQuery?.repository?.id,
        body,
        title: "PR Status List"
      }
    });
  }
}

/**
 * Notifies users for PRs that have a merge-by date <24 hours from now.
 * 
 * @param {Object} dayJs Day.js exports for manipulating/querying time differences
 * @param {Object} github The OctoKit/rest.js API for making requests to GitHub
 * @param {string} owner The owner of the repo (user or organization)
 * @param {Object[]} pullRequests The list of pull requests to include in the table
  * @param {string} pullRequests[].number The number for the pull request
  * @param {string} pullRequests[].author The author of the pull request
  * @param {string} pullRequests[].title The title of the pull request
  * @param {string} pullRequests[].mergeable Whether the pull request is able to be merged
  * @param {string} pullRequests[].reviewers The list of requested reviewers for the pull request
  * @param {string} pullRequests[].mergeBy (optional) The merge-by date for the pull request
 * @param {string} repo The name of the GitHub repo
 * @param {Object} today Today's date represented as a Day.js object
 */
const notifyUsers = async ({ dayJs, github, owner, pullRequests, repo, today }) => {
  const prsCloseToMergeDate = pullRequests.filter((pr) => {
    if (pr.mergeBy == null) {
      return false;
    }

    // Filter out any PRs that don't have merge-by dates within a day from now
    const mergeByDate = dayJs(pr.mergeBy);
    return mergeByDate.diff(today, "day") <= 1;
  });

  for (const pr of prsCloseToMergeDate) {
    // Make a comment on the PR and tag reviewers
    const body = `**Reminder:** This pull request has a merge-by date coming up within the next 24 hours. Please review this PR as soon as possible.\n\n${pr.reviewers.map((r) => `@${r.login}`).join(" ")}`
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: pr.number,
      body
    });
  }
};

/**
 * Fetches PRs with a merge-by date < 1 week from now.
 * 
 * @param {Object} dayJs Day.js exports for manipulating/querying time differences
 * @param {Object} github The OctoKit/rest.js API for making requests to GitHub
 * @param {string} owner The owner of the repository (user or organization)
 * @param {string} repo The name of the repository on GitHub
 * @param {Object} today Today's date, represented as a day.js object
 */
const fetchPullRequests = async ({ dayJs, github, owner, repo, today }) => {
  const nextWeek = today.add(7, "day");
  return (await Promise.all((await github.rest.pulls.list({
    owner,
    repo,
    state: "open"
  }))?.data.filter((pr) => !pr.draft)
    .map(async (pr) => {
      const comments = (await github.rest.issues.listComments({ owner, repo, issue_number: pr.number })).data;
      // Attempt to parse the merge-by date from the bot comment
      const existingComment = comments?.find((comment) =>
        comment.user.login === "github-actions[bot]" && comment.body.includes("**📅 Suggested merge-by date:"));

      const reviews = (await github.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pr.number,
      })).data;

      const hasTwoReviews = reviews.reduce((all, review) => review.state === "APPROVED" ? all + 1 : all, 0) >= 2;

      // Filter out reviewers if they have already reviewed and approved the pull request
      const reviewersNotApproved = pr.requested_reviewers
        .filter((reviewer) => 
          reviews.find((review) => review.state === "APPROVED" && reviewer.login === review.user.login) == null);

      return {
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        hasReviews: hasTwoReviews,
        mergeable: pr.mergeable,
        reviewers: reviewersNotApproved,
        mergeBy: existingComment?.body.substring(existingComment.body.lastIndexOf("*") + 1).trim()
      };
    }))).filter((pr) => {
      if (pr.mergeBy == null) {
        return true;
      }

      // Filter out any PRs that have merge-by dates > 1 week from now
      const mergeByDate = dayJs(pr.mergeBy);
      return nextWeek.diff(mergeByDate, "day") <= 7;
    }).reverse();
}

module.exports = async ({ github, context }) => {
  const dayJs = require("dayjs");
  const today = dayJs();
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const pullRequests = await fetchPullRequests({ dayJs, github, owner, repo, today });
  // Look over existing PRs, grab all PRs with a merge-by date <= 1w from now, and update the issue with the new table
  await scanPRsAndUpdateTable({ github, owner, pullRequests, repo });
  // Notify users for PRs with merge-by dates coming up within 24hrs from now
  await notifyUsers({ dayJs, github, owner, pullRequests, repo, today });
}