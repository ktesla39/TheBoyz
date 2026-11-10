use futures_util::{stream, StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use zip::ZipArchive;

const VERSION_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

static PROGRESS_APP: OnceLock<AppHandle> = OnceLock::new();

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LauncherProgress {
    phase: String,
    message: String,
    file: Option<String>,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    percent: Option<u8>,
}

pub fn register_progress_app(app: AppHandle) {
    let _ = PROGRESS_APP.set(app);
}

pub fn emit_launcher_progress(
    phase: &str,
    message: &str,
    file: Option<String>,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
) {
    let percent = total_bytes
        .filter(|total| *total > 0)
        .map(|total| ((downloaded_bytes.saturating_mul(100) / total).min(100)) as u8);
    let event = LauncherProgress {
        phase: phase.to_string(),
        message: message.to_string(),
        file,
        downloaded_bytes,
        total_bytes,
        percent,
    };
    if let Some(app) = PROGRESS_APP.get() {
        let _ = app.emit("launcher-progress", event);
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct InstallRequest {
    pub instance_id: String,
    pub instance_name: String,
    pub game_version: String,
    pub loader: String,
    pub loader_version: Option<String>,
    pub java_path: Option<String>,
    pub custom_game_dir: Option<String>,
}

pub struct PreparedLaunch {
    pub java_path: String,
    pub game_dir: PathBuf,
    pub args: Vec<String>,
    pub required_java_version: Option<u32>,
}

fn validate_component(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 128
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
        || value == "."
        || value == ".."
    {
        return Err(format!("Invalid {label}."));
    }
    Ok(())
}

fn os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

fn native_classifier_arch() -> &'static str {
    if cfg!(target_pointer_width = "64") {
        "64"
    } else {
        "32"
    }
}

fn os_arch() -> &'static str {
    std::env::consts::ARCH
}

fn resolve_game_dir(
    root: &Path,
    instance_id: &str,
    custom_dir: Option<&str>,
) -> Result<PathBuf, String> {
    let path = custom_dir
        .filter(|path| !path.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join("instances").join(instance_id));
    if path.as_os_str().is_empty() {
        return Err("The game directory cannot be empty.".to_string());
    }
    Ok(path)
}

fn sha1_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not open {}: {error}", path.display()))?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn valid_sha1(value: &str) -> bool {
    value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

async fn get_json(client: &reqwest::Client, url: &str) -> Result<Value, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Request to {url} failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Request to {url} failed: {error}"))?;
    response
        .json()
        .await
        .map_err(|error| format!("Invalid JSON response from {url}: {error}"))
}

async fn download_file(
    client: &reqwest::Client,
    url: &str,
    destination: &Path,
    expected_sha1: Option<&str>,
) -> Result<(), String> {
    let parsed_url =
        reqwest::Url::parse(url).map_err(|error| format!("Invalid download URL {url}: {error}"))?;
    if parsed_url.scheme() != "https" {
        return Err(format!("Refusing non-HTTPS download URL: {url}"));
    }
    if let Some(parent) = destination.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }
    let file_name = destination
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("game file")
        .to_string();
    if destination.is_file() {
        if let Some(expected) = expected_sha1 {
            emit_launcher_progress("verifying", &format!("Verifying {file_name}"), Some(file_name.clone()), 0, None);
            let path = destination.to_path_buf();
            let actual = tokio::task::spawn_blocking(move || sha1_file(&path))
                .await
                .map_err(|error| format!("Could not verify {}: {error}", destination.display()))??;
            if actual.eq_ignore_ascii_case(expected) {
                return Ok(());
            }
        } else {
            return Ok(());
        }
    }

    let mut response = None;
    let mut last_error = String::new();
    for attempt in 0..4u32 {
        match client.get(url).send().await {
            Ok(result) if result.status().is_success() => {
                response = Some(result);
                break;
            }
            Ok(result) => {
                let status = result.status();
                last_error = format!("HTTP {status}");
                if !(status.is_server_error() || status.as_u16() == 429 || status.as_u16() == 408) || attempt == 3 {
                    return Err(format!("Download failed for {url}: {last_error}"));
                }
            }
            Err(error) => {
                last_error = error.to_string();
                if !(error.is_connect() || error.is_timeout() || error.is_request()) || attempt == 3 {
                    return Err(format!("Download request failed for {url}: {last_error}. Check your internet connection, firewall, or proxy settings."));
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(500 * (1u64 << attempt))).await;
    }
    let response = response.ok_or_else(|| {
        format!("Could not download {file_name} after retries: {last_error}. Check your internet connection, firewall, or proxy settings.")
    })?;
    let total_bytes = response.content_length();
    let temporary = destination.with_extension(format!(
        "{}.{}.download",
        destination.extension().and_then(|extension| extension.to_str()).unwrap_or("file"),
        uuid::Uuid::new_v4()
    ));
    let download_result = async {
        let mut file = tokio::fs::File::create(&temporary)
            .await
            .map_err(|error| format!("Could not create {}: {error}", temporary.display()))?;
        let mut hasher = Sha1::new();
        let mut body = response.bytes_stream();
        let mut downloaded_bytes = 0u64;
        let mut last_progress = Instant::now() - Duration::from_secs(1);
        emit_launcher_progress("downloading", &format!("Downloading {file_name}"), Some(file_name.clone()), 0, total_bytes);
        while let Some(chunk) = body.try_next().await.map_err(|error| {
            format!("Download stream failed for {url}: {error}. Check your internet connection, firewall, or proxy settings.")
        })? {
            hasher.update(&chunk);
            file.write_all(&chunk).await.map_err(|error| format!("Could not write {}: {error}", temporary.display()))?;
            downloaded_bytes = downloaded_bytes.saturating_add(chunk.len() as u64);
            if last_progress.elapsed() >= Duration::from_millis(120) {
                emit_launcher_progress("downloading", &format!("Downloading {file_name}"), Some(file_name.clone()), downloaded_bytes, total_bytes);
                last_progress = Instant::now();
            }
        }
        file.flush().await.map_err(|error| format!("Could not flush {}: {error}", temporary.display()))?;
        drop(file);
        emit_launcher_progress("verifying", &format!("Verifying {file_name}"), Some(file_name.clone()), downloaded_bytes, total_bytes);
        let actual_sha1 = hex::encode(hasher.finalize());
        if let Some(expected) = expected_sha1 {
            if !actual_sha1.eq_ignore_ascii_case(expected) {
                return Err(format!("SHA-1 verification failed for {url}: expected {expected}, got {actual_sha1}."));
            }
        }
        if tokio::fs::try_exists(destination).await.map_err(|error| format!("Could not inspect {}: {error}", destination.display()))? {
            tokio::fs::remove_file(destination).await.map_err(|error| format!("Could not replace {}: {error}", destination.display()))?;
        }
        tokio::fs::rename(&temporary, destination).await.map_err(|error| format!("Could not finalize {}: {error}", destination.display()))?;
        emit_launcher_progress("downloaded", &format!("Downloaded {file_name}"), Some(file_name.clone()), downloaded_bytes, total_bytes);
        Ok::<_, String>(())
    }.await;
    if let Err(error) = download_result {
        let _ = tokio::fs::remove_file(&temporary).await;
        return Err(error);
    }
    Ok(())
}

fn rule_matches(rule: &Value, launch_features: Option<&HashMap<&str, bool>>) -> bool {
    let os_matches = rule
        .get("os")
        .and_then(|os| os.get("name"))
        .and_then(Value::as_str)
        .map(|name| name == os_name())
        .unwrap_or(true);
    let arch_matches = rule
        .get("os")
        .and_then(|os| os.get("arch"))
        .and_then(Value::as_str)
        .map(|arch| {
            arch == os_arch()
                || (arch == "amd64" && os_arch() == "x86_64")
                || (arch == "x86_64" && os_arch() == "amd64")
        })
        .unwrap_or(true);
    let features_match = rule
        .get("features")
        .and_then(Value::as_object)
        .map(|features| {
            features.iter().all(|(feature, expected)| {
                let expected = expected.as_bool().unwrap_or(false);
                launch_features
                    .and_then(|available| available.get(feature.as_str()))
                    .copied()
                    .unwrap_or(false)
                    == expected
            })
        })
        .unwrap_or(true);
    os_matches && arch_matches && features_match
}

fn rules_allow(value: &Value) -> bool {
    let Some(rules) = value.get("rules").and_then(Value::as_array) else {
        return true;
    };
    let mut allowed = false;
    for rule in rules {
        if rule_matches(rule, None) {
            allowed = rule.get("action").and_then(Value::as_str) == Some("allow");
        }
    }
    allowed
}

fn relative_library_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!("Unsafe artifact path in version metadata: {value}"));
    }
    Ok(path.to_path_buf())
}

