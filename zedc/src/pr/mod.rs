//! Module for the `zedc pr` command — fetch, check out, build, and sandbox a PR in one step.

use anyhow::{bail, Context, Result};
use octocrab::{models::ArtifactId, params::actions::ArchiveFormat, Octocrab};
use owo_colors::OwoColorize;
use std::path::Path;
use std::process::{Command, Stdio};
use zip::ZipArchive;

const OWNER: &str = "zowe";
const REPO: &str = "zowe-explorer-vscode";

macro_rules! text_println {
    ($($arg:tt)*) => {
        if crate::output::text_enabled() {
            println!($($arg)*);
        }
    };
}

fn silence_if_json(command: &mut Command) {
    if crate::output::json_enabled() {
        command.stdout(Stdio::null()).stderr(Stdio::null());
    }
}

/// Summary information about a pull request needed to fetch artifacts and check it out.
struct PrInfo {
    /// Name of the PR's head branch.
    branch: String,
    /// Full SHA of the PR's head commit, used to verify a posted artifact is up-to-date.
    head_sha: String,
}

/// Fetches the head branch, head commit, and a brief summary for the given PR number.
async fn fetch_pr_info(pr_number: u64) -> Result<PrInfo> {
    let gh = octocrab::instance();
    let pr = gh
        .pulls(OWNER, REPO)
        .get(pr_number)
        .await
        .with_context(|| format!("Failed to fetch PR #{} from GitHub", pr_number))?;

    if let Some(title) = &pr.title {
        text_println!("  {} {}", "Title:".dimmed(), title.bold());
    }
    let branch = pr.head.ref_field.clone();
    text_println!("  {} {}", "Branch:".dimmed(), branch.bold());
    if let Some(user) = &pr.user {
        text_println!("  {} {}", "Author:".dimmed(), user.login.bold());
    }
    text_println!();

    Ok(PrInfo {
        branch,
        head_sha: pr.head.sha,
    })
}

/// Returns the name of the currently checked-out branch, or `None` for a detached HEAD.
fn current_branch(ze_dir: &Path) -> Result<Option<String>> {
    let out = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(ze_dir)
        .output()
        .context("Failed to run git rev-parse")?;
    let name = String::from_utf8_lossy(&out.stdout).trim().to_owned();
    Ok(if name == "HEAD" { None } else { Some(name) })
}

/// Fetches and checks out the PR branch by its PR number.
///
/// Uses `refs/pull/<N>/head` so fork PRs work without adding the fork as a remote.
/// If the branch is already checked out, pulls the latest commits instead.
fn checkout_pr_branch(ze_dir: &Path, pr_number: u64, branch: &str) -> Result<()> {
    text_println!("{}", "Checking out branch...".underline());

    // Refuse to proceed when there are uncommitted changes.
    let clean = Command::new("git")
        .args(["diff", "--quiet"])
        .current_dir(ze_dir)
        .status()
        .context("Failed to run git diff")?;
    let clean_staged = Command::new("git")
        .args(["diff", "--cached", "--quiet"])
        .current_dir(ze_dir)
        .status()
        .context("Failed to run git diff --cached")?;

    if clean.code().unwrap_or(1) != 0 || clean_staged.code().unwrap_or(1) != 0 {
        bail!(
            "There are uncommitted changes in your working tree.\n\
             Please commit or stash them before running `zedc pr`."
        );
    }

    let already_on_branch = current_branch(ze_dir)?.as_deref() == Some(branch);

    if already_on_branch {
        // git refuses to update a branch ref that is currently checked out via the
        // `refs/pull/<N>/head:<branch>` refspec.  Fetch into FETCH_HEAD and fast-forward instead.
        let fetch_refspec = format!("refs/pull/{}/head", pr_number);
        let mut fetch = Command::new("git");
        fetch
            .args(["fetch", "origin", &fetch_refspec])
            .current_dir(ze_dir);
        silence_if_json(&mut fetch);
        let fetched = fetch.status().context("Failed to run git fetch")?;
        if !fetched.success() {
            bail!("git fetch failed for PR #{}", pr_number);
        }
        let mut merge = Command::new("git");
        merge
            .args(["merge", "--ff-only", "FETCH_HEAD"])
            .current_dir(ze_dir);
        silence_if_json(&mut merge);
        let merged = merge.status().context("Failed to run git merge")?;
        if !merged.success() {
            bail!(
                "Could not fast-forward '{}' to the PR head — your local branch has diverged.\n\
                 Please resolve this manually before running `zedc pr`.",
                branch
            );
        }
    } else {
        // Fetch the PR head directly into a local branch name.
        // -f allows overwriting an existing local ref that isn't checked out.
        let fetch_refspec = format!("refs/pull/{}/head:{}", pr_number, branch);
        let mut fetch = Command::new("git");
        fetch
            .args(["fetch", "-f", "origin", &fetch_refspec])
            .current_dir(ze_dir);
        silence_if_json(&mut fetch);
        let fetched = fetch.status().context("Failed to run git fetch")?;
        if !fetched.success() {
            bail!("git fetch failed for PR #{}", pr_number);
        }

        let mut checkout = Command::new("git");
        checkout.args(["checkout", branch]).current_dir(ze_dir);
        silence_if_json(&mut checkout);
        let checked_out = checkout.status().context("Failed to run git checkout")?;
        if !checked_out.success() {
            bail!("git checkout '{}' failed", branch);
        }
    }

    text_println!("✔️  On branch '{}'", branch.bold());
    Ok(())
}

