use crate::cmd;
use crate::util;
use anyhow::Result;
use glob::glob;
use indicatif::{ProgressBar, ProgressStyle};
use owo_colors::OwoColorize;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::Command;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::thread;
use supports_hyperlinks::Stream;

/// Run the coverage check command
pub fn run_coverage_check(verbose: bool, filter: Option<String>) -> Result<()> {
    let repo_root_pathbuf = match util::find_dir_match(&["package.json"]) {
        Ok(Some(d)) => d,
        Ok(None) => anyhow::bail!("Could not find a repo folder containing package.json (used for resolving coverage paths)."),
        Err(e) => anyhow::bail!("Error finding repo folder: {}", e),
    };

    std::env::set_current_dir(repo_root_pathbuf)?;

    // Get changed files and lines from git diff
    let (mut changed_lines, initial_total_lines_in_patch, repo_root_pathbuf) =
        get_changed_files_and_lines(verbose)?;

    if changed_lines.is_empty() {
        println!(
            "{}",
            "No changes detected compared to main branch.".yellow()
        );
        return Ok(());
    }

    if initial_total_lines_in_patch == 0 {
        println!(
            "{}",
            "No effectively changed lines found in the diff to check for coverage.".yellow()
        );
        return Ok(());
    }

    // If filter is provided, filter the changed_lines to only include files from that package
    let filtered_total_lines: usize;
    if let Some(pkg) = &filter {
        let package_path = format!("packages/{}/", pkg);

        // Count lines to be removed for accurate stats
        let mut lines_to_remove = 0;
        let files_to_remove: Vec<String> = changed_lines
            .keys()
            .filter(|file| !file.starts_with(&package_path) || file.contains("__tests__"))
            .cloned()
            .collect();

        for file in &files_to_remove {
            if let Some(lines) = changed_lines.get(file) {
                lines_to_remove += lines.len();
            }
        }

        // Remove files not in the filtered package or containing __tests__
        for file in files_to_remove {
            changed_lines.remove(&file);
        }

        filtered_total_lines = initial_total_lines_in_patch - lines_to_remove;

        if verbose {
            println!(
                "Debug - Filtered changed files to only include package '{}' and exclude '__tests__'. {} of {} lines remain.",
                pkg, filtered_total_lines, initial_total_lines_in_patch
            );
        }

        if filtered_total_lines == 0 {
            println!(
                "{}",
                format!(
                    "No changed lines found in package '{}' to check for coverage.",
                    pkg
                )
                .yellow()
            );
            return Ok(());
        }
    } else {
        // Exclude files containing __tests__ if no package filter is provided
        let mut lines_to_remove = 0;
        let files_to_remove: Vec<String> = changed_lines
            .keys()
            .filter(|file| file.contains("__tests__"))
            .cloned()
            .collect();

        for file in &files_to_remove {
            if let Some(lines) = changed_lines.get(file) {
                lines_to_remove += lines.len();
            }
        }

        // Remove files containing __tests__
        for file in files_to_remove {
            changed_lines.remove(&file);
        }

        filtered_total_lines = initial_total_lines_in_patch - lines_to_remove;

        if verbose {
            println!(
                "Debug - Excluded '__tests__' files. {} of {} lines remain.",
                filtered_total_lines, initial_total_lines_in_patch
            );
        }

        if filtered_total_lines == 0 {
            println!(
                "{}",
                "No changed lines found (excluding '__tests__') to check for coverage.".yellow()
            );
            return Ok(());
        }
    }

    // Run the tests with coverage
    let display_text = match &filter {
        Some(pkg) => format!("Running unit tests with coverage for package '{}'...", pkg),
        None => "Running unit tests with coverage for all packages...".to_string(),
    };
    println!("{}", display_text.blue());

    let (test_success, stdout_lines, stderr_lines) = run_tests(filter.clone())?;

    if !test_success {
        println!("pnpm test stdout:");
        for line in stdout_lines.iter() {
            println!("{}", line);
        }
        println!("pnpm test stderr:");
        for line in stderr_lines.iter() {
            eprintln!("{}", line);
        }
        anyhow::bail!("pnpm test failed.");
    }

    // Process coverage reports
    println!("{}", "\nProcessing coverage reports...".blue());
    let (_covered_lines_in_patch, uncovered_lines_details) =
        process_coverage_reports(&changed_lines, &repo_root_pathbuf, verbose, &filter)?;

    // Display results
    display_coverage_results(filtered_total_lines, &uncovered_lines_details, verbose)
}

