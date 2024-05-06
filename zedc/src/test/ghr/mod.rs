use octocrab::{params::actions::ArchiveFormat, Octocrab};
use owo_colors::OwoColorize;

pub async fn setup(
    refs: Vec<String>,
    vsc_version: Option<String>,
    gh: &Octocrab,
) -> anyhow::Result<()> {
    println!("{}\n", "zedc test".bold());
    let vsc_bin = crate::code::download_vscode(vsc_version).await?;

    println!("{}", "Fetching artifacts...".underline());
    let workflow_runs = gh
        .workflows("zowe", "zowe-explorer-vscode")
        .list_all_runs()
        .send()
        .await?
        .items;

    let workflow_runs = workflow_runs
        .into_iter()
        .filter(|wr| wr.name == "Zowe Explorer CI")
        .collect::<Vec<_>>();

    for r in refs {
        let workflow_id = match workflow_runs
            .iter()
            .position(|wr| wr.head_branch == r || wr.head_sha == r)
        {
            Some(run) => run,
            None => {
                println!("⏩  Skipping {} - no artifacts found for ref", r);
                continue;
            }
        };

        println!("💿 Downloading artifact for {}...", r);
        gh.actions()
            .download_artifact(
                "zowe",
                "zowe-explorer-vscode",
                octocrab::models::ArtifactId(workflow_id as u64),
                ArchiveFormat::Zip,
            )
            .await?;
        // TODO: Save bytes to a file and save file path for later installation
        // handle: zips, tgz, etc.
    }

    // TODO
    // fs::install_from_paths(vsc_bin, resolved_paths).await?;

    Ok(())
}
