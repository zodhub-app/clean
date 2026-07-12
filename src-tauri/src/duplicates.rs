// Fase 7 — buscador de duplicados por CONTENIDO. Estrategia segura y rápida:
//   1. Agrupar ficheros por tamaño (rapidísimo; distinto tamaño = distinto).
//   2. Solo para los tamaños compartidos, calcular SHA-256 (vía `shasum`).
//   3. Agrupar por hash → duplicados reales (mismo contenido exacto).
// Nunca borra: solo encuentra. El usuario revisa y decide (deja al menos uno).

use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
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
        PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/".into()))
    } else {
        PathBuf::from(path)
    }
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

        // 3. SHA-256 de los candidatos (en lotes, sin shell).
        let mut hash_of: HashMap<String, String> = HashMap::new();
        for chunk in candidates.chunks(400) {
            let mut cmd = Command::new("shasum");
            cmd.arg("-a").arg("256");
            for f in chunk {
                cmd.arg(f);
            }
            if let Ok(out) = cmd.output() {
                for line in String::from_utf8_lossy(&out.stdout).lines() {
                    let mut it = line.splitn(2, ' ');
                    if let (Some(h), Some(rest)) = (it.next(), it.next()) {
                        hash_of.insert(rest.trim_start().to_string(), h.to_string());
                    }
                }
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