/// Get the changed files and lines from git diff
fn get_changed_files_and_lines(
    verbose: bool,
) -> Result<(HashMap<String, Vec<usize>>, usize, PathBuf)> {
    // Get current branch name
    let current_branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()?;
    let _current_branch = String::from_utf8_lossy(&current_branch_output.stdout)
        .trim()
        .to_string();

    // Get list of changed files with their changed lines
    let changed_files = Command::new("git")
        .args(["diff", "--unified=0", "main"])
        .output()?;
    let changed_files = String::from_utf8_lossy(&changed_files.stdout);

    if verbose {
        println!("\nDebug - Raw diff output:");
        println!("{}", changed_files);
    }

    // Attempt to find the repository root.
    let repo_root_pathbuf = match util::find_dir_match(&["package.json"]) {
        Ok(Some(d)) => d,
        Ok(None) => anyhow::bail!("Could not find a repo folder containing package.json (used for resolving coverage paths)."),
        Err(e) => anyhow::bail!("Error finding repo folder: {}", e),
    };

    if verbose {
        println!("Debug - Determined repo root: {:?}", repo_root_pathbuf);
    }

    // Parse the diff output to get changed files and their line numbers
    let mut changed_lines: HashMap<String, Vec<usize>> = HashMap::new();
    let mut current_file = String::new();
    let mut current_file_content_lines: Option<Vec<String>> = None;

    for line in changed_files.lines() {
        if line.starts_with("+++ b/") {
            current_file = line[6..].to_string();
            current_file_content_lines = None;

            if current_file.starts_with("zedc/") // Exclude zedc changes
                || current_file.ends_with(".test.ts") // Exclude test files and non-TS files
                || !current_file.ends_with(".ts")
            {
                if verbose {
                    println!("\nDebug - Ignoring internal or test file: {}", current_file);
                }
                current_file = String::new();
                continue;
            }
            if verbose {
                println!("\nDebug - Found changed file: {}", current_file);
            }

            // Read the content of the current file to check for empty lines
            let file_path_to_read = repo_root_pathbuf.join(&current_file);
            match fs::read_to_string(&file_path_to_read) {
                Ok(content) => {
                    current_file_content_lines = Some(content.lines().map(String::from).collect());
                    if verbose {
                        println!(
                            "Debug - Successfully read file {} for empty line checking.",
                            current_file
                        );
                    }
                }
                Err(e) => {
                    if verbose {
                        eprintln!("Warning: Could not read file {} to check for empty lines: {}. Empty line check will be skipped for this file's hunks.", current_file, e);
                    }
                }
            }
        } else if line.starts_with("@@") {
            if current_file.is_empty() {
                continue;
            }
            // Parse the line numbers from the hunk header
            parse_hunk_header(
                line,
                &current_file,
                &mut changed_lines,
                &current_file_content_lines,
                verbose,
            );
        }
    }

    if verbose {
        println!("\nDebug - Changed lines map (after full hunk parsing):");
        for (file, lines) in &changed_lines {
            println!("File: {}, Lines: {:?}", file, lines);
        }
    }

    // Calculate total_lines_in_patch from all identified changed lines
    let mut initial_total_lines_in_patch = 0;
    for lines in changed_lines.values() {
        initial_total_lines_in_patch += lines.len();
    }

    Ok((
        changed_lines,
        initial_total_lines_in_patch,
        repo_root_pathbuf,
    ))
}

