use std::path::PathBuf;

use glob::glob;

pub fn trim_newline(line: &mut String) {
    if let Some('\n') = line.chars().next_back() {
        line.pop();
    }
    if let Some('\r') = line.chars().next_back() {
        line.pop();
    }
}

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
