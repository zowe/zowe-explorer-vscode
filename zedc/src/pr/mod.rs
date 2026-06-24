//! Module for the `zedc pr` command — fetch, check out, build, and sandbox a PR in one step.

use anyhow::{bail, Context, Result};
use owo_colors::OwoColorize;
use std::path::Path;
use std::process::Command;

/// Fetches the head-branch name and a brief summary for the given PR number.
async fn fetch_pr_info(pr_number: u64) -> Result<String> {
    let gh = octocrab::instance();
    let pr = gh
        .pulls("zowe", "zowe-explorer-vscode")
        .get(pr_number)
        .await
        .with_context(|| format!("Failed to fetch PR #{} from GitHub", pr_number))?;

    if let Some(title) = &pr.title {
        println!("  {} {}", "Title:".dimmed(), title.bold());
    }
    let branch = pr.head.ref_field.clone();
    println!("  {} {}", "Branch:".dimmed(), branch.bold());
    if let Some(user) = &pr.user {
        println!("  {} {}", "Author:".dimmed(), user.login.bold());
    }
    println!();

    Ok(branch)
}

/// Fetches and checks out the PR branch by its PR number.
///
/// Uses `refs/pull/<N>/head` so fork PRs work without adding the fork as a remote.
fn checkout_pr_branch(ze_dir: &Path, pr_number: u64, branch: &str) -> Result<()> {
    println!("{}", "Checking out branch...".underline());

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

    // git fetch origin refs/pull/<N>/head:<branch>  (-f allows updating an existing local ref)
    let fetch_refspec = format!("refs/pull/{}/head:{}", pr_number, branch);
    let fetched = Command::new("git")
        .args(["fetch", "-f", "origin", &fetch_refspec])
        .current_dir(ze_dir)
        .status()
        .context("Failed to run git fetch")?;

    if !fetched.success() {
        bail!("git fetch failed for PR #{}", pr_number);
    }

    let checked_out = Command::new("git")
        .args(["checkout", branch])
        .current_dir(ze_dir)
        .status()
        .context("Failed to run git checkout")?;

    if !checked_out.success() {
        bail!("git checkout '{}' failed", branch);
    }

    println!("✔️  On branch '{}'", branch.bold());
    Ok(())
}

/// Runs the package manager's `install` step to refresh dependencies.
async fn install_deps(ze_dir: &Path) -> Result<()> {
    println!("\n{}", "Installing dependencies...".underline());

    let pkg_mgr = crate::pm::detect_pkg_mgr(ze_dir)?;
    let mut pm = crate::pm::pkg_mgr(&pkg_mgr);
    pm.current_dir(ze_dir);
    if pkg_mgr != "yarn" {
        pm.arg("install");
    }

    let status = pm
        .status()
        .with_context(|| format!("Failed to run `{} install`", pkg_mgr))?;

    if !status.success() {
        bail!("`{} install` failed", pkg_mgr);
    }

    println!("✔️  Dependencies installed");
    Ok(())
}

/// Runs `pnpm package` (or the detected PM equivalent) and returns paths to the produced VSIXes.
///
/// VSIXes are written to `dist/` at the repo root by each package's `mv-pack.js` post-step.
fn build_vsix(ze_dir: &Path) -> Result<Vec<String>> {
    println!("\n{}", "Building VSIXes...".underline());

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
    let status = crate::pm::pkg_mgr(&pkg_mgr)
        .arg("package")
        .current_dir(ze_dir)
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
            println!("  📦 {}", path.file_name().unwrap().to_string_lossy().bold());
            vsix_paths.push(path.to_string_lossy().into_owned());
        }
    }

    if vsix_paths.is_empty() {
        bail!("No .vsix files found in `dist/` after `{} package`", pkg_mgr);
    }

    println!("✔️  Built {} VSIX(es)", vsix_paths.len());
    Ok(vsix_paths)
}

/// Handles the `zedc pr <NUMBER>` command.
pub async fn handle_cmd(pr_number: u64, vsc_version: Option<String>, skip_setup: bool) -> Result<()> {
    println!("{}\n", format!("zedc pr #{}", pr_number).bold());

    let ze_dir = crate::util::find_dir_match(&["package.json"])?
        .context("Could not find a repo root containing package.json")?;

    println!("{}", "Fetching PR info from GitHub...".underline());
    let branch = fetch_pr_info(pr_number).await?;

    checkout_pr_branch(&ze_dir, pr_number, &branch)?;

    if skip_setup {
        println!("⏭️  Skipping dependency install (--skip-setup)");
    } else {
        install_deps(&ze_dir).await?;
    }

    let vsix_paths = build_vsix(&ze_dir)?;

    let vsc_bin = crate::code::download_vscode(vsc_version).await?;
    crate::test::install_from_paths(vsc_bin, vsix_paths).await?;

    Ok(())
}