fn extract_natives(jar_path: &Path, destination: &Path, excludes: &[String]) -> Result<(), String> {
    let bytes = fs::read(jar_path).map_err(|error| {
        format!(
            "Could not read native library {}: {error}",
            jar_path.display()
        )
    })?;
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| format!("Invalid native library {}: {error}", jar_path.display()))?;
    fs::create_dir_all(destination)
        .map_err(|error| format!("Could not create {}: {error}", destination.display()))?;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Could not read native archive entry: {error}"))?;
        let name = entry.name().to_string();
        if name.starts_with("META-INF/")
            || excludes.iter().any(|exclude| name.starts_with(exclude))
            || !matches!(
                Path::new(&name)
                    .extension()
                    .and_then(|extension| extension.to_str()),
                Some("dll" | "so" | "dylib")
            )
        {
            continue;
        }
        let file_name = Path::new(&name)
            .file_name()
            .ok_or_else(|| format!("Invalid native archive path: {name}"))?;
        let output = destination.join(file_name);
        let mut contents = Vec::new();
        entry
            .read_to_end(&mut contents)
            .map_err(|error| format!("Could not extract native library: {error}"))?;
        fs::write(&output, contents)
            .map_err(|error| format!("Could not write {}: {error}", output.display()))?;
    }
    Ok(())
}

fn artifact_info(library: &Value) -> Option<(String, String, Option<String>)> {
    let artifact = library.get("downloads")?.get("artifact")?;
    Some((
        artifact.get("url")?.as_str()?.to_string(),
        artifact.get("path")?.as_str()?.to_string(),
        artifact
            .get("sha1")
            .and_then(Value::as_str)
            .map(str::to_string),
    ))
}

