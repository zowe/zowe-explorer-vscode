use std::{fmt::Write, path::Path};

use anyhow::bail;
use indicatif::{ProgressBar, ProgressStyle};
use reqwest::{header, Client};
use tokio::{fs::File, io::AsyncWriteExt};

fn build_url(version: &String) -> anyhow::Result<String> {
    Ok(format!(
        "https://update.code.visualstudio.com/{}/{}/stable",
        version,
        match std::env::consts::OS {
            "linux" => match std::env::consts::ARCH {
                "aarch64" => "linux-arm64",
                _ => "linux-x64",
            },
            "macos" => "darwin-universal",
            "windows" => match std::env::consts::ARCH {
                "aarch64" => "win32-arm64-archive",
                _ => "win32-x64-archive",
            },
            _ => bail!("OS is not supported."),
        }
    ))
}

pub async fn download_vscode(version: Option<String>) -> anyhow::Result<String> {
    println!("💿 Downloading VS Code...");
    let ver = match version {
        Some(v) => v,
        None => "latest".to_owned(),
    };

    let zedc_path = Path::new(&std::env::current_exe()?)
        .parent()
        .unwrap()
        .join("zedc_data");

    match tokio::fs::create_dir(&zedc_path).await {
        Ok(_) => {}
        Err(e) => {}
    }
    let url = build_url(&ver)?;
    let client = Client::new();

    let download_size = {
        let resp = client.head(url.as_str()).send().await?;
        if resp.status().is_success() {
            resp.headers()
                .get(header::CONTENT_LENGTH)
                .and_then(|len| len.to_str().ok())
                .and_then(|len| len.parse().ok())
                .unwrap_or(0)
        } else {
            0
        }
    };

    let mut resp = client.get(url).send().await.expect("request failed");

    let progress_bar = ProgressBar::new(download_size);
    progress_bar.set_style(
        ProgressStyle::with_template(
            "{spinner:.green} {elapsed_precise} [{bar:.cyan/blue}] ({bytes}/{total_bytes})",
        )
        .unwrap()
        .progress_chars("#>-"),
    );

    let fname = resp
        .url()
        .path_segments()
        .and_then(|segments| segments.last())
        .and_then(|name| if name.is_empty() { None } else { Some(name) })
        .unwrap_or("tmp-vscode.bin");

    let path = zedc_path.join(fname);
    let mut outfile = tokio::fs::File::create(&path).await?;

    while let Some(chunk) = resp.chunk().await? {
        progress_bar.inc(chunk.len() as u64);
        outfile.write(&chunk).await?;
    }
    let vsc_path = zedc_path.join(format!("vscode-{}", ver));

    progress_bar.finish();
    if path.extension().unwrap_or_default() == "zip" {
        println!("📤 Unpacking VS Code archive...");
        zip_extensions::zip_extract(&path, &vsc_path)?;
    }

    Ok(path.to_str().unwrap().to_owned())
}