/// Check if a line is inside a block comment
fn is_line_in_block_comment(file_content_lines: &[String], line_index: usize) -> bool {
    let mut in_block_comment = false;

    // Check all lines up to and including the target line
    for (idx, line) in file_content_lines.iter().enumerate() {
        if idx > line_index {
            break;
        }

        let mut chars = line.chars().peekable();
        let mut in_string = false;
        let mut escape_next = false;
        let mut line_has_block_comment_close = false;
        let mut line_has_block_comment_open = false;
        let line_in_block_comment = in_block_comment;

        while let Some(ch) = chars.next() {
            if escape_next {
                escape_next = false;
                continue;
            }

            if ch == '\\' && in_string {
                escape_next = true;
                continue;
            }

            if ch == '"' && !in_block_comment {
                in_string = !in_string;
                continue;
            }

            if in_string {
                continue;
            }

            if !in_block_comment && ch == '/' {
                if let Some(&'*') = chars.peek() {
                    chars.next(); // consume '*'
                    in_block_comment = true;
                    line_has_block_comment_open = true;
                    continue;
                }
                if let Some(&'/') = chars.peek() {
                    // Single line comment - rest of line is comment
                    break;
                }
            }

            if in_block_comment && ch == '*' {
                if let Some(&'/') = chars.peek() {
                    chars.next(); // consume '/'
                    in_block_comment = false;
                    line_has_block_comment_close = true;
                    continue;
                }
            }
        }

        // If we're at the target line, return true if:
        // 1. The line is within a block comment, OR
        // 2. The line contains an opening /*, OR
        // 3. The line contains a closing */
        if idx == line_index
            && (line_in_block_comment
                || line_has_block_comment_open
                || line_has_block_comment_close)
        {
            return true;
        }
    }

    false
}

/// Check if a line is entirely a comment (single-line or block comment on same line)
fn is_line_entirely_comment(line_content: &str) -> bool {
    let trimmed = line_content.trim();

    // Check for single-line comment
    if trimmed.starts_with("//") {
        return true;
    }

    // Check for single-line block comment
    if trimmed.starts_with("/*") && trimmed.ends_with("*/") && trimmed.len() > 3 {
        return true;
    }

    false
}

/// Parse a hunk header from git diff and extract line numbers
fn parse_hunk_header(
    line: &str,
    current_file: &str,
    changed_lines: &mut HashMap<String, Vec<usize>>,
    current_file_content_lines: &Option<Vec<String>>,
    verbose: bool,
) {
    // Parse the line numbers from the hunk header `@@ -old_start,old_count +new_start,new_count @@ ...`
    if let Some(hunk_details) = line.split("@@").nth(1) {
        // " -1,5 +1,7 "
        if let Some(new_hunk_part_str) = hunk_details
            .trim()
            .split_whitespace()
            .find(|s| s.starts_with('+'))
        {
            // "+1,7"
            let new_hunk_info = new_hunk_part_str.trim_start_matches('+'); // "1,7" or "1"

            let mut new_hunk_parts = new_hunk_info.split(',');
            if let Some(start_line_str) = new_hunk_parts.next() {
                if let Ok(start_line) = start_line_str.parse::<usize>() {
                    // Default count is 1 if not specified
                    let count_str = new_hunk_parts.next().unwrap_or("1");
                    if let Ok(count) = count_str.parse::<usize>() {
                        if count > 0 {
                            // Process only if there are lines in the new hunk
                            for i in 0..count {
                                let line_to_add = start_line + i;
                                let mut should_skip_line = false;

                                if let Some(ref lines_vec) = current_file_content_lines {
                                    let line_index_to_check = line_to_add - 1;
                                    if line_index_to_check < lines_vec.len() {
                                        let line_content_trimmed =
                                            lines_vec[line_index_to_check].trim();
                                        if line_content_trimmed.is_empty() {
                                            should_skip_line = true;
                                            if verbose {
                                                println!("Debug - Skipping empty/whitespace line {} in file {}", line_to_add, current_file);
                                            }
                                        } else if is_line_entirely_comment(
                                            &lines_vec[line_index_to_check],
                                        ) {
                                            should_skip_line = true;
                                            if verbose {
                                                println!(
                                                    "Debug - Skipping single-line comment line {} in file {}",
                                                    line_to_add, current_file
                                                );
                                            }
                                        } else if is_line_in_block_comment(
                                            lines_vec,
                                            line_index_to_check,
                                        ) {
                                            should_skip_line = true;
                                            if verbose {
                                                println!(
                                                    "Debug - Skipping block comment line {} in file {}",
                                                    line_to_add, current_file
                                                );
                                            }
                                        }
                                    } else if verbose {
                                        println!("Debug - Line index {} out of bounds for file {} ({} lines read). Treating as non-empty.", line_index_to_check, current_file, lines_vec.len());
                                    }
                                } else if verbose {
                                    println!("Debug - Empty line check skipped for line {} in file {} (file content not available).", line_to_add, current_file);
                                }

                                if !should_skip_line {
                                    if verbose {
                                        println!(
                                            "Debug - Adding line {} from {} to changed_lines",
                                            line_to_add, current_file
                                        );
                                    }
                                    changed_lines
                                        .entry(current_file.to_string())
                                        .or_default()
                                        .push(line_to_add);
                                }
                            }
                        }
                    } else if verbose {
                        eprintln!(
                            "Warning: Could not parse hunk count from '{}' in line: {}",
                            count_str, line
                        );
                    }
                } else if verbose {
                    eprintln!(
                        "Warning: Could not parse hunk start line from '{}' in line: {}",
                        start_line_str, line
                    );
                }
            }
        }
    }
}

