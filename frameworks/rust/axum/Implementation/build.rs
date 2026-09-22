//! The versions /__meta reports, read when the binary is built: the crates as Cargo.lock resolved
//! them, and the compiler.

use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=Cargo.lock");
    let lock = std::fs::read_to_string("Cargo.lock").expect("Cargo.lock is beside Cargo.toml");
    for (name, variable) in [("axum", "RB_AXUM_VERSION"), ("serde_json", "RB_SERDE_JSON_VERSION")] {
        let version = locked(&lock, name).unwrap_or_else(|| panic!("Cargo.lock has no {name}"));
        println!("cargo:rustc-env={variable}={version}");
    }
    let rustc = std::env::var("RUSTC").unwrap_or_else(|_| "rustc".to_owned());
    let output = Command::new(rustc).arg("--version").output().expect("rustc runs");
    println!("cargo:rustc-env=RB_RUSTC_VERSION={}", String::from_utf8_lossy(&output.stdout).trim());
}

/// The version on the line after `name = "<name>"`, which is how Cargo.lock writes a package.
fn locked(lock: &str, name: &str) -> Option<String> {
    let mut lines = lock.lines();
    lines.find(|line| *line == format!("name = \"{name}\""))?;
    let version = lines.next()?.strip_prefix("version = \"")?.strip_suffix('"')?;
    Some(version.to_owned())
}
