use anyhow::Result;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug)]
struct EnvironmentStatus {
    node_version: Option<String>,
    npm_version: Option<String>,
    zowe_cli_version: Option<String>,
    vscode_version: Option<String>,
    git_status: Option<String>,
    workspace_path: PathBuf,
    dependencies_installed: bool,
}

impl EnvironmentStatus {
    fn new() -> Self {
        Self {
            node_version: None,
            npm_version: None,
            zowe_cli_version: None,
            vscode_version: None,
            git_status: None,
            workspace_path: std::env::current_dir().unwrap_or_default(),
            dependencies_installed: false,
        }
    }

    fn check_node(&mut self) -> Result<()> {
        let output = Command::new("node").arg("--version").output()?;
        if output.status.success() {
            self.node_version = Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }
        Ok(())
    }

    fn check_npm(&mut self) -> Result<()> {
        let output = Command::new("npm").arg("--version").output()?;
        if output.status.success() {
            self.npm_version = Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }
        Ok(())
    }

    fn check_zowe_cli(&mut self) -> Result<()> {
        let output = Command::new("zowe").arg("--version").output()?;
        if output.status.success() {
            self.zowe_cli_version =
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }
        Ok(())
    }

    fn check_vscode(&mut self) -> Result<()> {
        let output = Command::new("code").arg("--version").output()?;
        if output.status.success() {
            self.vscode_version = Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }
        Ok(())
    }

    fn check_git_status(&mut self) -> Result<()> {
        let output = Command::new("git")
            .arg("status")
            .arg("--porcelain")
            .output()?;
        if output.status.success() {
            let status = String::from_utf8_lossy(&output.stdout);
            if !status.trim().is_empty() {
                self.git_status = Some(status.trim().to_string());
            }
        }
        Ok(())
    }

    fn check_dependencies(&mut self) -> Result<()> {
        self.dependencies_installed = self.workspace_path.join("node_modules").exists();
        Ok(())
    }
}

pub async fn handle_cmd(verbose: bool) -> Result<()> {
    let mut status = EnvironmentStatus::new();

    // Collect all status information
    status.check_node()?;
    status.check_npm()?;
    status.check_zowe_cli()?;
    status.check_vscode()?;
    status.check_git_status()?;
    status.check_dependencies()?;

    // Print status information
    println!("Zowe Explorer Development Environment Status");
    println!("==========================================");

    println!("\nCore Requirements:");
    println!("-----------------");
    println!(
        "Node.js: {}",
        status.node_version.as_deref().unwrap_or("Not found")
    );
    println!(
        "npm: {}",
        status.npm_version.as_deref().unwrap_or("Not found")
    );
    println!(
        "Zowe CLI: {}",
        status.zowe_cli_version.as_deref().unwrap_or("Not found")
    );
    println!(
        "VS Code: {}",
        status.vscode_version.as_deref().unwrap_or("Not found")
    );

    println!("\nWorkspace Status:");
    println!("----------------");
    println!("Path: {}", status.workspace_path.display());
    println!(
        "Dependencies: {}",
        if status.dependencies_installed {
            "Installed"
        } else {
            "Not installed"
        }
    );

    if let Some(git_status) = status.git_status {
        println!("\nGit Status:");
        println!("-----------");
        println!("{}", git_status);
    }

    if verbose {
        println!("\nDetailed Information:");
        println!("-------------------");
        // Add more detailed information here
        // - List of installed extensions
        // - Build configuration
        // - Environment variables
        // - System information
    }

    Ok(())
}
