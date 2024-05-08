//! Utility module containing general helper functions.

use glob::glob;
use std::path::PathBuf;

/// Removes new line characters from the given String.
pub fn trim_newline(line: &mut String) {
    if let Some('\n') = line.chars().next_back() {
        line.pop();
    }
    if let Some('\r') = line.chars().next_back() {
        line.pop();
    }
}

/// Searches upward from the current directory for the given list of patterns.
/// 
/// # Arguments
/// * `patterns` - A `&str` slice containing the patterns to search upwards for.
pub fn find_dir_match(patterns: &[&str]) -> anyhow::Result<Option<PathBuf>> {
    let cur_dir = std::env::current_dir()?;
    let root = &cur_dir.ancestors().last().unwrap();

    let mut start_dir = cur_dir.clone();
    while start_dir != *root {
        for pattern in patterns {
            for entry in glob(start_dir.join(pattern).to_str().unwrap())? {
                match entry {
                    Ok(path) => {
                        if path.is_file() {
                            return Ok(Some(path.parent().unwrap().to_path_buf()));
                        }
                    }
                    Err(_e) => continue,
                }
            }
        }
        start_dir = match start_dir.parent() {
            Some(p) => p.to_path_buf(),
            None => break,
        };
    }

    Ok(None)
}