/// Run the tests with coverage
fn run_tests(filter: Option<String>) -> Result<(bool, Vec<String>, Vec<String>)> {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} {msg}")
            .unwrap(),
    );

    pb.enable_steady_tick(std::time::Duration::from_millis(120));

    // Run pnpm test
    let mut pnpm_test_cmd = cmd::as_binary("pnpm");

    // If filter is provided, use --filter instead of -r
    match &filter {
        Some(pkg) => {
            let pkg_actual_name = if pkg == "zowe-explorer" {
                "vscode-extension-for-zowe"
            } else {
                pkg
            };
            let msg = format!("Executing pnpm --filter {} test...", pkg_actual_name);
            pb.set_message(msg);
            pnpm_test_cmd.args(["--filter", pkg_actual_name, "test"]);
        }
        None => {
            let msg = "Executing pnpm -r test...".to_string();
            pb.set_message(msg);
            pnpm_test_cmd.args(["-r", "test"]);
        }
    }

    pnpm_test_cmd.stdout(Stdio::piped());
    pnpm_test_cmd.stderr(Stdio::piped());

    let mut child = pnpm_test_cmd.spawn()?;

    let stdout_reader = BufReader::new(child.stdout.take().unwrap());
    let stderr_reader = BufReader::new(child.stderr.take().unwrap());

    let (stdout_lines, stderr_lines) = (
        Arc::new(Mutex::new(Vec::new())),
        Arc::new(Mutex::new(Vec::new())),
    );
    let (stdout_lines_clone, stderr_lines_clone) = (stdout_lines.clone(), stderr_lines.clone());

    let pb_clone_stdout = pb.clone();
    let stdout_thread = thread::spawn(move || {
        process_stdout(stdout_reader, &pb_clone_stdout, &stdout_lines_clone);
    });

    let pb_clone_stderr = pb.clone();
    let stderr_thread = thread::spawn(move || {
        process_stderr(stderr_reader, &pb_clone_stderr, &stderr_lines_clone);
    });

    stdout_thread.join().unwrap();
    stderr_thread.join().unwrap();

    let status = child.wait()?;

    if !status.success() {
        pb.finish_with_message(format!("{} {}", "✗".red(), "Tests failed".bold().red()));
        Ok((
            false,
            Arc::try_unwrap(stdout_lines).unwrap().into_inner().unwrap(),
            Arc::try_unwrap(stderr_lines).unwrap().into_inner().unwrap(),
        ))
    } else {
        pb.finish_with_message(format!("{} {}", "✓".green(), "Tests passed".bold().green()));
        Ok((
            true,
            Arc::try_unwrap(stdout_lines).unwrap().into_inner().unwrap(),
            Arc::try_unwrap(stderr_lines).unwrap().into_inner().unwrap(),
        ))
    }
}

/// Process stdout from test commands
fn process_stdout<R: BufRead>(
    reader: R,
    progress_bar: &ProgressBar,
    lines: &Arc<Mutex<Vec<String>>>,
) {
    for line_result in reader.lines() {
        if let Ok(line) = line_result {
            if let Some(pass_idx) = line.rfind("PASS") {
                let display_line = if let Some(path_part) = line
                    .get(pass_idx + 4..)
                    .and_then(|s| s.split_whitespace().next())
                {
                    format!("✓ PASS {}", path_part)
                } else {
                    format!(
                        "✓ {}",
                        line.trim_start_matches(|c: char| c != ':')
                            .trim_start_matches(':')
                            .trim()
                    )
                };
                progress_bar.set_message(display_line);
            } else if let Some(fail_idx) = line.rfind("FAIL") {
                let display_line = if let Some(path_part) = line
                    .get(fail_idx + 4..)
                    .and_then(|s| s.split_whitespace().next())
                {
                    format!("✗ FAIL {}", path_part)
                } else {
                    format!(
                        "✗ {}",
                        line.trim_start_matches(|c: char| c != ':')
                            .trim_start_matches(':')
                            .trim()
                    )
                };
                progress_bar.set_message(display_line);
            }
            lines.lock().unwrap().push(line);
        }
    }
}

