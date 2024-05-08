//! Preparation functions and utilities for VS Code "sandbox" testing.
//! Includes setup, download and URL building procedures.

use std::{
    fs::File,
    path::{Path, PathBuf},
};

use anyhow::bail;
use flate2::read::GzDecoder;
use indicatif::{ProgressBar, ProgressStyle};
use owo_colors::OwoColorize;
use reqwest::{header, Client};
use tar::Archive;
use tokio::io::AsyncWriteExt;

/// Returns a URL for the VS Code release for the current operating system with the given version.
///
/// # Arguments
/// * `version` - The version of VS Code to download
///
/// ### Note:  
/// The returned URL is not validated and might not exist; any errors should be handled at the time
/// of the request.
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

/// Returns a path to the Code CLI binary, relative to the directory where the desired VS Code version was extracted.
///
/// # Arguments
/// * `dir` - The directory path for the extracted copy of VS Code
fn code_cli_binary(dir: &Path) -> PathBuf {
    match std::env::consts::OS {
        "windows" => dir.join("bin").join("code.cmd"),
        "linux" => dir
            .join(format!(
                "VSCode-linux-{}",
                if std::env::consts::ARCH == "x86_64" {
                    "x64"
                } else {
                    "aarch64"
                }
            ))
            .join("bin")
            .join("code"),
        _ => dir.join("bin").join("code"),
    }
}

/// Downloads a portable copy of VS Code with the given version, if provided (default: `latest`).  
/// Returns an absolute path to the Code CLI binary.
///
/// # Arguments  
/// * `version`: (optional) The version of VS Code to download
///
/// # Summary
/// This function performs the following operations:
/// * Creates a data directory for `zedc` to manage VS Code versions (`zedc_data`)
/// * Builds a URL and performs a `GET` request to fetch the VS Code archive
/// * Extracts the VS Code archive into its corresponding directory in into `zedc_data`
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

    let vsc_path = zedc_path.join(format!("vscode-{}", ver));
    if let Ok(v) = tokio::fs::try_exists(&vsc_path).await {
        if v && ver != "latest" {
            println!(
                "  ⏭️  {}",
                format!("Found VS Code {} in cache, skipping download...", ver).italic()
            );
            return Ok(code_cli_binary(&vsc_path).to_str().unwrap().to_owned());
        }
    }

    let _ = tokio::fs::create_dir(&zedc_path).await;
    if !zedc_path.exists() {
        bail!("Failed to create the data dir for zedc.".red());
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
        outfile.write_all(&chunk).await?;
    }

    progress_bar.finish();
    println!("📤 Unpacking VS Code archive...");
    match path
        .extension()
        .unwrap_or_default()
        .to_str()
        .unwrap_or_default()
    {
        "zip" => {
            zip_extensions::zip_extract(&path, &vsc_path)?;
            tokio::fs::create_dir(vsc_path.join(if std::env::consts::OS == "macos" {
                "code-portable-data"
            } else {
                "data"
            }))
            .await?;
        }
        "tgz" | "gz" => {
            let tar_gz = File::open(path)?;
            let tar = GzDecoder::new(tar_gz);
            let mut archive = Archive::new(tar);
            archive.unpack(&vsc_path)?;
        }
        _ => {}
    }

    Ok(code_cli_binary(&vsc_path).to_str().unwrap().to_owned())
}
