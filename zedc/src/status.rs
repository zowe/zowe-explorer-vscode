use anyhow::Result;
use owo_colors::OwoColorize;
use std::path::PathBuf;
use std::process::Command;

use crate::util::find_dir_match;
use crate::{cmd, pm};

#[derive(Debug)]
struct EnvironmentStatus {
    node_version: Option<String>,
    pm_version: Option<String>,
    zowe_cli_version: Option<String>,
    vscode_version: Option<String>,
    git_status: Option<String>,
    workspace_path: PathBuf,
    dependencies_installed: bool,
    env_vars: Vec<(String, String)>,
    ze_dir: Option<PathBuf>,
    pkg_mgr: String,
    zowe_env_report: Option<String>,
}

impl EnvironmentStatus {
    fn new() -> Result<Self, anyhow::Error> {
        let workspace_path = std::env::current_dir().unwrap_or_default();
        let ze_dir = find_dir_match(&["package.json"])?.unwrap_or(workspace_path.clone());
        Ok(Self {
            node_version: None,
            pm_version: None,
            zowe_cli_version: None,
            vscode_version: None,
            git_status: None,
            workspace_path: workspace_path,
            ze_dir: Some(ze_dir.clone()),
            dependencies_installed: false,
            env_vars: Vec::new(),
            pkg_mgr: pm::detect_pkg_mgr(ze_dir.as_path())?,
            zowe_env_report: None,
        })
    }

    fn check_node(&mut self) -> Result<()> {
        match Command::new("node").arg("--version").output() {
            Ok(output) => {
                if output.status.success() {
                    self.node_version =
                        Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
                }
            }
            Err(e) => {
                eprintln!("Failed to check Node.js version: {}", e);
            }
        }
        Ok(())
    }

    fn check_dependencies(&mut self) -> Result<()> {
        match &self.ze_dir {
            Some(ze_dir) => {
                self.dependencies_installed = pm::check_dependencies(&ze_dir);
            }
            None => {
                eprintln!("Could not find a repo folder containing package.json.");
            }
        }

        Ok(())
    }

    fn check_pm(&mut self) -> Result<()> {
        match pm::handle_cmd(vec!["--version".to_owned()]) {
            Ok(output) => {
                self.pm_version = Some(output);
            }
            Err(e) => {
                eprintln!("Failed to check package manager version: {}", e);
            }
        }

        Ok(())
    }

    fn check_zowe_cli(&mut self) -> Result<()> {
        match cmd::as_binary("zowe")
            .arg("--version")
            .current_dir(&self.workspace_path)
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    self.zowe_cli_version =
                        Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
                }
            }
            Err(e) => {
                eprintln!("Failed to check Zowe CLI version: {}", e);
            }
        }
        Ok(())
    }

    fn check_vscode(&mut self) -> Result<()> {
        match cmd::as_binary("code").arg("--version").output() {
            Ok(output) => {
                if output.status.success() {
                    self.vscode_version =
                        Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
                }
            }
            Err(e) => {
                eprintln!("Failed to check VS Code version: {}", e);
            }
        }
        Ok(())
    }

    fn check_git_status(&mut self) -> Result<()> {
        match Command::new("git")
            .arg("status")
            .arg("--porcelain")
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    let status = String::from_utf8_lossy(&output.stdout);
                    if !status.trim().is_empty() {
                        self.git_status = Some(status.trim().to_string());
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to check Git status: {}", e);
            }
        }
        Ok(())
    }

    fn check_env_vars(&mut self) {
        // List of relevant environment variables to check
        let relevant_vars = [
            "ZEDC_PAT",
            "NODE_ENV",
            "HOME",
            "VSCODE_EXTENSIONS",
            "ZOWE_CLI_HOME",
            "ZOWE_OPT_USER",
            "ZOWE_OPT_PASS",
        ];

        for var in relevant_vars {
            if let Ok(value) = std::env::var(var) {
                // Mask sensitive values
                let display_value = if var.contains("PASS") || var.contains("PAT") {
                    "********".to_string()
                } else {
                    value
                };
                self.env_vars.push((var.to_string(), display_value));
            }
        }
    }

    fn check_zowe_env(&mut self) -> Result<()> {
        match cmd::as_binary("zowe")
            .args(["config", "report-env"])
            .current_dir(&self.workspace_path)
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    self.zowe_env_report =
                        Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
                }
            }
            Err(e) => {
                eprintln!("Failed to get Zowe CLI environment report: {}", e);
            }
        }
        Ok(())
    }
}

fn print_section_header(title: &str) {
    println!("\n{}", title.bold().blue());
    println!("{}", "─".repeat(title.len()).blue());
}

fn print_key_value(key: &str, value: &str) {
    println!("{}: {}", key.bold(), value);
}

fn print_key_value_multiline(key: &str, value: &str) {
    println!("{}:", key.bold());
    for line in value.lines() {
        println!("  {}", line);
    }
}

fn format_git_status(status: &str) -> String {
    status
        .lines()
        .map(|line| {
            if line.len() >= 2 {
                let (status, path) = line.split_at(2);
                let symbol = match status.trim() {
                    "M" => "●", // Modified
                    "A" => "✚", // Added
                    "D" => "✖", // Deleted
                    "R" => "↻", // Renamed
                    "C" => "⊕", // Copied
                    "U" => "⚠", // Updated but unmerged
                    "?" => "?", // Untracked
                    "!" => "!", // Ignored
                    _ => " ",   // Unknown
                };
                format!("  {} {}", symbol.bold(), path.trim())
            } else {
                format!("  {}", line)
            }
        })
        .collect::<Vec<String>>()
        .join("\n")
}

pub async fn handle_cmd(verbose: bool) -> Result<()> {
    let mut status = EnvironmentStatus::new()?;

    // Collect all status information
    status.check_node()?;
    status.check_pm()?;
    status.check_zowe_cli()?;
    if verbose {
        status.check_zowe_env()?;
    }
    status.check_vscode()?;
    status.check_git_status()?;
    status.check_dependencies()?;
    status.check_env_vars();

    // Print status information
    println!(
        "{}",
        "Zowe Explorer Development Environment Status"
            .bold()
            .green()
    );
    println!("{}", "=".repeat(40).green());

    // Runtime Environment
    print_section_header("Runtime Environment");
    print_key_value(
        "Node.js",
        status.node_version.as_deref().unwrap_or("Not found"),
    );
    print_key_value(
        &status.pkg_mgr,
        status.pm_version.as_deref().unwrap_or("Not found"),
    );
    print_key_value_multiline(
        "Zowe CLI",
        status.zowe_cli_version.as_deref().unwrap_or("Not found"),
    );

    if verbose {
        if let Some(env_report) = &status.zowe_env_report {
            print_section_header("Zowe CLI Environment");
            for line in env_report.lines() {
                println!("  {}", line.dimmed());
            }
        }
    }

    print_key_value_multiline(
        "VS Code",
        status.vscode_version.as_deref().unwrap_or("Not found"),
    );

    // Workspace Status
    print_section_header("Workspace Status");
    print_key_value("Path", &status.workspace_path.display().to_string());
    print_key_value(
        "Dependencies",
        if status.dependencies_installed {
            "Installed"
        } else {
            "Not installed"
        },
    );

    if let Some(git_status) = status.git_status {
        print_section_header("Git Status");
        println!("{}", format_git_status(&git_status));
    }

    if verbose && !status.env_vars.is_empty() {
        print_section_header("Environment Variables");
        for (key, value) in &status.env_vars {
            print_key_value(key, value);
        }
    }

    Ok(())
}