/// Process stderr from test commands
fn process_stderr<R: BufRead>(
    reader: R,
    progress_bar: &ProgressBar,
    lines: &Arc<Mutex<Vec<String>>>,
) {
    for line_result in reader.lines() {
        if let Ok(line) = line_result {
            if line.contains("FAIL") {
                if let Some(fail_idx) = line.rfind("FAIL") {
                    let display_line = if let Some(path_part) = line
                        .get(fail_idx + 4..)
                        .and_then(|s| s.split_whitespace().next())
                    {
                        format!("✗ FAIL {}", path_part)
                    } else {
                        format!(
                            "✗ {}",
                            line.trim_start_matches(|c: char| c != ':')
                                .trim_start_matches(':')
                                .trim()
                        )
                    };
                    progress_bar.set_message(display_line);
                }
            }
            lines.lock().unwrap().push(line);
        }
    }
}

/// Process coverage reports and compare with changed lines
fn process_coverage_reports(
    changed_lines: &HashMap<String, Vec<usize>>,
    repo_root_pathbuf: &PathBuf,
    verbose: bool,
    filter: &Option<String>,
) -> Result<(usize, HashMap<String, Vec<usize>>)> {
    let mut covered_lines_in_patch = 0;
    let mut uncovered_lines_details: HashMap<String, Vec<usize>> = HashMap::new();

    // Find coverage-final.json files, applying filter if provided
    let coverage_files_pattern = match filter {
        Some(pkg) => repo_root_pathbuf.join(format!(
            "packages/{}/results/unit/coverage/coverage-final.json",
            pkg
        )),
        None => repo_root_pathbuf.join("packages/*/results/unit/coverage/coverage-final.json"),
    };

    if verbose {
        println!(
            "Debug - Searching for coverage files with pattern: {:?}",
            coverage_files_pattern
        );
    }

    for entry in glob(coverage_files_pattern.to_str().unwrap_or(""))? {
        match entry {
            Ok(coverage_file_path) => {
                process_coverage_file(
                    coverage_file_path,
                    changed_lines,
                    repo_root_pathbuf,
                    &mut covered_lines_in_patch,
                    &mut uncovered_lines_details,
                    verbose,
                )?;
            }
            Err(e) => {
                if verbose {
                    eprintln!("Error accessing coverage file: {}", e)
                }
            }
        }
    }

    Ok((covered_lines_in_patch, uncovered_lines_details))
}

/// Process a single coverage file
fn process_coverage_file(
    coverage_file_path: PathBuf,
    changed_lines: &HashMap<String, Vec<usize>>,
    repo_root_pathbuf: &PathBuf,
    covered_lines_in_patch: &mut usize,
    uncovered_lines_details: &mut HashMap<String, Vec<usize>>,
    verbose: bool,
) -> Result<()> {
    if verbose {
        println!("\nProcessing coverage file: {:?}", coverage_file_path);
    }

    if !coverage_file_path.exists() {
        if verbose {
            println!(
                "Warning: Coverage file not found at {:?}, skipping.",
                coverage_file_path
            );
        }
        return Ok(());
    }

    let package_coverage_report_str = fs::read_to_string(&coverage_file_path)?;
    if package_coverage_report_str.trim().is_empty() {
        if verbose {
            println!(
                "Warning: Coverage file {:?} is empty, skipping.",
                coverage_file_path
            );
        }
        return Ok(());
    }

    let package_coverage_data: serde_json::Value =
        match serde_json::from_str(&package_coverage_report_str) {
            Ok(data) => data,
            Err(e) => {
                if verbose {
                    eprintln!(
                        "Error parsing JSON from {:?}: {}. Skipping file.",
                        coverage_file_path, e
                    );
                }
                return Ok(());
            }
        };

    // Determine the package's own root directory from the coverage file path
    let current_package_repo_relative_path_str =
        get_package_relative_path(&coverage_file_path, repo_root_pathbuf, verbose)?;

    if current_package_repo_relative_path_str.is_empty() {
        if verbose {
            eprintln!("Warning: Could not determine package relative path for {:?}, skipping coverage checks for this file.", coverage_file_path);
        }
        return Ok(());
    }

    // Process each changed file for this package
    for (file_from_diff, lines_in_diff) in changed_lines {
        if !file_from_diff.starts_with(&current_package_repo_relative_path_str) {
            continue;
        }

        if verbose {
            println!(
                "\nDebug - Checking coverage for changed file (in context of package {}): {}",
                current_package_repo_relative_path_str, file_from_diff
            );
        }

        check_file_coverage(
            file_from_diff,
            lines_in_diff,
            repo_root_pathbuf,
            &package_coverage_data,
            covered_lines_in_patch,
            uncovered_lines_details,
            verbose,
        );
    }

    Ok(())
}

