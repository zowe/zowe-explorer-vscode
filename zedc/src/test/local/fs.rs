use owo_colors::OwoColorize;

pub fn install_from_paths(_vsc_dir: String, files: Vec<String>) {
    let resolved_paths = resolve_paths(files);
    if resolved_paths.is_empty() {
        println!(
            "{}",
            "At least one .vsix or .tgz file is required for this command.".red()
        );
        return;
    }
    println!("✔️ {} file(s) found!", resolved_paths.len());
}

pub fn resolve_paths(files: Vec<String>) -> Vec<String> {
    println!("🔍 Locating VSIX files...");
    files
        .iter()
        .filter_map(|f| match std::fs::canonicalize(f) {
            Ok(p) => Some(p.to_str().unwrap().to_owned()),
            Err(e) => {
                println!("\t❌ {}", format!("skipping {}: {}", f, e).italic());
                None
            }
        })
        .collect::<Vec<_>>()
}