fn maven_artifact_info(library: &Value) -> Result<Option<(String, String)>, String> {
    let Some(coordinate) = library.get("name").and_then(Value::as_str) else {
        return Ok(None);
    };
    let (coordinate, extension) = coordinate.split_once('@').unwrap_or((coordinate, "jar"));
    let parts = coordinate.split(':').collect::<Vec<_>>();
    if parts.len() < 3 {
        return Err(format!("Invalid Maven coordinate: {coordinate}"));
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = parts
        .get(3)
        .map(|classifier| format!("-{classifier}"))
        .unwrap_or_default();
    let path = format!("{group}/{artifact}/{version}/{artifact}-{version}{classifier}.{extension}");
    let safe_path = relative_library_path(&path)?;
    let repository = library
        .get("url")
        .and_then(Value::as_str)
        .unwrap_or("https://libraries.minecraft.net/");
    let base_url = reqwest::Url::parse(repository)
        .map_err(|error| format!("Invalid Maven repository URL: {error}"))?;
    if base_url.scheme() != "https" {
        return Err(format!("Refusing non-HTTPS Maven repository: {repository}"));
    }
    let url = base_url
        .join(&safe_path.to_string_lossy())
        .map_err(|error| format!("Invalid Maven artifact URL: {error}"))?;
    Ok(Some((
        url.to_string(),
        safe_path.to_string_lossy().to_string(),
    )))
}

async fn install_vanilla(
    client: &reqwest::Client,
    root: &Path,
    game_version: &str,
) -> Result<Value, String> {
    let manifest = get_json(client, VERSION_MANIFEST_URL).await?;
    let version = manifest
        .get("versions")
        .and_then(Value::as_array)
        .and_then(|versions| {
            versions
                .iter()
                .find(|version| version.get("id").and_then(Value::as_str) == Some(game_version))
        })
        .ok_or_else(|| format!("Minecraft version {game_version} is not in Mojang's manifest."))?;
    let metadata_url = version
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Mojang did not provide metadata for Minecraft {game_version}."))?;
    let metadata = get_json(client, metadata_url).await?;
    let versions_dir = root.join("minecraft").join("versions").join(game_version);
    let client_download = metadata
        .get("downloads")
        .and_then(|downloads| downloads.get("client"))
        .ok_or_else(|| format!("Minecraft {game_version} does not provide a client download."))?;
    let client_url = client_download
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| "Mojang's client download URL is missing.".to_string())?;
    let client_sha1 = client_download.get("sha1").and_then(Value::as_str);
    download_file(
        client,
        client_url,
        &versions_dir.join(format!("{game_version}.jar")),
        client_sha1,
    )
    .await?;

    let libraries_dir = root.join("minecraft").join("libraries");
    let natives_dir = versions_dir.join("natives");
    if let Some(libraries) = metadata.get("libraries").and_then(Value::as_array) {
        let mut downloads = Vec::new();
        let mut scheduled_paths = HashSet::new();
        for library in libraries.iter().filter(|library| rules_allow(library)) {
            if let Some((url, path, sha1)) = artifact_info(library) {
                let path = libraries_dir.join(relative_library_path(&path)?);
                if scheduled_paths.insert(path.clone()) {
                    downloads.push((url, path, sha1, false, Vec::new()));
                }
            } else if library
                .get("natives")
                .and_then(|natives| natives.get(os_name()))
                .is_none()
            {
                if let Some((url, path)) = maven_artifact_info(library)? {
                    let path = libraries_dir.join(relative_library_path(&path)?);
                    if scheduled_paths.insert(path.clone()) {
                        downloads.push((url, path, None, false, Vec::new()));
                    }
                }
            }
            if let Some(native_classifier) = library
                .get("natives")
                .and_then(|natives| natives.get(os_name()))
                .and_then(Value::as_str)
            {
                let classifier = native_classifier.replace("${arch}", native_classifier_arch());
                if let Some((url, path, sha1)) = library
                    .get("downloads")
                    .and_then(|downloads| downloads.get("classifiers"))
                    .and_then(|classifiers| classifiers.get(&classifier))
                    .and_then(|artifact| {
                        Some((
                            artifact.get("url")?.as_str()?.to_string(),
                            artifact.get("path")?.as_str()?.to_string(),
                            artifact
                                .get("sha1")
                                .and_then(Value::as_str)
                                .map(str::to_string),
                        ))
                    })
                {
                    let excludes = library
                        .get("extract")
                        .and_then(|extract| extract.get("exclude"))
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect();
                    let path = libraries_dir.join(relative_library_path(&path)?);
                    if scheduled_paths.insert(path.clone()) {
                        downloads.push((url, path, sha1, true, excludes));
                    }
                }
            }
        }
        stream::iter(downloads)
            .map(|(url, path, sha1, is_native, excludes)| async move {
                download_file(client, &url, &path, sha1.as_deref()).await?;
                Ok::<_, String>((path, is_native, excludes))
            })
            .buffer_unordered(8)
            .try_collect::<Vec<_>>()
            .await?
            .into_iter()
            .try_for_each(|(path, is_native, excludes)| {
                if is_native {
                    extract_natives(&path, &natives_dir, &excludes)?;
                }
                Ok::<_, String>(())
            })?;
    }

    let assets = metadata
        .get("assetIndex")
        .ok_or_else(|| "Mojang version metadata does not include an asset index.".to_string())?;
    let asset_id = assets
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Mojang asset index ID is missing.".to_string())?;
    validate_component(asset_id, "asset index ID")?;
    let asset_index_url = assets
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| "Mojang asset index URL is missing.".to_string())?;
    let asset_index_path = root
        .join("minecraft")
        .join("assets")
        .join("indexes")
        .join(format!("{asset_id}.json"));
    let asset_index_sha1 = assets.get("sha1").and_then(Value::as_str);
    download_file(client, asset_index_url, &asset_index_path, asset_index_sha1).await?;
    let asset_index: Value = serde_json::from_slice(
        &tokio::fs::read(&asset_index_path)
            .await
            .map_err(|error| format!("Could not read asset index: {error}"))?,
    )
    .map_err(|error| format!("Mojang asset index is invalid: {error}"))?;
    let object_map = asset_index
        .get("objects")
        .and_then(Value::as_object)
        .ok_or_else(|| "Mojang asset index has no object map.".to_string())?;
    let assets_root = root.join("minecraft").join("assets").join("objects");
    let mut scheduled_hashes = HashSet::new();
    let asset_downloads = object_map
        .values()
        .filter_map(|object| {
            let hash = object.get("hash")?.as_str()?;
            if !valid_sha1(hash) || !scheduled_hashes.insert(hash.to_string()) {
                return None;
            }
            Some((
                format!(
                    "https://resources.download.minecraft.net/{}/{}",
                    &hash[..2],
                    hash
                ),
                assets_root.join(&hash[..2]).join(hash),
                hash.to_string(),
            ))
        })
        .collect::<Vec<_>>();
    stream::iter(asset_downloads)
        .map(|(url, path, sha1)| async move {
            download_file(client, &url, &path, Some(&sha1)).await
        })
        .buffer_unordered(16)
        .try_collect::<Vec<_>>()
        .await?;
    if let Some(logging_file) = metadata
        .get("logging")
        .and_then(|logging| logging.get("client"))
        .and_then(|client| client.get("file"))
    {
        let url = logging_file
            .get("url")
            .and_then(Value::as_str)
            .ok_or_else(|| "Minecraft logging configuration URL is missing.".to_string())?;
        let id = logging_file
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Minecraft logging configuration ID is missing.".to_string())?;
        let path = root
            .join("minecraft")
            .join("assets")
            .join("log_configs")
            .join(relative_library_path(id)?);
        download_file(
            client,
            url,
            &path,
            logging_file.get("sha1").and_then(Value::as_str),
        )
        .await?;
    }
    if metadata.get("assets").and_then(Value::as_str) == Some("legacy")
        || asset_index.get("virtual").and_then(Value::as_bool) == Some(true)
    {
        let legacy_assets = root
            .join("minecraft")
            .join("assets")
            .join("virtual")
            .join("legacy");
        for (name, object) in object_map {
            let hash = object
                .get("hash")
                .and_then(Value::as_str)
                .ok_or_else(|| "Legacy asset has no content hash.".to_string())?;
            let relative = relative_library_path(name)?;
            let source = assets_root.join(&hash[..2]).join(hash);
            let destination = legacy_assets.join(relative);
            if let Some(parent) = destination.parent() {
                tokio::fs::create_dir_all(parent)
                    .await
                    .map_err(|error| format!("Could not create legacy asset directory: {error}"))?;
            }
            if !destination.is_file() {
                tokio::fs::copy(&source, &destination)
                    .await
                    .map_err(|error| format!("Could not map legacy asset {}: {error}", name))?;
            }
        }
    }

    let json_path = versions_dir.join(format!("{game_version}.json"));
    tokio::fs::write(
        json_path,
        serde_json::to_vec_pretty(&metadata).map_err(|error| error.to_string())?,
    )
    .await
    .map_err(|error| format!("Could not save version metadata: {error}"))?;
    Ok(metadata)
}

async fn install_profile_libraries(
    client: &reqwest::Client,
    root: &Path,
    game_version: &str,
    metadata: &Value,
) -> Result<(), String> {
    let libraries_dir = root.join("minecraft").join("libraries");
    let natives_dir = root
        .join("minecraft")
        .join("versions")
        .join(game_version)
        .join("natives");
    let mut downloads = Vec::new();
    let mut scheduled_paths = HashSet::new();
    for library in metadata
        .get("libraries")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|library| rules_allow(library))
    {
        if let Some((url, path, sha1)) = artifact_info(library) {
            let path = libraries_dir.join(relative_library_path(&path)?);
            if scheduled_paths.insert(path.clone()) {
                downloads.push((url, path, sha1, false, Vec::new()));
            }
        } else if library
            .get("natives")
            .and_then(|natives| natives.get(os_name()))
            .is_none()
        {
            if let Some((url, path)) = maven_artifact_info(library)? {
                let path = libraries_dir.join(relative_library_path(&path)?);
                if scheduled_paths.insert(path.clone()) {
                    downloads.push((url, path, None, false, Vec::new()));
                }
            }
        }
        let Some(classifier) = library
            .get("natives")
            .and_then(|natives| natives.get(os_name()))
            .and_then(Value::as_str)
            .map(|value| value.replace("${arch}", native_classifier_arch()))
        else {
            continue;
        };
        let Some(artifact) = library
            .get("downloads")
            .and_then(|downloads| downloads.get("classifiers"))
            .and_then(|classifiers| classifiers.get(&classifier))
        else {
            continue;
        };
        let url = artifact
            .get("url")
            .and_then(Value::as_str)
            .ok_or_else(|| "Loader native download URL is missing.".to_string())?
            .to_string();
        let path = artifact
            .get("path")
            .and_then(Value::as_str)
            .ok_or_else(|| "Loader native library path is missing.".to_string())?;
        let sha1 = artifact
            .get("sha1")
            .and_then(Value::as_str)
            .map(str::to_string);
        let excludes = library
            .get("extract")
            .and_then(|extract| extract.get("exclude"))
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect();
        let path = libraries_dir.join(relative_library_path(path)?);
        if scheduled_paths.insert(path.clone()) {
            downloads.push((url, path, sha1, true, excludes));
        }
    }
    stream::iter(downloads)
        .map(|(url, path, sha1, native, excludes)| async move {
            download_file(client, &url, &path, sha1.as_deref()).await?;
            Ok::<_, String>((path, native, excludes))
        })
        .buffer_unordered(8)
        .try_for_each(|(path, native, excludes)| {
            let natives_dir = natives_dir.clone();
            async move {
                if native {
                    extract_natives(&path, &natives_dir, &excludes)?;
                }
                Ok::<_, String>(())
            }
        })
        .await
}

