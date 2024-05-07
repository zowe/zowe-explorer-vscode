use anyhow::bail;
use octocrab::{params::actions::ArchiveFormat, Octocrab};
use owo_colors::OwoColorize;
use zip::ZipArchive;

async fn fetch_artifacts(refs: Vec<String>, gh: &Octocrab) -> anyhow::Result<Vec<String>> {
    println!("💿 {}", "Fetching artifacts...".underline());

    let workflow_runs = gh
        .workflows("zowe", "zowe-explorer-vscode")
        .list_runs("zowe-explorer-ci.yml")
        .send()
        .await?;

    let workflow_runs = workflow_runs
        .into_iter()
        .filter(|wr| wr.name == "Zowe Explorer CI" && wr.conclusion == Some("success".to_owned()))
        .collect::<Vec<_>>();
    // let mut wf = OpenOptions::new()
    //     .create(true)
    //     .append(true)
    //     .write(true)
    //     .open(current_dir().unwrap().join("workflows.txt"))
    //     .await?;
    // wf.write_all(format!("{:#?}", workflow_runs).as_bytes()).await?;

    let current_exe = std::env::current_exe()?;
    let cur_dir = current_exe.parent().unwrap();
    let vsix_dir = cur_dir.join("zedc_data").join("vsix");
    if vsix_dir.exists() {
        tokio::fs::remove_dir_all(&vsix_dir).await?;
    }
    tokio::fs::create_dir_all(&vsix_dir).await?;

    for r in refs {
        print!("\t{}:", r);
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
        let workflow = &workflow_runs[workflow_id];

        let artifact_list = gh
            .actions()
            .list_workflow_run_artifacts("zowe", "zowe-explorer-vscode", workflow.id)
            .send()
            .await?
            .value
            .unwrap()
            .items;
        let artifact_list = artifact_list.into_iter().filter(|a| a.name == "zowe-explorer-vsix").collect::<Vec<_>>();

        if artifact_list.is_empty() {
            println!("⏩  skipping - no artifacts found for ref");
            continue;
        }

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
        // handle: tgz, etc.
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
        bail!("At least one reference is required to use this command.".red());
    }

    if std::env::var("ZEDC_PAT").is_err() {
        bail!("A GitHub personal access token must be defined in the ZEDC_PAT environment variable to use this command.".red());
    }

    let vsc_bin = crate::code::download_vscode(vsc_version).await?;
    let paths = fetch_artifacts(refs, gh).await?;
    super::fs::install_from_paths(vsc_bin, paths).await?;

    Ok(())
}
