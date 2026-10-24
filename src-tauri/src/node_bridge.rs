use std::{path::Path, process::Command};

pub(crate) fn command(node: &Path, script: &Path) -> Command {
    // Tauri's Windows resource paths use \\?\ prefixes, which Node 22 cannot load as entry scripts.
    let mut command = Command::new(dunce::simplified(node));
    command.arg(dunce::simplified(script));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        io::Write,
        process::Stdio,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn node_loads_canonical_bridge_paths_and_preserves_arguments() {
        let directory = std::env::temp_dir().join(format!(
            "Genie bridge test ü {} {}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&directory).unwrap();
        let script = directory.join("bridge entry.cjs");
        fs::write(
            &script,
            r#"
            const fs = require('node:fs');
            console.log(JSON.stringify({
                args: process.argv.slice(2),
                input: process.argv.length === 2 ? JSON.parse(fs.readFileSync(0, 'utf8')) : null
            }));
        "#,
        )
        .unwrap();
        let script = script.canonicalize().unwrap();
        #[cfg(windows)]
        assert!(script.to_string_lossy().starts_with(r"\\?\"));
        let node = std::env::var_os("NODE_BIN").unwrap_or_else(|| "node".into());
        let output = Command::new(node)
            .args(["-p", "process.execPath"])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let node = std::path::PathBuf::from(String::from_utf8(output.stdout).unwrap().trim())
            .canonicalize()
            .unwrap();
        let override_path = r"C:\Users\Test User\OpenAI\codex.exe";
        for mode in ["--status", "--capabilities"] {
            let output = command(&node, &script)
                .args([mode, override_path])
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "{}",
                String::from_utf8_lossy(&output.stderr)
            );
            let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
            assert_eq!(value["args"], serde_json::json!([mode, override_path]));
        }
        let mut child = command(&node, &script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(br#"{"prompt":"hello"}"#)
            .unwrap();
        let output = child.wait_with_output().unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(value["input"]["prompt"], "hello");
        fs::remove_dir_all(directory).unwrap();
    }
}