/// Get the relative path of a package from the repo root
fn get_package_relative_path(
    coverage_file_path: &PathBuf,
    repo_root_pathbuf: &PathBuf,
    verbose: bool,
) -> Result<String> {
    let mut current_package_repo_relative_path_str = String::new();

    if let Some(package_folder_from_coverage_path) = coverage_file_path
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
    {
        if let Ok(relative_to_repo) =
            package_folder_from_coverage_path.strip_prefix(repo_root_pathbuf)
        {
            current_package_repo_relative_path_str =
                relative_to_repo.to_string_lossy().replace('\\', "/");
            if verbose {
                println!(
                    "Debug - Deduced package relative path: {}",
                    current_package_repo_relative_path_str
                );
            }
        }
    }

    Ok(current_package_repo_relative_path_str)
}

/// Check coverage for a specific file
fn check_file_coverage(
    file_from_diff: &str,
    lines_in_diff: &Vec<usize>,
    repo_root_pathbuf: &PathBuf,
    package_coverage_data: &serde_json::Value,
    covered_lines_in_patch: &mut usize,
    uncovered_lines_details: &mut HashMap<String, Vec<usize>>,
    verbose: bool,
) {
    let changed_file_rel_path_from_repo_root = file_from_diff;

    if verbose {
        println!(
            "Debug - Attempting to find coverage for {}",
            changed_file_rel_path_from_repo_root
        );
    }

    let (file_coverage_data, matched_coverage_path) = find_coverage_data(
        package_coverage_data,
        changed_file_rel_path_from_repo_root,
        repo_root_pathbuf,
        verbose,
    );

    match file_coverage_data {
        Some(file_cov) => {
            if verbose {
                println!(
                    "Debug - Found coverage data for {} (matched as {})",
                    changed_file_rel_path_from_repo_root, matched_coverage_path
                );
            }

            process_file_statements(
                file_cov,
                lines_in_diff,
                file_from_diff,
                changed_file_rel_path_from_repo_root,
                covered_lines_in_patch,
                uncovered_lines_details,
                verbose,
            );
        }
        None => {
            if verbose {
                println!(
                    "Warning: No coverage data found for changed file {}. Lines from this file considered uncovered.",
                    changed_file_rel_path_from_repo_root
                );
                if let Some(map) = package_coverage_data.as_object() {
                    let keys: Vec<&String> = map.keys().collect();
                    println!("Debug - Coverage map top-level keys: {:?}", keys);
                    if let Some(coverage_map) = map.get("coverageMap").and_then(|m| m.as_object()) {
                        let nested_keys: Vec<&String> = coverage_map.keys().collect();
                        println!("Debug - 'coverageMap' nested keys: {:?}", nested_keys);
                    }
                }
            }
            // All lines in this diff for this file are considered uncovered
            for line_num in lines_in_diff {
                if verbose {
                    println!(
                        "Debug - Line {} in {} is NOT COVERED (file not in report)",
                        line_num, changed_file_rel_path_from_repo_root
                    );
                }
                uncovered_lines_details
                    .entry(file_from_diff.to_string())
                    .or_default()
                    .push(*line_num);
            }
        }
    }
}