async fn install_fabric_or_quilt(
    client: &reqwest::Client,
    base: &Value,
    game_version: &str,
    loader: &str,
    requested_loader_version: Option<&str>,
) -> Result<Value, String> {
    let (profile_endpoint, versions_endpoint) = match loader {
        "fabric" => (
            "https://meta.fabricmc.net/v2/versions/loader",
            "https://meta.fabricmc.net/v2/versions/loader",
        ),
        "quilt" => (
            "https://meta.quiltmc.org/v3/versions/loader",
            "https://meta.quiltmc.org/v3/versions/loader",
        ),
        _ => return Err(format!("Unsupported loader: {loader}")),
    };
    let loader_version = match requested_loader_version.filter(|value| !value.trim().is_empty()) {
        Some(version) => version.to_string(),
        None => {
            let versions = get_json(client, &format!("{versions_endpoint}/{game_version}")).await?;
            versions
                .as_array()
                .and_then(|versions| versions.first())
                .and_then(|entry| entry.get("loader"))
                .and_then(|loader| loader.get("version"))
                .and_then(Value::as_str)
                .ok_or_else(|| format!("{loader} has no release for Minecraft {game_version}."))?
                .to_string()
        }
    };
    let profile = get_json(
        client,
        &format!("{profile_endpoint}/{game_version}/{loader_version}/profile/json"),
    )
    .await?;
    let profile_id = profile
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("{loader} returned an invalid launch profile."))?
        .to_string();
    let mut merged = base.clone();
    merged["id"] = Value::String(profile_id.clone());
    if let Some(main_class) = profile.get("mainClass") {
        merged["mainClass"] = main_class.clone();
    }
    let mut libraries = merged
        .get("libraries")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for library in profile
        .get("libraries")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        if !libraries.iter().any(|existing| existing == library) {
            libraries.push(library.clone());
        }
    }
    merged["libraries"] = Value::Array(libraries);
    if let Some(profile_args) = profile.get("arguments") {
        for key in ["game", "jvm"] {
            if let Some(extra) = profile_args.get(key).and_then(Value::as_array) {
                let base_args = merged
                    .get("arguments")
                    .and_then(|args| args.get(key))
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                let mut combined = base_args;
                combined.extend(extra.iter().cloned());
                merged["arguments"][key] = Value::Array(combined);
            }
        }
    }
    if let Some(arguments) = profile.get("minecraftArguments") {
        merged["minecraftArguments"] = arguments.clone();
    }
    merged
        .as_object_mut()
        .map(|object| object.remove("inheritsFrom"));
    Ok(merged)
}

async fn recommended_forge_version(
    client: &reqwest::Client,
    game_version: &str,
) -> Result<String, String> {
    let promotions = client
        .get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
        .send()
        .await
        .map_err(|error| format!("Could not fetch Forge versions: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Could not fetch Forge versions: {error}"))?
        .json::<Value>()
        .await
        .map_err(|error| format!("Forge promotions response is invalid: {error}"))?;
    let promos = promotions
        .get("promos")
        .and_then(Value::as_object)
        .ok_or_else(|| "Forge promotions response is invalid.".to_string())?;
    promos
        .get(&format!("{game_version}-recommended"))
        .or_else(|| promos.get(&format!("{game_version}-latest")))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("Forge has no recommended release for Minecraft {game_version}."))
}

