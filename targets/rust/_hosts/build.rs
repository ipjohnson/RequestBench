//! Records what this binary was built from, so /__meta reports resolved versions rather
//! than constants kept current by hand. The Go targets read the same facts out of the
//! build info the linker embeds; Cargo has no equivalent, so the lockfile is parsed here
//! and the answers are compiled in.
use std::{env, fs, path::Path};

fn main() {
    let lock = Path::new(env!("CARGO_MANIFEST_DIR")).join("../Cargo.lock");
    println!("cargo:rerun-if-changed={}", lock.display());

    let mut rows = String::new();
    if let Ok(text) = fs::read_to_string(&lock) {
        let mut name: Option<String> = None;
        for line in text.lines() {
            let line = line.trim();
            if let Some(v) = line.strip_prefix("name = ") {
                name = Some(v.trim_matches('"').to_string());
            } else if let Some(v) = line.strip_prefix("version = ") {
                if let Some(n) = name.take() {
                    rows.push_str(&format!("    ({:?}, {:?}),\n", n, v.trim_matches('"')));
                }
            }
        }
    }

    // rustc is what the Go targets report as runtime. Read from the compiler actually
    // running, not from the image tag, because those can disagree.
    let rustc = env::var("RUSTC").unwrap_or_else(|_| "rustc".into());
    let version = std::process::Command::new(rustc)
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    let out = Path::new(&env::var("OUT_DIR").unwrap()).join("built.rs");
    fs::write(
        out,
        format!(
            "pub const RUSTC: &str = {version:?};\n\
             static LOCK: &[(&str, &str)] = &[\n{rows}];\n"
        ),
    )
    .expect("write built.rs");
}
