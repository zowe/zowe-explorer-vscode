//! Module for handling the `test ghr` sub-command.

use anyhow::bail;
use octocrab::{params::actions::ArchiveFormat, Octocrab};
use owo_colors::OwoColorize;
use zip::ZipArchive;

/// Fetches artifacts from GitHub given a list of refs.
///
/// # Arguments
/// * `refs` - A `Vec` of GitHub references to fetch artifacts from.
/// * `gh` - An `octocrab` instance for interfacing with the GitHub API.
async fn fetch_artifacts(refs: Vec<String>, gh: &Octocrab) -> anyhow::Result<Vec<String>> {
    println!("💿 {}", "Fetching artifacts...".underline());

    // Collect workflow runs from the Zowe Explorer repo.
    let workflow_runs = gh
        .workflows("zowe", "zowe-explorer-vscode")
        .list_runs("zowe-explorer-ci.yml")
        .send()
        .await?;
    let workflow_runs = workflow_runs
        .into_iter()
        .filter(|wr| wr.name == "Zowe Explorer CI" && wr.conclusion == Some("success".to_owned()))
        .collect::<Vec<_>>();

    // Setup a directory for VSIX files.
    let current_exe = std::env::current_exe()?;
    let cur_dir = current_exe.parent().unwrap();
    let vsix_dir = cur_dir.join("zedc_data").join("vsix");
    if vsix_dir.exists() {
        tokio::fs::remove_dir_all(&vsix_dir).await?;
    }
    tokio::fs::create_dir_all(&vsix_dir).await?;

    // Iterate over the references, fetching and extracting the artifacts from each one.
    for r in refs {
        print!("\t{}: ", r);
        let workflow_id = match workflow_runs
            .iter()
            .position(|wr| wr.head_branch == r || wr.head_sha == r)
        {
            Some(run) => run,
            None => {
                println!("no artifacts found");
                continue;
            }
        };
        let workflow = &workflow_runs[workflow_id];

        // Get the list of artifacts from the matching workflow.
        // Filter the list to only return the Zowe Explorer VSIX artifact.
        let artifact_list = gh
            .actions()
            .list_workflow_run_artifacts("zowe", "zowe-explorer-vscode", workflow.id)
            .send()
            .await?
            .value
            .unwrap()
            .items;
        let artifact_list = artifact_list
            .into_iter()
            .filter(|a| a.name == "zowe-explorer-vsix")
            .collect::<Vec<_>>();

        if artifact_list.is_empty() {
            println!("no artifacts found");
            continue;
        }

        // Grab the first artifact from the list - download and extract it.
        let first_artifact = artifact_list.first().unwrap();
        let raw_artifact = gh
            .actions()
            .download_artifact(
                "zowe",
                "zowe-explorer-vscode",
                first_artifact.id,
                ArchiveFormat::Zip,
            )
            .await?;
        let mut cursor = std::io::Cursor::new(raw_artifact);
        let mut zip = match ZipArchive::new(&mut cursor) {
            Ok(z) => z,
            Err(e) => {
                println!("Error extracting .zip archive from artifact: {}", e);
                continue;
            }
        };
        zip.extract(&vsix_dir)?;
        println!("\t✔️ ");
    }

    // Walk the `vsix` directory and build a list of file paths to pass to `fs::install_from_paths`.
    let mut vec = Vec::new();
    let mut files = tokio::fs::read_dir(&vsix_dir).await?;
    while let Some(entry) = files.next_entry().await? {
        let path = entry.path();
        let path = path.to_str().unwrap().to_owned();
        vec.push(path);
    }

    Ok(vec)
}

/// Downloads VS Code, resolves artifacts from the given GitHub refs, installs them in VS Code and opens it.
///
/// # Arguments
/// * `refs` - A `Vec` of Git references containing artifacts to install
/// * `vsc_version` - (optional) The VS Code version to download (default: `latest`)
/// * `gh` - An instance of Octocrab to use for GitHub API requests.
pub async fn setup(
    refs: Vec<String>,
    vsc_version: Option<String>,
    gh: &Octocrab,
) -> anyhow::Result<()> {
    if refs.is_empty() {
        bail!("At least one reference is required to use this command.".red());
    }

    // Confirm that a GitHub personal token is defined before continuing.
    if std::env::var("ZEDC_PAT").is_err() {
        bail!("A GitHub personal access token must be defined in the ZEDC_PAT environment variable to use this command.".red());
    }

    let vsc_bin = crate::code::download_vscode(vsc_version).await?;
    let paths = fetch_artifacts(refs, gh).await?;
    super::fs::install_from_paths(vsc_bin, paths).await?;

    Ok(())
}