/// Find the coverage data for a file
fn find_coverage_data<'a>(
    package_coverage_data: &'a serde_json::Value,
    changed_file_rel_path: &str,
    repo_root: &PathBuf,
    verbose: bool,
) -> (Option<&'a serde_json::Value>, String) {
    let coverage_map = package_coverage_data
        .get("coverageMap")
        .and_then(|v| v.as_object())
        .or_else(|| package_coverage_data.as_object());

    // Construct a normalized, absolute path for the file from the git diff.
    let mut changed_file_abs_path = repo_root.clone();
    for component in changed_file_rel_path.split('/') {
        changed_file_abs_path.push(component);
    }

    if let Some(map) = coverage_map {
        for file_cov_data in map.values() {
            if let Some(path_from_report_str) = file_cov_data.get("path").and_then(|p| p.as_str()) {
                let report_path = PathBuf::from(path_from_report_str);

                // Compare the path from the report with the one we constructed.
                // PathBuf's equality handles OS-specific details.
                if report_path == changed_file_abs_path {
                    return (Some(file_cov_data), path_from_report_str.to_string());
                }
            }
        }
    }

    if verbose {
        println!(
            "Debug - Failed to find coverage. Constructed path for comparison: {:?}",
            changed_file_abs_path
        );
    }

    (None, String::new())
}

/// Process statements in a file's coverage data
fn process_file_statements(
    file_cov: &serde_json::Value,
    lines_in_diff: &[usize],
    file_from_diff: &str,
    changed_file_rel_path: &str,
    covered_lines_in_patch: &mut usize,
    uncovered_lines_details: &mut HashMap<String, Vec<usize>>,
    verbose: bool,
) {
    let statement_map = file_cov.get("statementMap").and_then(|sm| sm.as_object());
    let s_map = file_cov.get("s").and_then(|s| s.as_object());
    let branch_map = file_cov.get("branchMap").and_then(|bm| bm.as_object());
    let b_map = file_cov.get("b").and_then(|b| b.as_object());

    let mut executable_lines = std::collections::HashSet::new();
    if let Some(stmt_map) = statement_map {
        for stmt_data in stmt_map.values() {
            if let (Some(start_line), Some(end_line)) = (
                stmt_data
                    .get("start")
                    .and_then(|l| l.get("line"))
                    .and_then(|l| l.as_u64()),
                stmt_data
                    .get("end")
                    .and_then(|l| l.get("line"))
                    .and_then(|l| l.as_u64()),
            ) {
                for line in start_line..=end_line {
                    executable_lines.insert(line as usize);
                }
            }
        }
    }

    let mut uncovered_lines = std::collections::HashSet::new();

    if let (Some(stmt_map), Some(s)) = (statement_map, s_map) {
        for (stmt_idx, stmt_data) in stmt_map {
            if let Some(count) = s.get(stmt_idx).and_then(|c| c.as_u64()) {
                if count == 0 {
                    if let (Some(start_line), Some(end_line)) = (
                        stmt_data
                            .get("start")
                            .and_then(|l| l.get("line"))
                            .and_then(|l| l.as_u64()),
                        stmt_data
                            .get("end")
                            .and_then(|l| l.get("line"))
                            .and_then(|l| l.as_u64()),
                    ) {
                        for line in start_line..=end_line {
                            uncovered_lines.insert(line as usize);
                        }
                    }
                }
            }
        }
    }

    if let (Some(br_map), Some(b)) = (branch_map, b_map) {
        for (branch_idx, branch_data) in br_map {
            // Check if branch is intentionally skipped
            if branch_data.get("skip").and_then(|s| s.as_bool()) == Some(true) {
                continue;
            }

            if let Some(branch_counts) = b.get(branch_idx).and_then(|bc| bc.as_array()) {
                // If any branch path has a count of 0, the branch is not fully covered.
                if branch_counts.iter().any(|count| count.as_u64() == Some(0)) {
                    // The line where the branch is defined should be marked as uncovered.
                    if let Some(line) = branch_data.get("line").and_then(|l| l.as_u64()) {
                        uncovered_lines.insert(line as usize);
                    }
                }
            }
        }
    }

    for &line_num in lines_in_diff {
        let is_executable = executable_lines.contains(&line_num);
        let is_uncovered = uncovered_lines.contains(&line_num);

        if is_executable {
            if is_uncovered {
                if verbose {
                    println!(
                        "Debug - Line {} in {} is NOT COVERED (uncovered executable code)",
                        line_num, changed_file_rel_path
                    );
                }
                uncovered_lines_details
                    .entry(file_from_diff.to_string())
                    .or_default()
                    .push(line_num);
            } else {
                if verbose {
                    println!(
                        "Debug - Line {} in {} is COVERED",
                        line_num, changed_file_rel_path
                    );
                }
                *covered_lines_in_patch += 1;
            }
        } else if verbose && is_uncovered {
            // This is for verbose logging of non-executable but uncovered lines like 'else {'
            println!(
                "Debug - Line {} in {} is part of an uncovered block, but not executable. Ignoring.",
                line_num, changed_file_rel_path
            );
        }
    }
}

