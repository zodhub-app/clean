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
        //
        // OJO con lo que significa «duplicado». Dos rutas con el mismo
        // contenido NO siempre ocupan el doble:
        //
        //   - **Enlaces duros**: dos nombres para el MISMO archivo. Ocupa una
        //     vez. Borrar uno libera cero.
        //   - **Clones APFS** (duplicar en el Finder, `cp -c`): comparten los
        //     bloques hasta que uno se modifica. Borrar uno libera cero.
        //
        // Antes se hacía `wasted = size × (count − 1)` sin comprobar nada, así
        // que la app prometía recuperar espacio que no existía. Ahora se
        // agrupan las rutas por identidad real de archivo (dispositivo +
        // inodo): las que comparten inodo cuentan UNA sola vez.
        let mut out = Vec::new();
        for (_h, mut files) in groups {
            if files.len() < 2 {
                continue;
            }
            files.sort();

            // Identidades distintas dentro del grupo. Si dos rutas comparten
            // inodo, son el mismo archivo y solo se cuenta una.
            let unique = distinct_files(&files);
            if unique < 2 {
                continue; // solo enlaces duros: no hay nada que recuperar
            }

            let size = file_size_on_disk(&files[0]);
            out.push(DupGroup {
                size,
                count: files.len() as u32,
                // Se recupera el espacio de todas las COPIAS REALES menos una.
                wasted: size.saturating_mul(unique as u64 - 1),
                files,
            });
        }
        out.sort_by(|a, b| b.wasted.cmp(&a.wasted));
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Cuántos archivos DISTINTOS hay realmente entre estas rutas.
///
/// Dos rutas que apuntan al mismo inodo son un único archivo con dos nombres
/// (enlace duro): ocupan una sola vez y borrar uno no libera nada.
#[cfg(unix)]
fn distinct_files(paths: &[String]) -> usize {
    use std::collections::HashSet;
    use std::os::unix::fs::MetadataExt;
    let mut seen: HashSet<(u64, u64)> = HashSet::new();
    let mut unknown = 0usize; // rutas que no se pudieron consultar: se cuentan aparte
    for p in paths {
        match std::fs::metadata(p) {
            Ok(md) => {
                seen.insert((md.dev(), md.ino()));
            }
            Err(_) => unknown += 1,
        }
    }
    seen.len() + unknown
}

/// En Windows la identidad de archivo requiere abrirlo (`GetFileInformationByHandle`),
/// que sería carísimo aquí. Los enlaces duros son mucho menos habituales, así
/// que se asume que cada ruta es un archivo distinto. Puede sobreestimar en ese
/// caso concreto y está documentado como tal.
#[cfg(not(unix))]
fn distinct_files(paths: &[String]) -> usize {
    paths.len()
}

/// Espacio real en disco del archivo (bloques asignados), no el que declara.
fn file_size_on_disk(path: &str) -> u64 {
    std::fs::metadata(path)
        .map(|md| crate::platform::size_on_disk(&md))
        .unwrap_or(0)
}
