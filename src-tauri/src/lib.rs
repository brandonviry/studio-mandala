#[cfg(feature = "e2e")]
use serde::Serialize;

#[cfg(feature = "e2e")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct E2eFilePaths {
    project: String,
    png2048: String,
    png4096: String,
}

#[cfg(feature = "e2e")]
#[derive(Serialize)]
struct PngArtifact {
    exists: bool,
    width: u32,
    height: u32,
}

#[cfg(feature = "e2e")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct E2eArtifactState {
    project_exists: bool,
    png2048: PngArtifact,
    png4096: PngArtifact,
}

#[cfg(feature = "e2e")]
fn e2e_paths() -> Result<E2eFilePaths, String> {
    use std::sync::OnceLock;

    static READY: OnceLock<Result<(), String>> = OnceLock::new();
    let temp_root = std::env::temp_dir()
        .canonicalize()
        .map_err(|error| format!("résolution du dossier temporaire impossible : {error}"))?;
    let root = temp_root.join("mandala-e2e");
    READY
        .get_or_init(|| {
            if root.exists() {
                let resolved = root
                    .canonicalize()
                    .map_err(|error| format!("résolution du dossier E2E impossible : {error}"))?;
                if resolved.parent() != Some(temp_root.as_path())
                    || resolved.file_name().and_then(|name| name.to_str()) != Some("mandala-e2e")
                {
                    return Err(format!(
                        "refus de supprimer un chemin E2E inattendu : {}",
                        resolved.display()
                    ));
                }
                std::fs::remove_dir_all(&root)
                    .map_err(|error| format!("nettoyage E2E impossible : {error}"))?;
            }
            std::fs::create_dir_all(&root)
                .map_err(|error| format!("création du dossier E2E impossible : {error}"))
        })
        .clone()?;

    Ok(E2eFilePaths {
        project: root
            .join("project.mandala.json")
            .to_string_lossy()
            .into_owned(),
        png2048: root.join("mandala-2048.png").to_string_lossy().into_owned(),
        png4096: root.join("mandala-4096.png").to_string_lossy().into_owned(),
    })
}

#[cfg(feature = "e2e")]
fn inspect_png(path: &str) -> PngArtifact {
    let Ok(bytes) = std::fs::read(path) else {
        return PngArtifact {
            exists: false,
            width: 0,
            height: 0,
        };
    };
    let signature = b"\x89PNG\r\n\x1a\n";
    if bytes.len() < 24 || &bytes[..8] != signature || &bytes[12..16] != b"IHDR" {
        return PngArtifact {
            exists: true,
            width: 0,
            height: 0,
        };
    }
    PngArtifact {
        exists: true,
        width: u32::from_be_bytes(bytes[16..20].try_into().unwrap_or_default()),
        height: u32::from_be_bytes(bytes[20..24].try_into().unwrap_or_default()),
    }
}

#[cfg(feature = "e2e")]
#[tauri::command]
fn e2e_file_paths() -> Result<E2eFilePaths, String> {
    e2e_paths()
}

#[cfg(feature = "e2e")]
#[tauri::command]
fn e2e_artifact_state() -> Result<E2eArtifactState, String> {
    let paths = e2e_paths()?;
    Ok(E2eArtifactState {
        project_exists: std::path::Path::new(&paths.project).is_file(),
        png2048: inspect_png(&paths.png2048),
        png4096: inspect_png(&paths.png4096),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio::init())
        .plugin(tauri_plugin_wdio_webdriver::init())
        .invoke_handler(tauri::generate_handler![e2e_file_paths, e2e_artifact_state]);

    builder
        .run(tauri::generate_context!())
        .expect("échec au démarrage de Studio Mandala");
}
