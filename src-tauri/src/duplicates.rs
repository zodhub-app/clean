// Fase 7 — buscador de duplicados por CONTENIDO. Estrategia segura y rápida:
//   1. Agrupar ficheros por tamaño (rapidísimo; distinto tamaño = distinto).
//   2. Solo para los tamaños compartidos, calcular SHA-256 (crate `sha2`).
//   3. Agrupar por hash → duplicados reales (mismo contenido exacto).
// Nunca borra: solo encuentra. El usuario revisa y decide (deja al menos uno).
//
// El hash se calcula EN PROCESO con `sha2` (multiplataforma) leyendo por bloques,
// en vez de invocar el binario `shasum`, que solo existe en macOS/Linux.

use crate::platform;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use walkdir::WalkDir;

const MIN_SIZE: u64 = 1024 * 1024; // 1 MB: ignoramos lo pequeño (poco ahorro).

#[derive(Serialize)]
pub struct DupGroup {
    size: u64,
    count: u32,
    wasted: u64, // espacio recuperable si se deja 1 copia
    files: Vec<String>,
}

fn resolve(path: &str) -> PathBuf {
    if path.is_empty() || path == "~" {
        platform::home_dir()
    } else {
        PathBuf::from(path)
    }
}

/// SHA-256 de un archivo, leyendo por bloques (no carga el fichero en memoria).
fn sha256_file(path: &str) -> Option<String> {
    let mut f = std::fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        match f.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buf[..n]),
            Err(_) => return None,
        }
    }
    Some(format!("{:x}", hasher.finalize()))
}

#[tauri::command]
pub async fn find_duplicates(path: String) -> Result<Vec<DupGroup>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = resolve(&path);
        if !dir.is_dir() {
            return Err("No es una carpeta".to_string());
        }

        // 1. (tamaño → rutas), ficheros >= MIN_SIZE, sin seguir symlinks.
        let mut by_size: HashMap<u64, Vec<String>> = HashMap::new();
        for e in WalkDir::new(&dir)
            .follow_links(false)
            .into_iter()
            .filter_map(|x| x.ok())
        {
            if e.file_type().is_file() {
                if let Ok(md) = e.metadata() {
                    if md.len() >= MIN_SIZE {
                        by_size
                            .entry(md.len())
                            .or_default()
                            .push(e.path().to_string_lossy().to_string());
                    }
                }
            }
        }

        // 2. candidatos = ficheros cuyo tamaño comparten >=2.
        let mut candidates: Vec<String> = Vec::new();
        for files in by_size.values() {
            if files.len() >= 2 {
                candidates.extend(files.iter().cloned());
            }
        }
        if candidates.is_empty() {
            return Ok(vec![]);
        }

        // 3. SHA-256 de los candidatos, en proceso y multiplataforma.
        let mut hash_of: HashMap<String, String> = HashMap::new();
        for f in &candidates {
            if let Some(h) = sha256_file(f) {
                hash_of.insert(f.clone(), h);
            }
        }

        // 4. agrupar por hash.
        let mut groups: HashMap<String, Vec<String>> = HashMap::new();
        for f in candidates {
            if let Some(h) = hash_of.get(&f) {
                groups.entry(h.clone()).or_default().push(f);
            }
        }

        // 5. grupos con >=2 → duplicados reales.
        let mut out = Vec::new();
        for (_h, mut files) in groups {
            if files.len() >= 2 {
                files.sort();
                let size = std::fs::metadata(&files[0]).map(|m| m.len()).unwrap_or(0);
                let count = files.len() as u32;
                out.push(DupGroup {
                    size,
                    count,
                    wasted: size * (count as u64 - 1),
                    files,
                });
            }
        }
        out.sort_by(|a, b| b.wasted.cmp(&a.wasted));
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}