/// Display coverage results
fn display_coverage_results(
    initial_total_lines_in_patch: usize,
    uncovered_lines_details: &HashMap<String, Vec<usize>>,
    verbose: bool,
) -> Result<()> {
    if initial_total_lines_in_patch == 0 {
        println!(
            "{}",
            "No relevant lines found in patch to calculate coverage against.".yellow()
        );
        return Ok(());
    }

    if verbose {
        println!(
            "Debug - Uncovered lines details map: {:?}",
            uncovered_lines_details
        );
    }

    // Display uncovered lines if any
    display_uncovered_lines(uncovered_lines_details);

    Ok(())
}

/// Display uncovered lines with content
fn display_uncovered_lines(uncovered_lines_details: &HashMap<String, Vec<usize>>) {
    if uncovered_lines_details.is_empty() {
        return;
    }

    println!("\n{}", "Uncovered lines in patch:".bold().yellow());

    for (file_path_str, line_numbers) in uncovered_lines_details {
        println!("  {}", file_path_str.dimmed());

        // Read the content of the file to display actual lines
        match fs::read_to_string(file_path_str) {
            Ok(file_content) => {
                let lines: Vec<&str> = file_content.lines().collect();
                let mut sorted_line_numbers = line_numbers.clone();
                sorted_line_numbers.sort_unstable();

                let mut previous_line_number: Option<usize> = None;

                for line_num_usize in sorted_line_numbers {
                    if let Some(prev_ln) = previous_line_number {
                        if line_num_usize > prev_ln + 1 {
                            println!("     {}", "···".dimmed());
                        }
                    }

                    let line_idx = line_num_usize - 1; // 0-indexed
                    if line_idx < lines.len() {
                        let line_content = lines[line_idx].trim();
                        // Format: <grey_line_num_padded> | <red_line_content>
                        let text = if supports_hyperlinks::on(Stream::Stdout) {
                            format!(
                                "\x1B]8;;vscode://file/{}/{}:{}\x1B\\{}  {} {}\x1B]8;;\x1B\\",
                                std::env::current_dir().unwrap().display(),
                                file_path_str,
                                line_num_usize,
                                format!("{:>3}", line_num_usize).dimmed(),
                                "│".bright_black(),
                                line_content.red()
                            )
                        } else {
                            format!(
                                "{}  {} {}",
                                format!("{:>3}", line_num_usize).dimmed(),
                                "│".bright_black(),
                                line_content.red()
                            )
                        };
                        println!("  {}", text);
                    } else {
                        // Fallback if line number is out of bounds (should not happen with correct diff parsing)
                        println!(
                            "    {}: {}",
                            line_num_usize.to_string().red(),
                            "<LINE CONTENT UNAVAILABLE - INDEX OUT OF BOUNDS>".red()
                        );
                    }
                    previous_line_number = Some(line_num_usize);
                }
            }
            Err(e) => {
                // Fallback if file cannot be read
                let mut sorted_line_numbers = line_numbers.clone();
                sorted_line_numbers.sort_unstable();
                let mut previous_line_number: Option<usize> = None;

                for line_num_usize in sorted_line_numbers {
                    if let Some(prev_ln) = previous_line_number {
                        if line_num_usize > prev_ln + 1 {
                            println!("     {}", "···".dimmed());
                        }
                    }
                    println!(
                        "    {}: {}",
                        line_num_usize.to_string().red(),
                        format!("<COULD NOT READ FILE: {}>", e).red()
                    );
                    previous_line_number = Some(line_num_usize);
                }
            }
        }
    }
}