async fn installer_version(
    client: &reqwest::Client,
    game_version: &str,
    loader: &str,
    requested: Option<&str>,
) -> Result<String, String> {
    if let Some(version) = requested.filter(|version| !version.trim().is_empty()) {
        return Ok(version.to_string());
    }
    if loader == "forge" {
        return recommended_forge_version(client, game_version).await;
    }
    let components = game_version.split('.').collect::<Vec<_>>();
    if components.first() != Some(&"1") || components.len() < 3 {
        return Err(format!(
            "NeoForge does not support Minecraft {game_version}."
        ));
    }
    let version_prefix = format!("{}.{}.", components[1], components[2]);
    let metadata_url =
        "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml";
    let text = client
        .get(metadata_url)
        .send()
        .await
        .map_err(|error| format!("NeoForge version lookup failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("NeoForge version lookup failed: {error}"))?
        .text()
        .await
        .map_err(|error| format!("Could not read NeoForge version metadata: {error}"))?;
    text.split("<version>")
        .skip(1)
        .filter_map(|fragment| fragment.split("</version>").next())
        .filter(|version| version.starts_with(&version_prefix))
        .last()
        .map(str::to_string)
        .ok_or_else(|| format!("NeoForge has no release matching Minecraft {game_version}."))
}

async fn install_forge_family(
    client: &reqwest::Client,
    root: &Path,
    request: &InstallRequest,
) -> Result<Value, String> {
    let java = request
        .java_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .ok_or_else(|| {
            "Choose a Java executable before installing Forge or NeoForge.".to_string()
        })?;
    let loader_version = installer_version(
        client,
        &request.game_version,
        &request.loader,
        request.loader_version.as_deref(),
    )
    .await?;
    let installer_url = if request.loader == "forge" {
        format!(
            "https://maven.minecraftforge.net/net/minecraftforge/forge/{}-{}/forge-{}-{}-installer.jar",
            request.game_version, loader_version, request.game_version, loader_version
        )
    } else {
        format!(
            "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/neoforge-{}-installer.jar",
            loader_version, loader_version
        )
    };
    let installer_dir = root.join("minecraft").join("installers");
    tokio::fs::create_dir_all(&installer_dir)
        .await
        .map_err(|error| format!("Could not create installer directory: {error}"))?;
    let installer = installer_dir.join(format!(
        "{}-{}-installer.jar",
        request.loader, loader_version
    ));
    download_file(client, &installer_url, &installer, None).await?;
    let game_dir = root.join("minecraft");
    let output = tokio::process::Command::new(java)
        .arg("-jar")
        .arg(&installer)
        .arg("--installClient")
        .arg(&game_dir)
        .output()
        .await
        .map_err(|error| format!("Could not run {} installer: {error}", request.loader))?;
    if !output.status.success() {
        return Err(format!(
            "{} installer failed: {}{}",
            request.loader,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    let profile = find_loader_profile(&game_dir, &request.game_version, &request.loader)?;
    let profile_id = profile
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            format!(
                "{} installer produced a profile without an ID.",
                request.loader
            )
        })?
        .to_string();
    let base_path = root
        .join("minecraft")
        .join("versions")
        .join(&request.game_version)
        .join(format!("{}.json", request.game_version));
    let base: Value = serde_json::from_slice(
        &fs::read(&base_path)
            .map_err(|error| format!("Could not read base version metadata: {error}"))?,
    )
    .map_err(|error| format!("Base Minecraft metadata is invalid: {error}"))?;
    let merged = merge_loader_profile(&base, &profile, &profile_id);
    let profile_dir = root.join("minecraft").join("versions").join(&profile_id);
    tokio::fs::create_dir_all(&profile_dir)
        .await
        .map_err(|error| format!("Could not create version profile: {error}"))?;
    tokio::fs::write(
        profile_dir.join(format!("{profile_id}.json")),
        serde_json::to_vec_pretty(&merged).map_err(|error| error.to_string())?,
    )
    .await
    .map_err(|error| format!("Could not save loader profile: {error}"))?;
    Ok(merged)
}

fn find_loader_profile(game_dir: &Path, game_version: &str, loader: &str) -> Result<Value, String> {
    let versions = game_dir.join("versions");
    for entry in fs::read_dir(&versions)
        .map_err(|error| format!("Could not read {}: {error}", versions.display()))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let json_path = entry
            .path()
            .join(format!("{}.json", entry.file_name().to_string_lossy()));
        if !json_path.is_file() {
            continue;
        }
        let content = fs::read(&json_path).map_err(|error| error.to_string())?;
        let profile: Value = serde_json::from_slice(&content).map_err(|error| error.to_string())?;
        let id = profile
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let inherits = profile
            .get("inheritsFrom")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if inherits == game_version && id.to_lowercase().contains(loader) {
            return Ok(profile);
        }
    }
    Err(format!(
        "{} installer completed without creating a matching Minecraft {} profile.",
        loader, game_version
    ))
}

fn merge_loader_profile(base: &Value, profile: &Value, profile_id: &str) -> Value {
    let mut merged = base.clone();
    if let (Some(base_libraries), Some(profile_libraries)) = (
        base.get("libraries").and_then(Value::as_array),
        profile.get("libraries").and_then(Value::as_array),
    ) {
        let mut libraries = base_libraries.clone();
        for library in profile_libraries {
            if !libraries.iter().any(|existing| existing == library) {
                libraries.push(library.clone());
            }
        }
        merged["libraries"] = Value::Array(libraries);
    }
    for key in ["mainClass", "minecraftArguments", "javaVersion"] {
        if let Some(value) = profile.get(key) {
            merged[key] = value.clone();
        }
    }
    if let Some(profile_arguments) = profile.get("arguments") {
        for key in ["game", "jvm"] {
            if let Some(extra) = profile_arguments.get(key).and_then(Value::as_array) {
                let base_arguments = merged
                    .get("arguments")
                    .and_then(|arguments| arguments.get(key))
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                let mut combined = base_arguments;
                combined.extend(extra.iter().cloned());
                merged["arguments"][key] = Value::Array(combined);
            }
        }
    }
    merged["id"] = Value::String(profile_id.to_string());
    if let Some(object) = merged.as_object_mut() {
        object.remove("inheritsFrom");
    }
    merged
}

pub async fn install_instance(root: &Path, request: InstallRequest) -> Result<String, String> {
    validate_component(&request.instance_id, "instance ID")?;
    validate_component(&request.game_version, "Minecraft version")?;
    if !matches!(
        request.loader.as_str(),
        "vanilla" | "fabric" | "quilt" | "forge" | "neoforge"
    ) {
        return Err(format!("Unsupported Minecraft loader: {}", request.loader));
    }
    if let Some(version) = request
        .loader_version
        .as_deref()
        .filter(|version| !version.trim().is_empty())
    {
        validate_component(version, "loader version")?;
    }
    let root_for_check = root.to_path_buf();
    let request_for_check = request.clone();
    let is_installed = tokio::task::spawn_blocking(move || {
        installation_is_complete(&root_for_check, &request_for_check)
    })
    .await
    .map_err(|error| format!("Could not inspect the installed Minecraft files: {error}"))??;
    if is_installed {
        return Ok(format!(
            "Minecraft {} ({}) is already installed for instance {}.",
            request.game_version, request.loader, request.instance_id
        ));
    }
    emit_launcher_progress("checking", "Checking installed Minecraft files", None, 0, None);
    let client = reqwest::Client::builder()
        .user_agent(concat!("TheBoysLauncher/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(600))
        .pool_idle_timeout(Duration::from_secs(90))
        .build()
        .map_err(|error| format!("Could not configure downloads: {error}"))?;
    emit_launcher_progress("metadata", "Fetching Minecraft version metadata", None, 0, None);
    let base = install_vanilla(&client, root, &request.game_version).await?;
    let installed = match request.loader.as_str() {
        "vanilla" => base,
        "fabric" | "quilt" => {
            let profile = install_fabric_or_quilt(
                &client,
                &base,
                &request.game_version,
                &request.loader,
                request.loader_version.as_deref(),
            )
            .await?;
            let id = profile
                .get("id")
                .and_then(Value::as_str)
                .ok_or_else(|| "Loader profile did not provide a version ID.".to_string())?;
            let profile_dir = root.join("minecraft").join("versions").join(id);
            tokio::fs::create_dir_all(&profile_dir)
                .await
                .map_err(|error| format!("Could not create loader profile: {error}"))?;
            tokio::fs::write(
                profile_dir.join(format!("{id}.json")),
                serde_json::to_vec_pretty(&profile).map_err(|error| error.to_string())?,
            )
            .await
            .map_err(|error| format!("Could not save loader profile: {error}"))?;
            profile
        }
        "forge" | "neoforge" => install_forge_family(&client, root, &request).await?,
        _ => unreachable!(),
    };
    emit_launcher_progress("finalizing", "Finalizing game files", None, 0, None);
    let profile_id = installed
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Installed version metadata has no profile ID.".to_string())?;
    if matches!(request.loader.as_str(), "fabric" | "quilt") {
        install_profile_libraries(&client, root, &request.game_version, &installed).await?;
    }
    let instance_dir = root.join("instances").join(&request.instance_id);
    for directory in ["mods", "resourcepacks", "shaderpacks", "saves"] {
        tokio::fs::create_dir_all(instance_dir.join(directory))
            .await
            .map_err(|error| format!("Could not create instance directory: {error}"))?;
    }
    tokio::fs::create_dir_all(resolve_game_dir(
        root,
        &request.instance_id,
        request.custom_game_dir.as_deref(),
    )?)
    .await
    .map_err(|error| format!("Could not create the configured game directory: {error}"))?;
    tokio::fs::write(
        instance_dir.join("instance.json"),
        serde_json::to_vec_pretty(&json!({
            "id": request.instance_id,
            "name": request.instance_name,
            "game_version": request.game_version,
            "loader": request.loader,
        }))
        .map_err(|error| error.to_string())?,
    )
    .await
    .map_err(|error| format!("Could not save instance metadata: {error}"))?;
    tokio::fs::write(
        instance_dir.join("launch-profile.json"),
        serde_json::to_vec_pretty(&json!({
            "gameVersion": request.game_version,
            "profileId": profile_id,
            "loader": request.loader,
            "loaderVersion": request.loader_version,
        }))
        .map_err(|error| error.to_string())?,
    )
    .await
    .map_err(|error| format!("Could not save installation profile: {error}"))?;
    Ok(format!(
        "Minecraft {} ({}) is installed for instance {}.",
        request.game_version, request.loader, request.instance_id
    ))
}

fn installation_is_complete(root: &Path, request: &InstallRequest) -> Result<bool, String> {
    let instance_dir = root.join("instances").join(&request.instance_id);
    let marker_path = instance_dir.join("launch-profile.json");
    let marker_bytes = match fs::read(&marker_path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(format!("Could not read installation profile: {error}")),
    };
    let marker: Value = serde_json::from_slice(&marker_bytes)
        .map_err(|error| format!("Installation profile is invalid: {error}"))?;
    if marker.get("gameVersion").and_then(Value::as_str) != Some(request.game_version.as_str())
        || marker.get("loader").and_then(Value::as_str) != Some(request.loader.as_str())
        || marker.get("loaderVersion").and_then(Value::as_str) != request.loader_version.as_deref()
    {
        return Ok(false);
    }
    let Some(profile_id) = marker.get("profileId").and_then(Value::as_str) else {
        return Ok(false);
    };
    let versions_dir = root.join("minecraft").join("versions");
    let profile_path = versions_dir
        .join(profile_id)
        .join(format!("{profile_id}.json"));
    let client_jar = versions_dir
        .join(&request.game_version)
        .join(format!("{}.jar", request.game_version));
    if !profile_path.is_file() || !client_jar.is_file() {
        return Ok(false);
    }
    let metadata: Value = serde_json::from_slice(
        &fs::read(&profile_path)
            .map_err(|error| format!("Could not read installed profile: {error}"))?,
    )
    .map_err(|error| format!("Installed version metadata is invalid: {error}"))?;
    let libraries_dir = root.join("minecraft").join("libraries");
    for library in metadata
        .get("libraries")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|library| rules_allow(library))
    {
        if let Some((_, path, _)) = artifact_info(library) {
            if !libraries_dir.join(relative_library_path(&path)?).is_file() {
                return Ok(false);
            }
        } else if library
            .get("natives")
            .and_then(|natives| natives.get(os_name()))
            .is_none()
        {
            if let Some((_, path)) = maven_artifact_info(library)? {
                if !libraries_dir.join(relative_library_path(&path)?).is_file() {
                    return Ok(false);
                }
            }
        }
        if let Some(classifier) = library
            .get("natives")
            .and_then(|natives| natives.get(os_name()))
            .and_then(Value::as_str)
            .map(|value| value.replace("${arch}", native_classifier_arch()))
        {
            let native_path = library
                .get("downloads")
                .and_then(|downloads| downloads.get("classifiers"))
                .and_then(|classifiers| classifiers.get(classifier))
                .and_then(|artifact| artifact.get("path"))
                .and_then(Value::as_str);
            if let Some(path) = native_path {
                if !libraries_dir.join(relative_library_path(path)?).is_file() {
                    return Ok(false);
                }
            }
        }
    }
    let asset_index_id = metadata
        .get("assetIndex")
        .and_then(|index| index.get("id"))
        .and_then(Value::as_str);
    if let Some(asset_index_id) = asset_index_id {
        let assets = root.join("minecraft").join("assets");
        let index_path = assets
            .join("indexes")
            .join(format!("{asset_index_id}.json"));
        if !index_path.is_file() || !assets.join("objects").is_dir() {
            return Ok(false);
        }
        if metadata
            .get("libraries")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .any(|library| {
                library
                    .get("natives")
                    .and_then(|natives| natives.get(os_name()))
                    .is_some()
            })
        {
            let native_dir = versions_dir.join(&request.game_version).join("natives");
            if !native_dir.is_dir()
                || fs::read_dir(&native_dir)
                    .map_err(|error| format!("Could not inspect native libraries: {error}"))?
                    .next()
                    .is_none()
            {
                return Ok(false);
            }
        }
        if metadata
            .get("logging")
            .and_then(|logging| logging.get("client"))
            .and_then(|client| client.get("file"))
            .and_then(|file| file.get("id"))
            .and_then(Value::as_str)
            .is_some_and(|id| {
                !root
                    .join("minecraft")
                    .join("assets")
                    .join("log_configs")
                    .join(id)
                    .is_file()
            })
        {
            return Ok(false);
        }
        let index: Value = serde_json::from_slice(
            &fs::read(index_path)
                .map_err(|error| format!("Could not read asset index: {error}"))?,
        )
        .map_err(|error| format!("Asset index is invalid: {error}"))?;
        let objects = index
            .get("objects")
            .and_then(Value::as_object)
            .ok_or_else(|| "Asset index has no object map.".to_string())?;
        for (name, object) in objects {
            let Some(hash) = object.get("hash").and_then(Value::as_str) else {
                return Ok(false);
            };
            if !valid_sha1(hash) || !assets.join("objects").join(&hash[..2]).join(hash).is_file() {
                return Ok(false);
            }
            if metadata.get("assets").and_then(Value::as_str) == Some("legacy") {
                let virtual_asset = assets
                    .join("virtual")
                    .join("legacy")
                    .join(relative_library_path(name)?);
                if !virtual_asset.is_file() {
                    return Ok(false);
                }
            }
        }
    }
    Ok(true)
}

fn library_file(library: &Value, libraries_dir: &Path) -> Result<Option<PathBuf>, String> {
    if let Some((_, path, _)) = artifact_info(library) {
        return Ok(Some(libraries_dir.join(relative_library_path(&path)?)));
    }
    match maven_artifact_info(library)? {
        Some((_, path)) => Ok(Some(libraries_dir.join(relative_library_path(&path)?))),
        None => Ok(None),
    }
}

pub fn prepare_launch(
    root: &Path,
    request: &crate::LaunchRequest,
) -> Result<PreparedLaunch, String> {
    validate_component(&request.instance_id, "instance ID")?;
    validate_component(&request.game_version, "Minecraft version")?;
    let instance_dir = root.join("instances").join(&request.instance_id);
    let launch_profile: Value = serde_json::from_slice(
        &fs::read(instance_dir.join("launch-profile.json"))
            .map_err(|_| "Install this Minecraft instance before launching it.".to_string())?,
    )
    .map_err(|error| format!("Instance launch profile is invalid: {error}"))?;
    let profile_id = launch_profile
        .get("profileId")
        .and_then(Value::as_str)
        .ok_or_else(|| "Instance launch profile has no version ID.".to_string())?;
    if launch_profile.get("gameVersion").and_then(Value::as_str)
        != Some(request.game_version.as_str())
    {
        return Err("The installed game version does not match this instance.".to_string());
    }
    if launch_profile.get("loader").and_then(Value::as_str) != Some(request.loader.as_str()) {
        return Err("The installed mod loader does not match this instance.".to_string());
    }
    if launch_profile.get("loaderVersion").and_then(Value::as_str)
        != request.loader_version.as_deref()
    {
        return Err("The installed mod-loader version does not match this instance.".to_string());
    }
    let versions_dir = root.join("minecraft").join("versions");
    let profile_path = versions_dir
        .join(profile_id)
        .join(format!("{profile_id}.json"));
    let metadata: Value = serde_json::from_slice(
        &fs::read(&profile_path)
            .map_err(|error| format!("Could not read {}: {error}", profile_path.display()))?,
    )
    .map_err(|error| format!("Minecraft version metadata is invalid: {error}"))?;
    let java_path = request
        .java_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .ok_or_else(|| "Select a Java executable before launching.".to_string())?;
    if !Path::new(java_path).is_file() {
        return Err(format!("Java executable does not exist: {java_path}"));
    }
    let game_dir = resolve_game_dir(
        root,
        &request.instance_id,
        request.custom_game_dir.as_deref(),
    )?;
    let libraries_dir = root.join("minecraft").join("libraries");
    let assets_dir = root.join("minecraft").join("assets");
    let natives_dir = versions_dir.join(&request.game_version).join("natives");
    let client_jar = versions_dir
        .join(&request.game_version)
        .join(format!("{}.jar", request.game_version));
    if !client_jar.is_file() {
        return Err("Minecraft client jar is missing; install the instance first.".to_string());
    }

    let mut classpath = Vec::new();
    if let Some(libraries) = metadata.get("libraries").and_then(Value::as_array) {
        for library in libraries.iter().filter(|library| rules_allow(library)) {
            if let Some(path) = library_file(library, &libraries_dir)? {
                let is_native_classifier = library
                    .get("natives")
                    .and_then(|natives| natives.get(os_name()))
                    .is_some();
                if path.is_file() && !is_native_classifier {
                    classpath.push(path.to_string_lossy().to_string());
                }
            }
        }
    }
    classpath.push(client_jar.to_string_lossy().to_string());
    let classpath_separator = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };
    let classpath_value = classpath.join(classpath_separator);
    let assets_root = if metadata.get("assets").and_then(Value::as_str) == Some("legacy") {
        assets_dir.join("virtual").join("legacy")
    } else {
        assets_dir.clone()
    };
    let assets_root_string = assets_root.to_string_lossy().to_string();
    let offline = request.access_token == "offline";
    let auth_uuid = request.uuid.replace('-', "");
    let access_token = if offline {
        "0"
    } else {
        request.access_token.as_str()
    };
    let logging_path = metadata
        .get("logging")
        .and_then(|logging| logging.get("client"))
        .and_then(|client| client.get("file"))
        .and_then(|file| file.get("id"))
        .map(|id| {
            root.join("minecraft")
                .join("assets")
                .join("log_configs")
                .join(id.as_str().unwrap_or_default())
                .to_string_lossy()
                .to_string()
        })
        .unwrap_or_default();
    let resolution_width = request.resolution_width.unwrap_or(1920).to_string();
    let resolution_height = request.resolution_height.unwrap_or(1080).to_string();
    let substitutions = HashMap::from([
        ("${auth_player_name}", request.username.as_str()),
        ("${version_name}", profile_id),
        (
            "${game_directory}",
            game_dir
                .to_str()
                .ok_or_else(|| "Instance path is not valid UTF-8.".to_string())?,
        ),
        ("${assets_root}", assets_root_string.as_str()),
        (
            "${assets_index_name}",
            metadata
                .get("assetIndex")
                .and_then(|index| index.get("id"))
                .and_then(Value::as_str)
                .unwrap_or(&request.game_version),
        ),
        ("${auth_uuid}", auth_uuid.as_str()),
        ("${auth_access_token}", access_token),
        ("${auth_session}", access_token),
        ("${path}", logging_path.as_str()),
        ("${user_type}", if offline { "legacy" } else { "msa" }),
        (
            "${version_type}",
            metadata
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("release"),
        ),
        ("${launcher_name}", "TheBoysLauncher"),
        ("${launcher_version}", env!("CARGO_PKG_VERSION")),
        ("${clientid}", "0"),
        ("${auth_xuid}", "0"),
        ("${user_properties}", "{}"),
        ("${resolution_width}", resolution_width.as_str()),
        ("${resolution_height}", resolution_height.as_str()),
        (
            "${natives_directory}",
            natives_dir
                .to_str()
                .ok_or_else(|| "Native library path is not valid UTF-8.".to_string())?,
        ),
        (
            "${library_directory}",
            libraries_dir
                .to_str()
                .ok_or_else(|| "Library path is not valid UTF-8.".to_string())?,
        ),
        ("${classpath}", classpath_value.as_str()),
        ("${classpath_separator}", classpath_separator),
    ]);
    let launch_features = HashMap::from([
        ("has_custom_resolution", true),
        ("has_quick_plays_support", false),
        ("is_demo_user", false),
    ]);
    let mut args = Vec::new();
    if let Some(jvm) = metadata
        .get("arguments")
        .and_then(|args| args.get("jvm"))
        .and_then(Value::as_array)
    {
        for argument in jvm {
            for value in argument_values(argument, &substitutions, &launch_features) {
                args.push(value);
            }
        }
    }
    if let Some(logging_argument) = metadata
        .get("logging")
        .and_then(|logging| logging.get("client"))
        .and_then(|client| client.get("argument"))
        .and_then(Value::as_str)
    {
        let value = substitute(logging_argument, &substitutions);
        if !args.contains(&value) {
            args.push(value);
        }
    }
    if !args
        .iter()
        .any(|argument| argument == "-cp" || argument == "-classpath")
    {
        args.push("-cp".to_string());
        args.push(classpath_value.clone());
    }
    if !args
        .iter()
        .any(|argument| argument.starts_with("-Djava.library.path="))
    {
        args.push(format!("-Djava.library.path={}", natives_dir.display()));
    }
    if !args.iter().any(|argument| argument.starts_with("-Xms")) {
        args.push(format!("-Xms{}M", request.min_ram_mb.max(256)));
    }
    args.push(format!(
        "-Xmx{}M",
        request.max_ram_mb.max(request.min_ram_mb).max(512)
    ));
    for argument in &request.jvm_args {
        if !argument.trim().is_empty() && !args.contains(argument) {
            args.push(argument.clone());
        }
    }
    let main_class = metadata
        .get("mainClass")
        .and_then(Value::as_str)
        .ok_or_else(|| "Minecraft launch profile has no main class.".to_string())?;
    args.push(main_class.to_string());
    if let Some(game_args) = metadata
        .get("arguments")
        .and_then(|args| args.get("game"))
        .and_then(Value::as_array)
    {
        for argument in game_args {
            args.extend(argument_values(argument, &substitutions, &launch_features));
        }
    } else if let Some(legacy_args) = metadata.get("minecraftArguments").and_then(Value::as_str) {
        let parsed = shell_words::split(legacy_args)
            .map_err(|error| format!("Legacy Minecraft launch arguments are invalid: {error}"))?;
        args.extend(parsed.iter().map(|arg| substitute(arg, &substitutions)));
    }
    if !metadata
        .get("arguments")
        .and_then(|args| args.get("game"))
        .is_some()
        && metadata.get("minecraftArguments").is_none()
    {
        return Err("Minecraft version metadata has no game arguments.".to_string());
    }
    if !args.iter().any(|arg| arg == "--gameDir") {
        args.extend([
            "--gameDir".to_string(),
            game_dir.to_string_lossy().to_string(),
        ]);
    }
    if !args.iter().any(|arg| arg == "--width") {
        args.extend(["--width".to_string(), resolution_width]);
    }
    if !args.iter().any(|arg| arg == "--height") {
        args.extend(["--height".to_string(), resolution_height]);
    }
    if request.fullscreen.unwrap_or(false) && !args.iter().any(|arg| arg == "--fullscreen") {
        args.push("--fullscreen".to_string());
    }
    Ok(PreparedLaunch {
        java_path: java_path.to_string(),
        game_dir,
        args,
        required_java_version: metadata
            .get("javaVersion")
            .and_then(|java| java.get("majorVersion"))
            .and_then(Value::as_u64)
            .map(|version| version as u32),
    })
}

fn substitute(value: &str, substitutions: &HashMap<&str, &str>) -> String {
    substitutions
        .iter()
        .fold(value.to_string(), |result, (key, replacement)| {
            result.replace(key, replacement)
        })
}

fn argument_values(
    argument: &Value,
    substitutions: &HashMap<&str, &str>,
    launch_features: &HashMap<&str, bool>,
) -> Vec<String> {
    let (value, rules) = if let Some(object) = argument.as_object() {
        (
            object.get("value"),
            object.get("rules").and_then(Value::as_array),
        )
    } else {
        (Some(argument), None)
    };
    if let Some(rules) = rules {
        let mut allowed = false;
        for rule in rules {
            if rule_matches(rule, Some(launch_features)) {
                allowed = rule.get("action").and_then(Value::as_str) == Some("allow");
            }
        }
        if !allowed {
            return Vec::new();
        }
    }
    let mut output = Vec::new();
    match value {
        Some(Value::String(value)) => output.push(substitute(value, substitutions)),
        Some(Value::Array(values)) => {
            for value in values {
                if let Some(value) = value.as_str() {
                    output.push(substitute(value, substitutions));
                }
            }
        }
        _ => {}
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_instance_path_components() {
        assert!(validate_component("inst_123", "instance ID").is_ok());
        assert!(validate_component("../outside", "instance ID").is_err());
        assert!(validate_component("a/b", "instance ID").is_err());
    }

    #[test]
    fn substitutes_modern_game_arguments() {
        let substitutions = HashMap::from([("${auth_player_name}", "Alex")]);
        let args = argument_values(
            &json!({"value": "--username ${auth_player_name}"}),
            &substitutions,
            &HashMap::new(),
        );
        assert_eq!(args, vec!["--username Alex"]);
    }

    #[test]
    fn applies_loader_rules_for_the_current_platform() {
        assert!(rule_matches(
            &json!({"action":"allow","os":{"name":os_name(),"arch":os_arch()}}),
            None
        ));
        assert!(!rule_matches(
            &json!({"action":"allow","os":{"name":"unavailable-os"}}),
            None
        ));
        assert!(rules_allow(&json!({
            "rules": [
                {"action":"allow"},
                {"action":"disallow","os":{"name":"unavailable-os"}}
            ]
        })));
    }

    #[test]
    fn evaluates_launch_argument_feature_rules() {
        let features = HashMap::from([("has_custom_resolution", true)]);
        let substitutions = HashMap::from([("${resolution_width}", "1280")]);
        let argument = json!({
            "rules": [{"action":"allow","features":{"has_custom_resolution":true}}],
            "value": ["--width", "${resolution_width}"]
        });
        assert_eq!(
            argument_values(&argument, &substitutions, &features),
            vec!["--width", "1280"]
        );
    }

    #[test]
    fn resolves_maven_profile_library_coordinates() {
        let info = maven_artifact_info(&json!({
            "name": "net.fabricmc:fabric-loader:0.16.10",
            "url": "https://maven.fabricmc.net/"
        }))
        .unwrap()
        .unwrap();
        assert_eq!(
            info.1,
            "net/fabricmc/fabric-loader/0.16.10/fabric-loader-0.16.10.jar"
        );
        assert!(info.0.starts_with("https://maven.fabricmc.net/"));
        assert!(maven_artifact_info(&json!({
            "name": "org.example:artifact:1/../../outside",
            "url": "https://maven.example/"
        }))
        .is_err());
    }

    #[test]
    fn merges_inherited_loader_libraries() {
        let base = json!({"id":"1.20","libraries":[{"name":"base"}],"mainClass":"vanilla"});
        let loader = json!({"id":"1.20-fabric","libraries":[{"name":"fabric"}],"mainClass":"fabric.Main","inheritsFrom":"1.20"});
        let merged = merge_loader_profile(&base, &loader, "1.20-fabric");
        assert_eq!(merged["libraries"].as_array().unwrap().len(), 2);
        assert_eq!(merged["mainClass"], "fabric.Main");
        assert!(merged.get("inheritsFrom").is_none());
    }

    #[test]
    fn builds_a_versioned_launch_command_from_metadata() {
        let root =
            std::env::temp_dir().join(format!("theboys-launch-test-{}", uuid::Uuid::new_v4()));
        let version = "1.20.1";
        let profile_dir = root.join("minecraft").join("versions").join(version);
        let instance_dir = root.join("instances").join("test_instance");
        fs::create_dir_all(&profile_dir).unwrap();
        fs::create_dir_all(&instance_dir).unwrap();
        fs::write(profile_dir.join(format!("{version}.jar")), b"test client").unwrap();
        fs::write(
            profile_dir.join(format!("{version}.json")),
            serde_json::to_vec(&json!({
                "id": version,
                "mainClass": "net.minecraft.client.main.Main",
                "type": "release",
                "assets": "1.20",
                "assetIndex": {"id": "1.20"},
                "libraries": [],
                "arguments": {
                    "jvm": ["-Djava.library.path=${natives_directory}"],
                    "game": [
                        "--username", "${auth_player_name}",
                        "--uuid", "${auth_uuid}",
                        "--accessToken", "${auth_access_token}",
                        "--userType", "${user_type}",
                        "--version", "${version_name}",
                        "--assetsDir", "${assets_root}"
                    ]
                }
            }))
            .unwrap(),
        )
        .unwrap();
        fs::write(
            instance_dir.join("launch-profile.json"),
            serde_json::to_vec(&json!({
                "gameVersion": version,
                "profileId": version,
                "loader": "vanilla",
                "loaderVersion": null
            }))
            .unwrap(),
        )
        .unwrap();
        let java = std::env::current_exe().unwrap();
        let request = crate::LaunchRequest {
            instance_id: "test_instance".to_string(),
            instance_name: "Test".to_string(),
            game_version: version.to_string(),
            loader: "vanilla".to_string(),
            loader_version: None,
            java_path: Some(java.to_string_lossy().to_string()),
            min_ram_mb: 1024,
            max_ram_mb: 2048,
            username: "Alex".to_string(),
            uuid: "01234567-89ab-cdef-0123-456789abcdef".to_string(),
            access_token: "offline".to_string(),
            jvm_args: Vec::new(),
            graphics_api: "opengl".to_string(),
            low_spec_mode: None,
            dedicated_gpu: None,
            server_address: None,
            resolution_width: Some(1280),
            resolution_height: Some(720),
            fullscreen: Some(true),
            custom_game_dir: None,
        };
        let prepared = prepare_launch(&root, &request).unwrap();
        assert!(prepared
            .args
            .contains(&"net.minecraft.client.main.Main".to_string()));
        assert!(prepared.args.contains(&"Alex".to_string()));
        assert!(prepared
            .args
            .contains(&"0123456789abcdef0123456789abcdef".to_string()));
        assert!(prepared.args.contains(&"0".to_string()));
        assert!(prepared.args.contains(&"legacy".to_string()));
        assert!(prepared.args.contains(&"--fullscreen".to_string()));
        assert!(prepared.args.contains(&"1280".to_string()));
        assert_eq!(prepared.game_dir, instance_dir);
        fs::remove_dir_all(root).unwrap();
    }
}