/// Runs the package manager's `install` step to refresh dependencies.
async fn install_deps(ze_dir: &Path) -> Result<()> {
    text_println!("\n{}", "Installing dependencies...".underline());
    crate::setup::clean_node_modules(ze_dir).await?;

    let pkg_mgr = crate::pm::detect_pkg_mgr(ze_dir)?;
    let mut pm = crate::pm::pkg_mgr(&pkg_mgr);
    pm.current_dir(ze_dir);
    if pkg_mgr != "yarn" {
        pm.arg("install");
    }
    silence_if_json(&mut pm);

    let status = pm
        .status()
        .with_context(|| format!("Failed to run `{} install`", pkg_mgr))?;

    if !status.success() {
        bail!("`{} install` failed", pkg_mgr);
    }

    text_println!("✔️  Dependencies installed");
    Ok(())
}

/// Runs `pnpm package` (or the detected PM equivalent) and returns paths to the produced VSIXes.
///
/// VSIXes are written to `dist/` at the repo root by each package's `mv-pack.js` post-step.
fn build_vsix(ze_dir: &Path) -> Result<Vec<String>> {
    text_println!("\n{}", "Building VSIXes...".underline());

    // Wipe any stale .vsix files so we only collect what this build produces.
    let dist_dir = ze_dir.join("dist");
    if dist_dir.exists() {
        for entry in std::fs::read_dir(&dist_dir)? {
            let entry = entry?;
            if entry.path().extension().map_or(false, |e| e == "vsix") {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    } else {
        std::fs::create_dir_all(&dist_dir)?;
    }

    let pkg_mgr = crate::pm::detect_pkg_mgr(ze_dir)?;
    let mut package = crate::pm::pkg_mgr(&pkg_mgr);
    package.arg("package").current_dir(ze_dir);
    silence_if_json(&mut package);
    let status = package
        .status()
        .with_context(|| format!("Failed to run `{} package`", pkg_mgr))?;

    if !status.success() {
        bail!("`{} package` exited with a non-zero status", pkg_mgr);
    }

    let mut vsix_paths: Vec<String> = Vec::new();
    for entry in std::fs::read_dir(&dist_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map_or(false, |e| e == "vsix") {
            text_println!(
                "  📦 {}",
                path.file_name().unwrap().to_string_lossy().bold()
            );
            vsix_paths.push(path.to_string_lossy().into_owned());
        }
    }

    if vsix_paths.is_empty() {
        bail!(
            "No .vsix files found in `dist/` after `{} package`",
            pkg_mgr
        );
    }

    text_println!("✔️  Built {} VSIX(es)", vsix_paths.len());
    Ok(vsix_paths)
}

/// Details parsed from the CI bot's "Report VSIX Artifact" comment on a PR.
struct ArtifactComment {
    /// The commit SHA the artifact was built from (the `PR Commit` row in the comment).
    pr_commit: String,
    /// The GitHub Actions artifact ID, taken from the download link.
    artifact_id: u64,
}

/// Returns the value of a `|Key|Value|` row in a Markdown table when `key` matches the first cell.
fn table_row_value(line: &str, key: &str) -> Option<String> {
    let line = line.trim();
    if !line.starts_with('|') {
        return None;
    }
    let cells: Vec<&str> = line.trim_matches('|').split('|').map(str::trim).collect();
    if cells.len() == 2 && cells[0] == key {
        return Some(cells[1].to_owned());
    }
    None
}

/// Parses the CI bot's artifact comment body for the source commit and artifact ID.
///
/// The comment (rendered from `.github/resources/artifact-template.hbs`) contains a download link
/// of the form `.../artifacts/<id>` and a `|PR Commit|<sha>|` table row. Returns `None` when the
/// body is not a recognizable artifact comment.
fn parse_artifact_comment(body: &str) -> Option<ArtifactComment> {
    // The artifact ID is the run of digits immediately following the last `/artifacts/` link.
    let artifact_id: u64 = body.rsplit_once("/artifacts/").and_then(|(_, rest)| {
        let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
        digits.parse().ok()
    })?;

    let pr_commit = body
        .lines()
        .find_map(|line| table_row_value(line, "PR Commit"))?;
    if pr_commit.is_empty() {
        return None;
    }

    Some(ArtifactComment {
        pr_commit,
        artifact_id,
    })
}

/// Downloads and extracts the given artifact ID, returning paths to the contained `.vsix` files.
async fn download_artifact_vsixes(gh: &Octocrab, artifact_id: u64) -> Result<Vec<String>> {
    text_println!("\n{}", "Downloading artifact...".underline());

    let raw_artifact = gh
        .actions()
        .download_artifact(
            OWNER,
            REPO,
            ArtifactId::from(artifact_id),
            ArchiveFormat::Zip,
        )
        .await
        .context("Failed to download artifact from GitHub")?;

    // Extract into a dedicated directory next to the zedc binary (mirrors `zedc test ghr`).
    let current_exe = std::env::current_exe()?;
    let vsix_dir = current_exe
        .parent()
        .context("Could not resolve zedc executable directory")?
        .join("zedc_data")
        .join("vsix");
    if vsix_dir.exists() {
        std::fs::remove_dir_all(&vsix_dir)?;
    }
    std::fs::create_dir_all(&vsix_dir)?;

    let mut cursor = std::io::Cursor::new(raw_artifact);
    let mut zip = ZipArchive::new(&mut cursor).context("Failed to read artifact .zip archive")?;
    zip.extract(&vsix_dir)
        .context("Failed to extract artifact .zip archive")?;

    let mut vsix_paths = Vec::new();
    for entry in std::fs::read_dir(&vsix_dir)? {
        let path = entry?.path();
        if path.extension().map_or(false, |e| e == "vsix") {
            text_println!(
                "  📦 {}",
                path.file_name().unwrap().to_string_lossy().bold()
            );
            vsix_paths.push(path.to_string_lossy().into_owned());
        }
    }

    if vsix_paths.is_empty() {
        bail!("Artifact did not contain any .vsix files");
    }

    text_println!("✔️  Downloaded {} VSIX(es)", vsix_paths.len());
    Ok(vsix_paths)
}

/// Attempts to reuse the VSIX artifact posted on the PR instead of building from source.
///
/// Returns `Ok(Some(paths))` when an artifact built from the current PR head commit was downloaded.
/// Returns `Ok(None)` when no usable artifact exists (no token, no comment, stale, or expired),
/// signalling the caller to build from source.
async fn try_use_artifact(pr_number: u64, head_sha: &str) -> Result<Option<Vec<String>>> {
    // Downloading workflow artifacts requires authentication.
    if std::env::var("ZEDC_PAT").is_err() {
        text_println!(
            "{}",
            "ZEDC_PAT not set — skipping artifact lookup, building from source.".dimmed()
        );
        return Ok(None);
    }

    text_println!("{}", "Checking for a posted VSIX artifact...".underline());
    let gh = octocrab::instance();

    let first_page = gh
        .issues(OWNER, REPO)
        .list_comments(pr_number)
        .per_page(100u8)
        .send()
        .await
        .context("Failed to list PR comments")?;
    let comments = gh
        .all_pages(first_page)
        .await
        .context("Failed to page through PR comments")?;

    // Only trust comments posted by a bot account (CI posts as `github-actions[bot]`) so a
    // crafted user comment can't trick us into downloading an arbitrary artifact.
    // The CI bot uses CreateOrUpdate, so the latest matching comment reflects the newest build.
    let artifact = comments
        .iter()
        .rev()
        .filter(|comment| comment.user.login.ends_with("[bot]"))
        .find_map(|comment| comment.body.as_deref().and_then(parse_artifact_comment));

    let artifact = match artifact {
        Some(a) => a,
        None => {
            text_println!("  No VSIX artifact comment found — building from source.");
            return Ok(None);
        }
    };

    // Up-to-date check: the artifact must have been built from the current PR head commit.
    if !artifact.pr_commit.eq_ignore_ascii_case(head_sha) {
        text_println!(
            "  {} Posted artifact is for commit {} but PR head is {} — building from source.",
            "⚠️".yellow(),
            short_sha(&artifact.pr_commit),
            short_sha(head_sha)
        );
        return Ok(None);
    }

    text_println!(
        "✔️  Found up-to-date artifact for commit {}",
        short_sha(head_sha)
    );

    // A stale comment may point at an expired artifact; treat any download error as a fallback.
    match download_artifact_vsixes(&gh, artifact.artifact_id).await {
        Ok(paths) => Ok(Some(paths)),
        Err(e) => {
            text_println!(
                "  {} Could not download artifact ({}) — building from source.",
                "⚠️".yellow(),
                e
            );
            Ok(None)
        }
    }
}

/// Shortens a commit SHA to its first 7 characters for display.
fn short_sha(sha: &str) -> &str {
    sha.get(..7).unwrap_or(sha)
}

/// Builds the PR's VSIXes from source by checking out the branch, installing deps, and packaging.
async fn build_from_source(
    ze_dir: &Path,
    pr_number: u64,
    branch: &str,
    skip_setup: bool,
) -> Result<Vec<String>> {
    checkout_pr_branch(ze_dir, pr_number, branch)?;

    if skip_setup {
        text_println!("⏭️  Skipping dependency install (--skip-setup)");
    } else {
        install_deps(ze_dir).await?;
    }

    build_vsix(ze_dir)
}

/// Handles the `zedc pr <NUMBER>` command.
pub async fn handle_cmd(
    pr_number: u64,
    vsc_version: Option<String>,
    skip_setup: bool,
    build: bool,
) -> Result<()> {
    if crate::output::text_enabled() {
        println!("{}\n", format!("zedc pr #{}", pr_number).bold());
    }

    let ze_dir = crate::util::find_dir_match(&["package.json"])?
        .context("Could not find a repo root containing package.json")?;

    text_println!("{}", "Fetching PR info from GitHub...".underline());
    let pr_info = fetch_pr_info(pr_number).await?;

    // Prefer the artifact posted on the PR (fast path) unless the user forced a build.
    let vsix_paths = if build {
        text_println!("{}", "Building from source (--build).".dimmed());
        build_from_source(&ze_dir, pr_number, &pr_info.branch, skip_setup).await?
    } else {
        match try_use_artifact(pr_number, &pr_info.head_sha).await? {
            Some(paths) => paths,
            None => build_from_source(&ze_dir, pr_number, &pr_info.branch, skip_setup).await?,
        }
    };

    let vsc_bin = crate::code::download_vscode(vsc_version).await?;
    crate::test::install_from_paths(vsc_bin, vsix_paths).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Sample comment body matching the rendered `artifact-template.hbs` output.
    const SAMPLE_COMMENT: &str = "\
|[![zowe-explorer-vsix](https://img.shields.io/badge/zowe--explorer--vsix-472d30?logo=github)](https://github.com/zowe/zowe-explorer-vscode/actions/runs/28119832764)|[![Download](https://img.shields.io/badge/Download-723d46)](https://github.com/zowe/zowe-explorer-vscode/actions/runs/28119832764/artifacts/7858482383)|
|:---:|:---:|

<details><summary>Build Details</summary>

|Name|Information|
|---|---|
|PR Commit|1015def08145a227bbecb7d7f1d530ce1cd45363|
|Merge Commit|c57957b9c3c37f0a9074c7f1da094aba7fec587e|
|Size|6.9 MB|
|Last Updated By|t1m0thyj|
|Last Updated|Jun 24, 26, 6:16:34 PM UTC|
|Expires At|Sep 22, 26, 6:14:04 PM UTC|

</details>";

    #[test]
    fn parses_artifact_id_and_commit_from_comment() {
        let parsed = parse_artifact_comment(SAMPLE_COMMENT).expect("comment should parse");
        assert_eq!(parsed.artifact_id, 7858482383);
        assert_eq!(parsed.pr_commit, "1015def08145a227bbecb7d7f1d530ce1cd45363");
    }

    #[test]
    fn ignores_unrelated_comments() {
        assert!(parse_artifact_comment("Just a regular review comment.").is_none());
        // A comment with a commit row but no artifact link is not usable.
        assert!(parse_artifact_comment("|PR Commit|abc123|").is_none());
    }

    #[test]
    fn table_row_value_matches_only_exact_key() {
        assert_eq!(
            table_row_value("|PR Commit|abc123|", "PR Commit").as_deref(),
            Some("abc123")
        );
        assert_eq!(table_row_value("|Merge Commit|def456|", "PR Commit"), None);
        assert_eq!(table_row_value("not a table row", "PR Commit"), None);
    }

    #[test]
    fn short_sha_truncates_to_seven_chars() {
        assert_eq!(
            short_sha("1015def08145a227bbecb7d7f1d530ce1cd45363"),
            "1015def"
        );
        assert_eq!(short_sha("abc"), "abc");
    }
}
