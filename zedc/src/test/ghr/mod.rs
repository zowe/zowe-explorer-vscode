use anyhow::bail;
use octocrab::{params::actions::ArchiveFormat, Octocrab};
use owo_colors::OwoColorize;
use zip::ZipArchive;

async fn fetch_artifacts(refs: Vec<String>, gh: &Octocrab) -> anyhow::Result<Vec<String>> {
    println!("{}", "Fetching artifacts...".underline());
    let workflow_runs = gh
        .workflows("zowe", "zowe-explorer-vscode")
        .list_all_runs()
        .send()
        .await?
        .items;
    println!("{:?}", workflow_runs);

    let workflow_runs = workflow_runs
        .into_iter()
        .filter(|wr| wr.name == "Zowe Explorer CI")
        .collect::<Vec<_>>();

    let cur_dir = std::env::current_dir().unwrap();
    let vsix_dir = cur_dir.join("zedc_data").join("vsix");
    if vsix_dir.exists() {
        tokio::fs::remove_dir_all(&vsix_dir).await?;
    }
    tokio::fs::create_dir_all(&vsix_dir).await?;

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
        let raw_artifact = gh
            .actions()
            .download_artifact(
                "zowe",
                "zowe-explorer-vscode",
                octocrab::models::ArtifactId(workflow_id as u64),
                ArchiveFormat::Zip,
            )
            .await?;
        let mut cursor = std::io::Cursor::new(raw_artifact);
        let mut zip = match ZipArchive::new(&mut cursor) {
            Ok(z) => z,
            Err(e) => continue,
        };
        zip.extract(&vsix_dir)?;
        // TODO: Save bytes to a file and save file path for later installation
        // handle: zips, tgz, etc.
    }

    let mut vec = Vec::new();
    let mut files = tokio::fs::read_dir(&vsix_dir).await?;
    while let Some(entry) = files.next_entry().await? {
        let path = entry.path();
        let path = path.to_str().unwrap().to_owned();
        vec.push(path);
    }

    Ok(vec)
}

pub async fn setup(
    refs: Vec<String>,
    vsc_version: Option<String>,
    gh: &Octocrab,
) -> anyhow::Result<()> {
    if refs.is_empty() {
        bail!("At least one reference is required to use this command.");
    }
    let vsc_bin = crate::code::download_vscode(vsc_version).await?;
    let paths = fetch_artifacts(refs, gh).await?;
    super::fs::install_from_paths(vsc_bin, paths).await?;

    Ok(())
}
