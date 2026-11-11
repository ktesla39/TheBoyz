use base64::{engine::general_purpose::STANDARD, Engine as _};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

mod minecraft;

static RUNNING_PROCESSES: Mutex<Option<HashMap<String, u32>>> = Mutex::new(None);

fn suppress_console_window(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    #[cfg(not(windows))]
    let _ = command;
}

fn suppress_tokio_console_window(command: &mut tokio::process::Command) {
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    #[cfg(not(windows))]
    let _ = command;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchRequest {
    pub instance_id: String,
    pub instance_name: String,
    pub game_version: String,
    pub loader: String,
    pub loader_version: Option<String>,
    pub java_path: Option<String>,
    pub min_ram_mb: u32,
    pub max_ram_mb: u32,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub jvm_args: Vec<String>,
    pub graphics_api: String,
    pub low_spec_mode: Option<bool>,
    pub dedicated_gpu: Option<bool>,
    pub server_address: Option<String>,
    #[serde(default)]
    pub resolution_width: Option<u32>,
    #[serde(default)]
    pub resolution_height: Option<u32>,
    #[serde(default)]
    pub fullscreen: Option<bool>,
    #[serde(default)]
    pub custom_game_dir: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchResult {
    pub success: bool,
    pub pid: Option<u32>,
    pub executable: String,
    pub args: Vec<String>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub os: String,
    pub os_version: String,
    pub total_memory_mb: u64,
    pub available_memory_mb: u64,
    pub cpu_brand: String,
    pub cpu_cores: usize,
    pub disk_free_gb: u64,
    pub is_low_spec: bool,
    pub recommended_ram_mb: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JavaInstallation {
    pub path: String,
    pub major_version: u32,
    pub full_version: String,
    pub vendor: Option<String>,
    pub is_64_bit: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MicrosoftCredentials {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ElyBySkinResponse {
    pub username: String,
    pub skin_url: String,
    pub cape_url: Option<String>,
    pub exists: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HashVerificationResult {
    pub file_path: String,
    pub computed_sha1: String,
    pub computed_sha256: String,
    pub matches: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerPingResult {
    pub address: String,
    pub online: bool,
    pub ping_ms: u64,
    pub motd: Option<String>,
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModItem {
    pub file_name: String,
    pub name: String,
    pub enabled: bool,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstanceItem {
    pub id: String,
    pub name: String,
    pub game_version: String,
    pub loader: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct InstanceMetadata {
    id: String,
    name: String,
    game_version: String,
    loader: String,
}

#[derive(Debug, Serialize)]
struct ImportedInstanceInfo {
    id: String,
    name: String,
    game_version: String,
    loader: String,
    loader_version: Option<String>,
    custom_game_dir: String,
    mods: Vec<ModItem>,
}

fn validate_instance_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 128
        || id == "."
        || id == ".."
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err("Invalid instance ID.".to_string());
    }
    Ok(())
}

fn validate_mod_file_name(file_name: &str) -> Result<(), String> {
    if file_name.is_empty()
        || file_name.len() > 255
        || file_name.contains(['/', '\\', ':'])
        || file_name.chars().any(char::is_control)
        || !(file_name.ends_with(".jar") || file_name.ends_with(".jar.disabled"))
    {
        return Err("Invalid mod file name.".to_string());
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
struct CurseForgeSearchResponse {
    data: Vec<CurseForgeMod>,
    pagination: CurseForgePagination,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgePagination {
    total_count: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeMod {
    id: u32,
    name: String,
    slug: String,
    summary: String,
    download_count: u64,
    class_id: Option<u32>,
    logo: Option<CurseForgeLogo>,
    authors: Vec<CurseForgeAuthor>,
    latest_files_indexes: Vec<CurseForgeLatestFileIndex>,
    links: Option<CurseForgeLinks>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeLogo {
    url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeAuthor {
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeLatestFileIndex {
    game_version: String,
    mod_loader: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeLinks {
    website_url: Option<String>,
}

fn curseforge_key_entry() -> Result<Entry, String> {
    Entry::new("TheBoysLauncher", "curseforge_api_key")
        .map_err(|error| format!("Could not access the OS credential store: {error}"))
}

fn microsoft_credentials_entry(account_id: &str, field: &str) -> Result<Entry, String> {
    if account_id.len() != 32 || !account_id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Invalid Microsoft account ID.".to_string());
    }
    if !matches!(field, "access" | "refresh" | "expiry") {
        return Err("Invalid Microsoft credential field.".to_string());
    }
    Entry::new(
        "TheBoysLauncher",
        &format!("microsoft_{account_id}_{field}"),
    )
    .map_err(|error| format!("Could not access the OS credential store: {error}"))
}

fn read_microsoft_credential(account_id: &str, field: &str) -> Result<Option<String>, String> {
    match microsoft_credentials_entry(account_id, field)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "Could not read Microsoft credentials from the OS credential store: {error}"
        )),
    }
}

#[tauri::command]
fn save_microsoft_credentials(
    account_id: String,
    access_token: String,
    refresh_token: Option<String>,
    expires_at: u64,
) -> Result<(), String> {
    if access_token.trim().is_empty() {
        return Err("Microsoft access token cannot be empty.".to_string());
    }
    microsoft_credentials_entry(&account_id, "access")?
        .set_password(&access_token)
        .map_err(|error| {
            format!("Could not save Microsoft access token to the OS credential store: {error}")
        })?;
    match refresh_token.filter(|token| !token.trim().is_empty()) {
        Some(token) => microsoft_credentials_entry(&account_id, "refresh")?
            .set_password(&token)
            .map_err(|error| {
                format!(
                    "Could not save Microsoft refresh token to the OS credential store: {error}"
                )
            })?,
        None => match microsoft_credentials_entry(&account_id, "refresh")?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => (),
            Err(error) => {
                return Err(format!(
                    "Could not clear an old Microsoft refresh token: {error}"
                ))
            }
        },
    }
    microsoft_credentials_entry(&account_id, "expiry")?
        .set_password(&expires_at.to_string())
        .map_err(|error| {
            format!("Could not save Microsoft token expiry to the OS credential store: {error}")
        })
}

#[tauri::command]
fn get_microsoft_credentials(account_id: String) -> Result<Option<MicrosoftCredentials>, String> {
    let Some(access_token) = read_microsoft_credential(&account_id, "access")? else {
        return Ok(None);
    };
    let refresh_token = read_microsoft_credential(&account_id, "refresh")?;
    let expires_at = read_microsoft_credential(&account_id, "expiry")?
        .ok_or_else(|| "Stored Microsoft token expiry is missing.".to_string())?
        .parse::<u64>()
        .map_err(|error| format!("Stored Microsoft token expiry is invalid: {error}"))?;
    Ok(Some(MicrosoftCredentials {
        access_token,
        refresh_token,
        expires_at,
    }))
}

#[tauri::command]
fn clear_microsoft_credentials(account_id: String) -> Result<(), String> {
    for field in ["access", "refresh", "expiry"] {
        match microsoft_credentials_entry(&account_id, field)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => (),
            Err(error) => {
                return Err(format!(
                    "Could not remove Microsoft credentials from the OS credential store: {error}"
                ))
            }
        }
    }
    Ok(())
}

fn get_curseforge_api_key() -> Result<Option<String>, String> {
    if cfg!(debug_assertions) {
        if let Ok(value) = std::env::var("CURSEFORGE_API_KEY") {
            if !value.trim().is_empty() {
                return Ok(Some(value.trim().to_string()));
            }
        }

        let project_root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or_else(|| {
                "Could not resolve the project root for development configuration.".to_string()
            })?;
        let env_path = project_root.join(".env");
        if env_path.is_file() {
            let entries = dotenvy::from_path_iter(&env_path)
                .map_err(|error| format!("Could not read development environment file: {error}"))?;
            for entry in entries {
                let (key, value) = entry.map_err(|error| {
                    format!("Could not parse development environment file: {error}")
                })?;
                if key == "CURSEFORGE_API_KEY" && !value.trim().is_empty() {
                    return Ok(Some(value.trim().to_string()));
                }
            }
        }
    }

    match curseforge_key_entry()?.get_password() {
        Ok(value) if !value.trim().is_empty() => Ok(Some(value)),
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "Could not read the CurseForge key from the OS credential store: {error}"
        )),
    }
}

#[tauri::command]
fn get_curseforge_key_status() -> Result<bool, String> {
    Ok(get_curseforge_api_key()?.is_some())
}

#[tauri::command]
fn save_curseforge_api_key(api_key: String) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("CurseForge API key cannot be empty.".to_string());
    }
    curseforge_key_entry()?
        .set_password(api_key)
        .map_err(|error| {
            format!("Could not save the CurseForge key to the OS credential store: {error}")
        })
}

#[tauri::command]
fn clear_curseforge_api_key() -> Result<(), String> {
    match curseforge_key_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Could not remove the CurseForge key from the OS credential store: {error}"
        )),
    }
}

#[tauri::command]
async fn search_curseforge(
    query: Option<String>,
    class_id: Option<u32>,
    game_version: Option<String>,
    mod_loader_type: Option<u32>,
    sort_field: u32,
    index: u32,
    page_size: u32,
) -> Result<serde_json::Value, String> {
    let api_key = get_curseforge_api_key()?
        .ok_or_else(|| "CurseForge API key is unavailable. Save it in Launcher Settings or configure CURSEFORGE_API_KEY for development.".to_string())?;

    let page_size = page_size.clamp(1, 50);
    let client = reqwest::Client::new();
    let mut request = client
        .get("https://api.curseforge.com/v1/mods/search")
        .header("x-api-key", api_key)
        .query(&[("gameId", "432".to_string())])
        .query(&[
            ("index", index.to_string()),
            ("pageSize", page_size.to_string()),
            ("sortField", sort_field.to_string()),
            (
                "sortOrder",
                if sort_field == 4 { "asc" } else { "desc" }.to_string(),
            ),
        ]);

    if let Some(query) = query
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        request = request.query(&[("searchFilter", query)]);
    }
    if let Some(class_id) = class_id {
        request = request.query(&[("classId", class_id.to_string())]);
    }
    if let Some(game_version) = game_version.as_deref().filter(|value| *value != "all") {
        request = request.query(&[("gameVersion", game_version)]);
    }
    if let Some(mod_loader_type) = mod_loader_type {
        request = request.query(&[("modLoaderType", mod_loader_type.to_string())]);
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("CurseForge search request failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "CurseForge search failed with HTTP status {}.",
            response.status()
        ));
    }

    let data: CurseForgeSearchResponse = response
        .json()
        .await
        .map_err(|error| format!("CurseForge returned an invalid search response: {error}"))?;

    Ok(serde_json::json!({
        "totalCount": data.pagination.total_count,
        "data": data.data.into_iter().map(|item| {
            let game_versions: Vec<String> = item.latest_files_indexes.iter()
                .map(|file| file.game_version.clone())
                .collect();
            let loaders: Vec<u32> = item.latest_files_indexes.iter()
                .filter_map(|file| file.mod_loader)
                .collect();
            serde_json::json!({
                "id": item.id,
                "name": item.name,
                "slug": item.slug,
                "summary": item.summary,
                "downloadCount": item.download_count,
                "classId": item.class_id,
                "logoUrl": item.logo.map(|logo| logo.url),
                "author": item.authors.into_iter().map(|author| author.name).collect::<Vec<_>>().join(", "),
                "gameVersions": game_versions,
                "loaders": loaders,
                "websiteUrl": item.links.and_then(|links| links.website_url),
            })
        }).collect::<Vec<_>>()
    }))
}

/// Helper to get application base data directory
fn get_app_data_dir() -> Result<PathBuf, String> {
    if let Some(local_app_data) = std::env::var("LOCALAPPDATA")
        .ok()
        .filter(|path| !path.trim().is_empty())
    {
        Ok(PathBuf::from(local_app_data).join("TheBoysLauncher"))
    } else if let Some(home) = std::env::var("HOME")
        .ok()
        .filter(|path| !path.trim().is_empty())
    {
        Ok(PathBuf::from(home).join(".theboys-launcher"))
    } else {
        Err("Could not determine the launcher data directory from the environment.".to_string())
    }
}

/// Retrieves hardware specifications and detects older hardware constraints
#[tauri::command]
fn get_system_hardware() -> Result<HardwareInfo, String> {
    let rk = RefreshKind::new()
        .with_cpu(CpuRefreshKind::everything())
        .with_memory(MemoryRefreshKind::everything());
    let mut sys = System::new_with_specifics(rk);
    sys.refresh_all();

    let total_memory_mb = sys.total_memory() / (1024 * 1024);
    let available_memory_mb = sys.available_memory() / (1024 * 1024);
    let cpu_cores = sys.cpus().len();
    if cpu_cores == 0 {
        return Err("The system did not report any CPU cores.".to_string());
    }
    let cpu_brand = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|brand| !brand.is_empty())
        .ok_or_else(|| "The system did not report a CPU model.".to_string())?;

    let disks = Disks::new_with_refreshed_list();
    let disk_free_gb = disks
        .list()
        .first()
        .map(|d| d.available_space() / (1024 * 1024 * 1024))
        .ok_or_else(|| "The system did not report an available disk.".to_string())?;

    let is_low_spec = total_memory_mb <= 4096 || cpu_cores <= 2;
    let recommended_ram_mb = if total_memory_mb <= 4096 {
        2048
    } else if total_memory_mb <= 8192 {
        4096
    } else if total_memory_mb <= 16384 {
        6144
    } else {
        8192
    };

    Ok(HardwareInfo {
        os: std::env::consts::OS.to_string(),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        total_memory_mb,
        available_memory_mb,
        cpu_brand,
        cpu_cores,
        disk_free_gb,
        is_low_spec,
        recommended_ram_mb,
    })
}

/// Starts the configured Java process for a Minecraft instance.
#[tauri::command]
async fn launch_game(app: AppHandle, payload: LaunchRequest) -> Result<LaunchResult, String> {
    minecraft::register_progress_app(app.clone());
    log::info!(
        "Preparing {} (Minecraft {}, {})",
        payload.instance_name,
        payload.game_version,
        payload.loader
    );
    if payload.access_token == "offline" && payload.uuid.trim().is_empty() {
        return Err("Offline account UUID cannot be empty.".to_string());
    }
    let root = get_app_data_dir()?;
    let install_result = minecraft::install_instance(
        &root,
        minecraft::InstallRequest {
            instance_id: payload.instance_id.clone(),
            instance_name: payload.instance_name.clone(),
            game_version: payload.game_version.clone(),
            loader: payload.loader.clone(),
            loader_version: payload.loader_version.clone(),
            java_path: payload.java_path.clone(),
            custom_game_dir: payload.custom_game_dir.clone(),
        },
    )
    .await?;
    log::info!("{install_result}");
    minecraft::emit_launcher_progress(
        "preparing",
        "Preparing Java and game launch settings",
        None,
        0,
        None,
    );
    let prepared = minecraft::prepare_launch(&root, &payload)?;
    let java_bin = prepared.java_path;
    let required_java_version = prepared.required_java_version;
    let args = prepared.args;

    let mut java_version_command = tokio::process::Command::new(&java_bin);
    suppress_tokio_console_window(&mut java_version_command);
    let java_version_output = java_version_command
        .arg("-version")
        .output()
        .await
        .map_err(|error| format!("Could not inspect Java executable \"{java_bin}\": {error}"))?;
    if !java_version_output.status.success() {
        return Err(format!(
            "Java executable failed its version check: {}",
            String::from_utf8_lossy(&java_version_output.stderr)
        ));
    }
    if let Some(required) = required_java_version {
        let version_text = format!(
            "{}{}",
            String::from_utf8_lossy(&java_version_output.stdout),
            String::from_utf8_lossy(&java_version_output.stderr)
        );
        let detected = java_major_version(&version_text)
            .ok_or_else(|| "Could not determine the selected Java runtime version.".to_string())?;
        if detected < required {
            return Err(format!(
                "Minecraft {} requires Java {required} or newer, but the selected runtime is Java {detected}.",
                payload.game_version
            ));
        }
    }

    minecraft::emit_launcher_progress("launching", "Starting Minecraft", None, 0, None);
    let mut running = RUNNING_PROCESSES
        .lock()
        .map_err(|_| "The launcher process registry is unavailable.".to_string())?;
    let processes = running.get_or_insert_with(HashMap::new);
    if let Some(pid) = processes.get(&payload.instance_id) {
        let mut system = System::new();
        system.refresh_processes();
        if system.process(sysinfo::Pid::from_u32(*pid)).is_some() {
            return Err(format!(
                "Instance '{}' is already running (process {pid}).",
                payload.instance_name
            ));
        }
        processes.remove(&payload.instance_id);
    }
    let mut game_command = Command::new(&java_bin);
    suppress_console_window(&mut game_command);
    let child = game_command
        .args(&args)
        .current_dir(&prepared.game_dir)
        .spawn()
        .map_err(|error| format!("Failed to start Java at \"{java_bin}\": {error}"))?;
    let spawned_pid = child.id();
    minecraft::emit_launcher_progress("started", "Minecraft started", None, 0, None);
    processes.insert(payload.instance_id.clone(), spawned_pid);
    drop(running);
    let mut safe_args = args.clone();
    for index in 0..safe_args.len().saturating_sub(1) {
        if matches!(
            safe_args[index].as_str(),
            "--accessToken" | "--session" | "--password"
        ) {
            safe_args[index + 1] = "<redacted>".to_string();
        }
    }

    Ok(LaunchResult {
        success: true,
        pid: Some(spawned_pid),
        executable: java_bin,
        args: safe_args,
        message: format!(
            "Minecraft {} ({}) started for instance '{}' as process {}.",
            payload.game_version, payload.loader, payload.instance_name, spawned_pid
        ),
    })
}

fn java_major_version(version_output: &str) -> Option<u32> {
    let version = version_output
        .lines()
        .find(|line| line.to_lowercase().contains("version"))?
        .split('"')
        .nth(1)?;
    let mut parts = version.split('.');
    let first = parts.next()?.parse::<u32>().ok()?;
    if first == 1 {
        parts.next()?.parse::<u32>().ok()
    } else {
        Some(first)
    }
}

#[tauri::command]
async fn install_minecraft_instance(
    app: AppHandle,
    request: minecraft::InstallRequest,
) -> Result<String, String> {
    minecraft::register_progress_app(app);
    minecraft::install_instance(&get_app_data_dir()?, request).await
}

/// Stops a running game instance process
#[tauri::command]
fn stop_game(pid: u32) -> Result<bool, String> {
    let mut running = RUNNING_PROCESSES
        .lock()
        .map_err(|_| "The launcher process registry is unavailable.".to_string())?;
    let processes = running.get_or_insert_with(HashMap::new);
    let Some(instance_id) = processes
        .iter()
        .find_map(|(instance_id, tracked_pid)| (*tracked_pid == pid).then(|| instance_id.clone()))
    else {
        return Err("The requested process was not started by this launcher session.".to_string());
    };
    let mut s = System::new();
    s.refresh_processes();
    let sys_pid = sysinfo::Pid::from_u32(pid);
    if let Some(process) = s.process(sys_pid) {
        if !process.kill() {
            return Err(format!("Could not stop game process {pid}."));
        }
        processes.remove(&instance_id);
        Ok(true)
    } else {
        processes.remove(&instance_id);
        Ok(false)
    }
}

/// Checks if a PID is actively executing
#[tauri::command]
fn is_game_running(pid: u32) -> Result<bool, String> {
    let mut running = RUNNING_PROCESSES
        .lock()
        .map_err(|_| "The launcher process registry is unavailable.".to_string())?;
    let processes = running.get_or_insert_with(HashMap::new);
    if !processes.values().any(|tracked_pid| *tracked_pid == pid) {
        return Ok(false);
    }
    let mut s = System::new();
    s.refresh_processes();
    let sys_pid = sysinfo::Pid::from_u32(pid);
    let active = s.process(sys_pid).is_some();
    if !active {
        processes.retain(|_, tracked_pid| *tracked_pid != pid);
    }
    Ok(active)
}

fn inspect_java_binary(version_binary: &Path, launch_binary: &Path) -> Option<JavaInstallation> {
    let mut command = Command::new(version_binary);
    suppress_console_window(&mut command);
    let output = command.arg("-version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let version_output = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let full_version = version_output
        .lines()
        .find(|line| line.to_lowercase().contains("version"))
        .and_then(|line| line.split('"').nth(1))?
        .to_string();
    let major_version = java_major_version(&version_output)?;
    let first_line = version_output
        .lines()
        .next()
        .unwrap_or_default()
        .to_lowercase();
    let vendor = if first_line.contains("openjdk") {
        Some("OpenJDK".to_string())
    } else if first_line.contains("java(tm)") {
        Some("Oracle Java".to_string())
    } else {
        None
    };
    let is_64_bit = if version_output.contains("64-Bit") || version_output.contains("64-bit") {
        Some(true)
    } else if version_output.contains("32-Bit") || version_output.contains("32-bit") {
        Some(false)
    } else {
        None
    };
    Some(JavaInstallation {
        path: launch_binary.to_string_lossy().to_string(),
        major_version,
        full_version,
        vendor,
        is_64_bit,
    })
}

fn add_java_candidate(
    version_binary: &Path,
    preferred_launch_binary: &Path,
    installations: &mut Vec<JavaInstallation>,
) {
    if !version_binary.is_file() {
        return;
    }
    let launch_binary = if preferred_launch_binary.is_file() {
        preferred_launch_binary
    } else {
        version_binary
    };
    let candidate_path = launch_binary
        .canonicalize()
        .unwrap_or_else(|_| launch_binary.to_path_buf());
    if installations.iter().any(|installed| {
        Path::new(&installed.path)
            .canonicalize()
            .unwrap_or_else(|_| PathBuf::from(&installed.path))
            == candidate_path
    }) {
        return;
    }
    if let Some(installation) = inspect_java_binary(version_binary, launch_binary) {
        installations.push(installation);
    }
}

fn scan_java_directory(
    root: &Path,
    remaining_depth: usize,
    installations: &mut Vec<JavaInstallation>,
) {
    let version_name = if cfg!(target_os = "windows") {
        "java.exe"
    } else {
        "java"
    };
    let launch_name = if cfg!(target_os = "windows") {
        "javaw.exe"
    } else {
        "java"
    };
    let version_binary = root.join("bin").join(version_name);
    let launch_binary = root.join("bin").join(launch_name);
    add_java_candidate(&version_binary, &launch_binary, installations);
    if remaining_depth == 0 {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if matches!(
                name.as_str(),
                "node_modules" | "windowsapps" | "cache" | "logs" | "assets" | "libraries"
            ) {
                continue;
            }
            scan_java_directory(&entry.path(), remaining_depth - 1, installations);
        }
    }
}

/// Detects installed Java runtimes from standard locations, user runtimes, JAVA_HOME, and PATH.
#[tauri::command]
fn detect_java_installations() -> Result<Vec<JavaInstallation>, String> {
    let mut installations = Vec::new();
    let mut roots = Vec::<PathBuf>::new();
    if let Some(java_home) = std::env::var_os("JAVA_HOME") {
        roots.push(PathBuf::from(java_home));
    }
    if cfg!(target_os = "windows") {
        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            let base = PathBuf::from(program_files);
            for vendor in [
                "Java",
                "Microsoft",
                "Eclipse Adoptium",
                "BellSoft",
                "Amazon Corretto",
                "Zulu",
            ] {
                roots.push(base.join(vendor));
            }
        }
        if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
            roots.push(PathBuf::from(program_files_x86).join("Java"));
        }
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let local = PathBuf::from(local_app_data);
            roots.extend([
                local.join("Programs").join("Microsoft"),
                local.join("Programs").join("Eclipse Adoptium"),
                local.join("Programs").join("Eclipse Foundation"),
            ]);
        }
        if let Some(app_data) = std::env::var_os("APPDATA") {
            roots.push(PathBuf::from(app_data).join(".minecraft").join("runtime"));
        }
        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            let profile = PathBuf::from(user_profile);
            roots.push(profile.join(".minecraft").join("runtime"));
            roots.push(profile.join(".jdks"));
        }
    } else if cfg!(target_os = "macos") {
        roots.push(PathBuf::from("/Library/Java/JavaVirtualMachines"));
    } else {
        roots.extend([PathBuf::from("/usr/lib/jvm"), PathBuf::from("/usr/java")]);
    }

    for root in roots {
        if root.is_dir() {
            scan_java_directory(&root, 5, &mut installations);
        }
    }
    if let Some(path_var) = std::env::var_os("PATH") {
        let version_name = if cfg!(target_os = "windows") {
            "java.exe"
        } else {
            "java"
        };
        let launch_name = if cfg!(target_os = "windows") {
            "javaw.exe"
        } else {
            "java"
        };
        for directory in std::env::split_paths(&path_var) {
            add_java_candidate(
                &directory.join(version_name),
                &directory.join(launch_name),
                &mut installations,
            );
        }
    }
    installations.sort_by_key(|installation| installation.major_version);
    Ok(installations)
}

/// Validates whether a given Java binary exists and can execute
#[tauri::command]
fn validate_java_path(java_path: String) -> Result<bool, String> {
    let path = Path::new(&java_path);
    if !path.is_file() {
        return Ok(false);
    }
    let mut command = Command::new(path);
    suppress_console_window(&mut command);
    let output = command.arg("-version").output();
    Ok(output.is_ok_and(|result| result.status.success()))
}

/// Queries Ely.by skinsystem for an offline account's skin & cloak
#[tauri::command]
async fn fetch_ely_by_skin(username: String) -> Result<ElyBySkinResponse, String> {
    let clean = username.trim();
    let skin_url = format!("http://skinsystem.ely.by/textures/{}", clean);
    let cape_url = format!("http://skinsystem.ely.by/cloaks/{}", clean);

    Ok(ElyBySkinResponse {
        username: clean.to_string(),
        skin_url,
        cape_url: Some(cape_url),
        exists: true,
    })
}

/// Verifies file integrity using SHA-1 and SHA-256 for mods and version jars
#[tauri::command]
fn verify_file_hash(
    file_path: String,
    expected_sha1: Option<String>,
) -> Result<HashVerificationResult, String> {
    use sha1::Digest;
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let bytes = fs::read(&path).map_err(|e| e.to_string())?;

    let mut sha1_hasher = sha1::Sha1::new();
    sha1_hasher.update(&bytes);
    let computed_sha1 = hex::encode(sha1_hasher.finalize());

    let mut sha256_hasher = sha2::Sha256::new();
    sha256_hasher.update(&bytes);
    let computed_sha256 = hex::encode(sha256_hasher.finalize());

    let matches = match expected_sha1 {
        Some(exp) => computed_sha1.eq_ignore_ascii_case(&exp),
        None => true,
    };

    Ok(HashVerificationResult {
        file_path,
        computed_sha1,
        computed_sha256,
        matches,
    })
}

/// Saves an uploaded skin PNG file into the local instance skins directory
#[tauri::command]
fn save_skin_file(username: String, base64_png: String) -> Result<String, String> {
    let clean = username.trim();
    if clean.is_empty() {
        return Err("Username is required to save a skin.".to_string());
    }
    let safe_name = clean.replace(|c: char| !c.is_alphanumeric(), "_");
    let file_name = format!("skin_{}.png", safe_name);

    let skins_dir = get_app_data_dir()?.join("skins");
    fs::create_dir_all(&skins_dir).map_err(|error| error.to_string())?;
    let target = skins_dir.join(&file_name);

    // If data URI prefix present, strip it
    let clean_base64 = if let Some(idx) = base64_png.find("base64,") {
        &base64_png[idx + 7..]
    } else {
        &base64_png
    };

    let bytes = STANDARD
        .decode(clean_base64)
        .map_err(|error| format!("Skin image data is not valid base64: {error}"))?;
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("Skin image data is not a PNG file.".to_string());
    }
    fs::write(&target, bytes).map_err(|error| error.to_string())?;

    Ok(target.to_string_lossy().to_string())
}

fn write_protocol_varint(mut value: u32, output: &mut Vec<u8>) {
    loop {
        if value & !0x7f == 0 {
            output.push(value as u8);
            return;
        }
        output.push(((value & 0x7f) | 0x80) as u8);
        value >>= 7;
    }
}

fn append_protocol_string(value: &str, output: &mut Vec<u8>) {
    write_protocol_varint(value.len() as u32, output);
    output.extend_from_slice(value.as_bytes());
}

fn read_stream_varint(stream: &mut TcpStream) -> Result<u32, String> {
    let mut result = 0u32;
    for index in 0..5 {
        let mut byte = [0u8; 1];
        stream
            .read_exact(&mut byte)
            .map_err(|error| format!("Could not read Minecraft status response: {error}"))?;
        result |= u32::from(byte[0] & 0x7f) << (index * 7);
        if byte[0] & 0x80 == 0 {
            return Ok(result);
        }
    }
    Err("Minecraft status response contains an invalid VarInt.".to_string())
}

fn decode_protocol_varint(bytes: &[u8], cursor: &mut usize) -> Result<u32, String> {
    let mut result = 0u32;
    for index in 0..5 {
        let byte = *bytes
            .get(*cursor)
            .ok_or_else(|| "Minecraft status response is truncated.".to_string())?;
        *cursor += 1;
        result |= u32::from(byte & 0x7f) << (index * 7);
        if byte & 0x80 == 0 {
            return Ok(result);
        }
    }
    Err("Minecraft status response contains an invalid VarInt.".to_string())
}

fn description_text(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Array(parts) => parts.iter().map(description_text).collect(),
        serde_json::Value::Object(object) => {
            let mut result = object
                .get("text")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .to_string();
            if let Some(extra) = object.get("extra").and_then(serde_json::Value::as_array) {
                result.push_str(&extra.iter().map(description_text).collect::<String>());
            }
            result
        }
        _ => String::new(),
    }
}

fn request_minecraft_status(
    stream: &mut TcpStream,
    host: &str,
    port: u16,
) -> Result<serde_json::Value, String> {
    let mut handshake = Vec::new();
    write_protocol_varint(0, &mut handshake);
    write_protocol_varint(767, &mut handshake);
    append_protocol_string(host, &mut handshake);
    handshake.extend_from_slice(&port.to_be_bytes());
    write_protocol_varint(1, &mut handshake);

    let mut packet = Vec::new();
    write_protocol_varint(handshake.len() as u32, &mut packet);
    packet.extend_from_slice(&handshake);
    stream
        .write_all(&packet)
        .and_then(|_| stream.write_all(&[1, 0]))
        .map_err(|error| format!("Could not send Minecraft status request: {error}"))?;

    let packet_length = read_stream_varint(stream)? as usize;
    if packet_length == 0 || packet_length > 1_048_576 {
        return Err("Minecraft status response has an invalid packet size.".to_string());
    }
    let mut response = vec![0u8; packet_length];
    stream
        .read_exact(&mut response)
        .map_err(|error| format!("Could not read Minecraft status packet: {error}"))?;
    let mut cursor = 0;
    if decode_protocol_varint(&response, &mut cursor)? != 0 {
        return Err("Minecraft server returned an unexpected status packet.".to_string());
    }
    let json_length = decode_protocol_varint(&response, &mut cursor)? as usize;
    let json_end = cursor
        .checked_add(json_length)
        .filter(|end| *end <= response.len())
        .ok_or_else(|| "Minecraft status JSON is truncated.".to_string())?;
    serde_json::from_slice(&response[cursor..json_end])
        .map_err(|error| format!("Minecraft server returned invalid status JSON: {error}"))
}

/// Performs the Minecraft Server List Ping handshake and reads status metadata.
#[tauri::command]
async fn ping_minecraft_server(address: String) -> Result<ServerPingResult, String> {
    let clean = address.trim().to_string();
    if clean.is_empty() {
        return Err("Server address is required.".to_string());
    }

    let (host, port) = if let Some((host, port)) = clean.rsplit_once(':') {
        if host.is_empty() {
            return Err("Server host is required.".to_string());
        }
        let port = port
            .parse::<u16>()
            .map_err(|_| format!("Invalid server port in address \"{clean}\"."))?;
        (host, port)
    } else {
        (clean.as_str(), 25565)
    };

    let start = Instant::now();
    let socket_str = format!("{host}:{port}");
    let mut stream = match socket_str
        .to_socket_addrs()
        .map_err(|error| format!("Could not resolve server address: {error}"))?
        .find_map(|address| TcpStream::connect_timeout(&address, Duration::from_millis(2500)).ok())
    {
        Some(stream) => stream,
        None => {
            return Ok(ServerPingResult {
                address: clean,
                online: false,
                ping_ms: start.elapsed().as_millis() as u64,
                motd: None,
                players_online: None,
                players_max: None,
            });
        }
    };
    stream
        .set_read_timeout(Some(Duration::from_millis(2500)))
        .map_err(|error| format!("Could not configure server ping timeout: {error}"))?;
    stream
        .set_write_timeout(Some(Duration::from_millis(2500)))
        .map_err(|error| format!("Could not configure server ping timeout: {error}"))?;
    let status = request_minecraft_status(&mut stream, host, port)?;
    let ping_ms = start.elapsed().as_millis() as u64;
    let players = status.get("players");

    Ok(ServerPingResult {
        address: clean,
        online: true,
        ping_ms,
        motd: status.get("description").map(description_text),
        players_online: players
            .and_then(|players| players.get("online"))
            .and_then(serde_json::Value::as_u64)
            .and_then(|players| u32::try_from(players).ok()),
        players_max: players
            .and_then(|players| players.get("max"))
            .and_then(serde_json::Value::as_u64)
            .and_then(|players| u32::try_from(players).ok()),
    })
}

/// Creates a 1-click Windows or Linux Desktop shortcut
#[tauri::command]
fn create_desktop_shortcut(instance_name: String, instance_id: String) -> Result<String, String> {
    validate_instance_id(&instance_id)?;
    let safe_name = instance_name.replace(|c: char| !c.is_alphanumeric() && c != ' ', "_");

    if !cfg!(target_os = "windows") {
        return Err("Desktop shortcut creation is not supported on this platform.".to_string());
    }

    let user_profile = std::env::var("USERPROFILE")
        .map_err(|_| "Could not determine the current user's home directory.".to_string())?;
    let desktop = PathBuf::from(user_profile).join("Desktop");
    let bat_path = desktop.join(format!("{}.bat", safe_name));
    let content = format!(
        "@echo off\r\nstart \"\" \"the-boys-launcher.exe\" --launch-instance {}\r\n",
        instance_id
    );
    fs::write(&bat_path, content).map_err(|e| e.to_string())?;
    Ok(bat_path.to_string_lossy().to_string())
}

/// Lists all instances stored in the local file system
#[tauri::command]
fn list_instances() -> Result<Vec<InstanceItem>, String> {
    let instances_dir = get_app_data_dir()?.join("instances");
    let mut list = Vec::new();

    if !instances_dir.exists() {
        return Ok(list);
    }

    let entries = fs::read_dir(&instances_dir).map_err(|error| error.to_string())?;
    for entry in entries {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.is_dir() {
            let metadata: InstanceMetadata = serde_json::from_slice(
                &fs::read(path.join("instance.json")).map_err(|error| error.to_string())?,
            )
            .map_err(|error| format!("Invalid instance metadata at {}: {error}", path.display()))?;
            list.push(InstanceItem {
                id: metadata.id,
                name: metadata.name,
                game_version: metadata.game_version,
                loader: metadata.loader,
                path: path.to_string_lossy().to_string(),
            });
        }
    }

    Ok(list)
}

fn version_from_identifier(identifier: &str) -> Option<String> {
    identifier
        .split(|character: char| !character.is_ascii_digit() && character != '.')
        .find(|candidate| {
            let parts: Vec<_> = candidate.split('.').collect();
            candidate.starts_with("1.")
                && parts.len() >= 2
                && parts
                    .iter()
                    .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
        })
        .map(str::to_string)
}

fn loader_from_identifier(identifier: &str) -> (String, Option<String>) {
    for (marker, loader) in [
        ("fabric-loader-", "fabric"),
        ("fabric-", "fabric"),
        ("quilt-loader-", "quilt"),
        ("quilt-", "quilt"),
        ("-forge-", "forge"),
        ("forge-", "forge"),
        ("-neoforge-", "neoforge"),
        ("neoforge-", "neoforge"),
    ] {
        if let Some(version) = identifier
            .split_once(marker)
            .map(|(_, suffix)| suffix.split('-').next().unwrap_or_default())
            .filter(|version| !version.is_empty())
        {
            return (loader.to_string(), Some(version.to_string()));
        }
    }
    ("vanilla".to_string(), None)
}

fn detect_import_metadata(game_dir: &Path) -> Result<(String, String, Option<String>), String> {
    for pack_file in ["mmc-pack.json", "manifest.json"] {
        let path = game_dir.join(pack_file);
        if !path.is_file() {
            continue;
        }
        let bytes = fs::read(&path)
            .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
        let metadata: serde_json::Value = serde_json::from_slice(&bytes)
            .map_err(|error| format!("Invalid {}: {error}", path.display()))?;
        if pack_file == "mmc-pack.json" {
            if let Some(components) = metadata
                .get("components")
                .and_then(serde_json::Value::as_array)
            {
                let mut game_version = None;
                let mut loader = ("vanilla".to_string(), None);
                for component in components {
                    let id = component
                        .get("uid")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or_default();
                    let version = component
                        .get("version")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or_default();
                    if id == "net.minecraft" {
                        game_version = Some(version.to_string());
                    } else if id.contains("fabric-loader") {
                        loader = ("fabric".to_string(), Some(version.to_string()));
                    } else if id.contains("quilt-loader") {
                        loader = ("quilt".to_string(), Some(version.to_string()));
                    } else if id.contains("neoforge") {
                        loader = ("neoforge".to_string(), Some(version.to_string()));
                    } else if id.contains("forge") {
                        loader = ("forge".to_string(), Some(version.to_string()));
                    }
                }
                if let Some(game_version) = game_version {
                    return Ok((game_version, loader.0, loader.1));
                }
            }
        } else {
            if let Some(game_version) = metadata
                .get("minecraft")
                .and_then(|minecraft| minecraft.get("version"))
                .and_then(serde_json::Value::as_str)
            {
                let mut loader = ("vanilla".to_string(), None);
                if let Some(mod_loaders) = metadata
                    .get("minecraft")
                    .and_then(|minecraft| minecraft.get("modLoaders"))
                    .and_then(serde_json::Value::as_array)
                {
                    if let Some(id) = mod_loaders
                        .first()
                        .and_then(|entry| entry.get("id"))
                        .and_then(serde_json::Value::as_str)
                    {
                        loader = loader_from_identifier(id);
                    }
                }
                return Ok((game_version.to_string(), loader.0, loader.1));
            }
        }
    }

    let versions_dir = game_dir.join("versions");
    if versions_dir.is_dir() {
        let mut candidates = Vec::new();
        for entry in fs::read_dir(&versions_dir)
            .map_err(|error| format!("Could not inspect {}: {error}", versions_dir.display()))?
        {
            let entry = entry.map_err(|error| error.to_string())?;
            if !entry
                .file_type()
                .map_err(|error| error.to_string())?
                .is_dir()
            {
                continue;
            }
            let identifier = entry.file_name().to_string_lossy().into_owned();
            let metadata_path = entry.path().join(format!("{identifier}.json"));
            if !metadata_path.is_file() {
                continue;
            }
            let bytes = fs::read(&metadata_path)
                .map_err(|error| format!("Could not read {}: {error}", metadata_path.display()))?;
            let metadata: serde_json::Value = serde_json::from_slice(&bytes)
                .map_err(|error| format!("Invalid Minecraft version metadata: {error}"))?;
            let game_version = metadata
                .get("inheritsFrom")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .or_else(|| version_from_identifier(&identifier));
            if let Some(game_version) = game_version {
                let (mut loader, mut loader_version) = loader_from_identifier(&identifier);
                if loader == "vanilla" {
                    if let Some(libraries) = metadata
                        .get("libraries")
                        .and_then(serde_json::Value::as_array)
                    {
                        for library in libraries {
                            let name = library
                                .get("name")
                                .and_then(serde_json::Value::as_str)
                                .unwrap_or_default();
                            if name.starts_with("net.fabricmc:fabric-loader:") {
                                loader = "fabric".to_string();
                                loader_version = name.split(':').nth(2).map(str::to_string);
                            } else if name.starts_with("org.quiltmc:quilt-loader:") {
                                loader = "quilt".to_string();
                                loader_version = name.split(':').nth(2).map(str::to_string);
                            } else if name.starts_with("net.neoforged:neoforge:") {
                                loader = "neoforge".to_string();
                                loader_version = name.split(':').nth(2).map(str::to_string);
                            } else if name.starts_with("net.minecraftforge:forge:") {
                                loader = "forge".to_string();
                                loader_version = name
                                    .split(':')
                                    .nth(2)
                                    .and_then(|version| version.split('-').next_back())
                                    .map(str::to_string);
                            }
                        }
                    }
                }
                candidates.push((game_version, loader, loader_version));
            }
        }
        if let Some(candidate) = candidates.into_iter().max_by(|left, right| {
            let version_key = |value: &str| {
                value
                    .split('.')
                    .map(|part| part.parse::<u32>().unwrap_or_default())
                    .collect::<Vec<_>>()
            };
            version_key(&left.0).cmp(&version_key(&right.0))
        }) {
            return Ok(candidate);
        }
    }

    for profile_file in [
        "launcher_profiles.json",
        "sklauncher_profiles.json",
        "profiles.json",
        "profile.json",
    ] {
        let profiles_path = game_dir.join(profile_file);
        if !profiles_path.is_file() {
            continue;
        }
        let bytes = fs::read(&profiles_path)
            .map_err(|error| format!("Could not read {}: {error}", profiles_path.display()))?;
        let profiles: serde_json::Value = serde_json::from_slice(&bytes)
            .map_err(|error| format!("Invalid launcher profile metadata: {error}"))?;
        let profile_list: Vec<&serde_json::Value> = profiles
            .get("profiles")
            .and_then(serde_json::Value::as_object)
            .map(|profiles| profiles.values().collect())
            .or_else(|| {
                profiles
                    .get("profiles")
                    .and_then(serde_json::Value::as_array)
                    .map(|profiles| profiles.iter().collect())
            })
            .unwrap_or_else(|| vec![&profiles]);
        for profile in profile_list {
            let identifier = [
                "lastVersionId",
                "last_version_id",
                "versionId",
                "version_id",
                "gameVersion",
                "game_version",
                "version",
                "id",
            ]
            .iter()
            .find_map(|key| profile.get(key).and_then(serde_json::Value::as_str));
            if let Some(identifier) = identifier {
                if let Some(game_version) = version_from_identifier(identifier) {
                    let (mut loader, mut loader_version) = loader_from_identifier(identifier);
                    if loader == "vanilla" {
                        if let Some(profile_loader) = profile
                            .get("loader")
                            .or_else(|| profile.get("modLoader"))
                            .and_then(serde_json::Value::as_str)
                        {
                            let normalized = profile_loader.to_ascii_lowercase();
                            if let Some(detected_loader) = ["fabric", "forge", "neoforge", "quilt"]
                                .iter()
                                .find(|candidate| normalized.contains(**candidate))
                            {
                                loader = (*detected_loader).to_string();
                                loader_version = profile
                                    .get("loaderVersion")
                                    .or_else(|| profile.get("loader_version"))
                                    .and_then(serde_json::Value::as_str)
                                    .map(str::to_string);
                            }
                        }
                    }
                    return Ok((game_version, loader, loader_version));
                }
            }
        }
    }

    Err("Could not detect a Minecraft version in this folder. Select the profile's game directory (SKLauncher 4: open the profile's Game Directory) or an instance folder containing Minecraft version metadata.".to_string())
}

fn is_import_game_directory(path: &Path) -> bool {
    [
        "versions",
        "mods",
        "saves",
        "config",
        "launcher_profiles.json",
        "sklauncher_profiles.json",
        "profiles.json",
        "profile.json",
        "mmc-pack.json",
        "manifest.json",
    ]
    .iter()
    .any(|entry| path.join(entry).exists())
}

fn has_importable_game_data(path: &Path) -> bool {
    [
        "versions",
        "mods",
        "saves",
        "config",
        "resourcepacks",
        "shaderpacks",
        "options.txt",
        "servers.dat",
    ]
    .iter()
    .any(|entry| path.join(entry).exists())
}

fn resolve_import_directories(selected_path: &Path) -> Result<(PathBuf, PathBuf), String> {
    let game_dir = if has_importable_game_data(selected_path) {
        selected_path.to_path_buf()
    } else {
        ["minecraft", ".minecraft"]
        .iter()
        .map(|child| selected_path.join(child))
        .find(|candidate| candidate.is_dir() && has_importable_game_data(candidate))
        .or_else(|| is_import_game_directory(selected_path).then(|| selected_path.to_path_buf()))
        .ok_or_else(|| "The selected folder does not look like a Minecraft game directory. Choose the SKLauncher profile's Game Directory or its .minecraft folder.".to_string())?
    };
    let metadata_dir = if game_dir != selected_path && is_import_game_directory(selected_path) {
        selected_path.to_path_buf()
    } else {
        game_dir.clone()
    };
    Ok((game_dir, metadata_dir))
}

fn copy_imported_game_data(source: &Path, target: &Path) -> Result<(), String> {
    const DIRECTORIES: &[&str] = &[
        "mods",
        "config",
        "saves",
        "resourcepacks",
        "shaderpacks",
        "screenshots",
        "defaultconfigs",
        "schematics",
        "journeymap",
        "XaeroWaypoints",
        "XaeroWorldMap",
        "server-resource-packs",
    ];
    const FILES: &[&str] = &["options.txt", "optionsof.txt", "servers.dat"];

    fs::create_dir_all(target)
        .map_err(|error| format!("Could not create imported game directory: {error}"))?;
    for directory in DIRECTORIES {
        let source_path = source.join(directory);
        if source_path.is_dir() {
            copy_instance_directory(&source_path, &target.join(directory))
                .map_err(|error| format!("Could not import {directory}: {error}"))?;
        }
    }
    for file in FILES {
        let source_path = source.join(file);
        if source_path.is_file() {
            fs::copy(&source_path, target.join(file))
                .map_err(|error| format!("Could not import {file}: {error}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn import_minecraft_instance(source_path: String) -> Result<ImportedInstanceInfo, String> {
    let selected_path = PathBuf::from(source_path);
    let selected_path = selected_path
        .canonicalize()
        .map_err(|error| format!("Could not access the selected game folder: {error}"))?;
    if !selected_path.is_dir() {
        return Err("Select a folder containing a Minecraft instance.".to_string());
    }
    let (game_dir, metadata_dir) = resolve_import_directories(&selected_path)?;
    let (game_version, loader, loader_version) = detect_import_metadata(&metadata_dir)?;
    validate_instance_id(&game_version)?;
    if !matches!(
        loader.as_str(),
        "vanilla" | "fabric" | "quilt" | "forge" | "neoforge"
    ) {
        return Err(format!("Unsupported imported mod loader: {loader}"));
    }

    let id = format!("import_{}", Uuid::new_v4().simple());
    let name = game_dir
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("Imported Minecraft")
        .to_string();
    let instances_dir = get_app_data_dir()?.join("instances");
    let instance_dir = instances_dir.join(&id);
    let custom_game_dir = instance_dir.clone();
    fs::create_dir_all(&instances_dir)
        .map_err(|error| format!("Could not create the instances directory: {error}"))?;
    fs::create_dir(&instance_dir)
        .map_err(|error| format!("Could not create imported instance: {error}"))?;
    let import_result = (|| {
        copy_imported_game_data(&game_dir, &instance_dir)?;
        for directory in ["mods", "resourcepacks", "shaderpacks", "saves"] {
            fs::create_dir_all(instance_dir.join(directory)).map_err(|error| {
                format!("Could not create instance {directory} folder: {error}")
            })?;
        }
        let metadata = InstanceMetadata {
            id: id.clone(),
            name: name.clone(),
            game_version: game_version.clone(),
            loader: loader.clone(),
        };
        fs::write(
            instance_dir.join("instance.json"),
            serde_json::to_vec_pretty(&metadata).map_err(|error| error.to_string())?,
        )
        .map_err(|error| format!("Could not save imported instance metadata: {error}"))?;
        Ok::<(), String>(())
    })();
    if let Err(error) = import_result {
        return match fs::remove_dir_all(&instance_dir) {
            Ok(()) => Err(error),
            Err(cleanup_error) => Err(format!(
                "{error} Also failed to remove the incomplete imported instance: {cleanup_error}"
            )),
        };
    }
    let mods = match list_instance_mods(id.clone()) {
        Ok(mods) => mods,
        Err(error) => {
            return match fs::remove_dir_all(&instance_dir) {
                Ok(()) => Err(error),
                Err(cleanup_error) => Err(format!(
                    "{error} Also failed to remove the incomplete imported instance: {cleanup_error}"
                )),
            };
        }
    };

    Ok(ImportedInstanceInfo {
        id,
        name,
        game_version,
        loader,
        loader_version,
        custom_game_dir: custom_game_dir.to_string_lossy().into_owned(),
        mods,
    })
}

/// Creates a new instance directory structure
#[tauri::command]
fn create_instance(
    id: String,
    name: String,
    game_version: String,
    loader: String,
) -> Result<String, String> {
    validate_instance_id(&id)?;
    let dir = get_app_data_dir()?.join("instances").join(&id);
    fs::create_dir_all(dir.join("mods")).map_err(|error| error.to_string())?;
    fs::create_dir_all(dir.join("resourcepacks")).map_err(|error| error.to_string())?;
    fs::create_dir_all(dir.join("shaderpacks")).map_err(|error| error.to_string())?;
    fs::create_dir_all(dir.join("saves")).map_err(|error| error.to_string())?;

    let metadata = InstanceMetadata {
        id,
        name,
        game_version,
        loader,
    };
    let serialized = serde_json::to_vec(&metadata).map_err(|error| error.to_string())?;
    fs::write(dir.join("instance.json"), serialized).map_err(|error| error.to_string())?;

    Ok(dir.to_string_lossy().to_string())
}

/// Deletes an instance directory
#[tauri::command]
fn delete_instance(id: String) -> Result<bool, String> {
    validate_instance_id(&id)?;
    let dir = get_app_data_dir()?.join("instances").join(&id);
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

fn copy_instance_directory(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            return Err(format!(
                "Instance contains an unsupported symbolic link: {}",
                source_path.display()
            ));
        } else if file_type.is_dir() {
            copy_instance_directory(&source_path, &target_path)?;
        } else if file_type.is_file() {
            fs::copy(&source_path, &target_path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn restore_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        log::error!("Could not restore the launcher: the main window was not found.");
        return;
    };
    if let Err(error) = window.show().and_then(|_| window.set_focus()) {
        log::error!("Could not restore the launcher window: {error}");
    }
}

/// Clones an instance directory
#[tauri::command]
fn clone_instance(source_id: String, target_id: String) -> Result<bool, String> {
    validate_instance_id(&source_id)?;
    validate_instance_id(&target_id)?;
    let instances_dir = get_app_data_dir()?.join("instances");
    let src = instances_dir.join(&source_id);
    let dst = instances_dir.join(&target_id);
    if !src.is_dir() {
        return Err("Source instance does not exist.".to_string());
    }
    if dst.exists() {
        return Err("Target instance already exists.".to_string());
    }
    copy_instance_directory(&src, &dst)?;
    Ok(true)
}

/// Lists mods in an instance's mods folder
#[tauri::command]
fn list_instance_mods(instance_id: String) -> Result<Vec<ModItem>, String> {
    validate_instance_id(&instance_id)?;
    let mods_dir = get_app_data_dir()?
        .join("instances")
        .join(&instance_id)
        .join("mods");
    let mut mods = Vec::new();

    if !mods_dir.exists() {
        return Ok(mods);
    }

    let entries = fs::read_dir(mods_dir).map_err(|error| error.to_string())?;
    for entry in entries {
        let path = entry.map_err(|error| error.to_string())?.path();
        if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy();
            let enabled = ext_str == "jar";
            if ext_str == "jar" || ext_str == "disabled" {
                let file_name = path
                    .file_name()
                    .ok_or_else(|| format!("Mod path has no file name: {}", path.display()))?
                    .to_string_lossy()
                    .to_string();
                let size_bytes = path.metadata().map_err(|error| error.to_string())?.len();
                let clean_name = file_name.replace(".jar", "").replace(".disabled", "");
                mods.push(ModItem {
                    file_name,
                    name: clean_name,
                    enabled,
                    size_bytes,
                });
            }
        }
    }

    Ok(mods)
}

/// Toggles a mod between enabled (.jar) and disabled (.jar.disabled)
#[tauri::command]
fn toggle_mod_file(instance_id: String, file_name: String, enable: bool) -> Result<String, String> {
    validate_instance_id(&instance_id)?;
    validate_mod_file_name(&file_name)?;
    let mods_dir = get_app_data_dir()?
        .join("instances")
        .join(&instance_id)
        .join("mods");
    let current_path = mods_dir.join(&file_name);

    if !current_path.exists() {
        return Err("Mod file does not exist".to_string());
    }

    let new_file_name = if enable {
        file_name.replace(".disabled", "")
    } else {
        if file_name.ends_with(".disabled") {
            file_name.clone()
        } else {
            format!("{}.disabled", file_name)
        }
    };

    let new_path = mods_dir.join(&new_file_name);
    fs::rename(current_path, new_path).map_err(|e| e.to_string())?;

    Ok(new_file_name)
}

/// Deletes a mod from an instance's mods folder
#[tauri::command]
fn delete_mod_file(instance_id: String, file_name: String) -> Result<bool, String> {
    validate_instance_id(&instance_id)?;
    validate_mod_file_name(&file_name)?;
    let file_path = get_app_data_dir()?
        .join("instances")
        .join(&instance_id)
        .join("mods")
        .join(&file_name);
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[cfg(test)]
mod minecraft_status_tests {
    use super::{decode_protocol_varint, description_text, write_protocol_varint};

    #[test]
    fn round_trips_protocol_varints() {
        for value in [0, 1, 127, 128, 767, 2_097_151] {
            let mut encoded = Vec::new();
            write_protocol_varint(value, &mut encoded);
            let mut cursor = 0;
            assert_eq!(
                decode_protocol_varint(&encoded, &mut cursor).unwrap(),
                value
            );
            assert_eq!(cursor, encoded.len());
        }
    }

    #[test]
    fn flattens_component_motds() {
        let motd = serde_json::json!({"text":"Hello ","extra":[{"text":"world"},{"text":"!"}]});
        assert_eq!(description_text(&motd), "Hello world!");
    }
}

#[cfg(test)]
mod path_validation_tests {
    use super::{validate_instance_id, validate_mod_file_name};

    #[test]
    fn rejects_instance_path_traversal() {
        assert!(validate_instance_id("inst_123").is_ok());
        assert!(validate_instance_id("../outside").is_err());
        assert!(validate_instance_id("a\\b").is_err());
    }

    #[test]
    fn only_accepts_mod_files_within_the_mods_directory() {
        assert!(validate_mod_file_name("example.jar").is_ok());
        assert!(validate_mod_file_name("example.jar.disabled").is_ok());
        assert!(validate_mod_file_name("../../outside.jar").is_err());
        assert!(validate_mod_file_name("notes.txt").is_err());
    }
}

#[cfg(test)]
mod import_tests {
    use super::*;

    fn test_directory(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("the-boys-{label}-{}", Uuid::new_v4().simple()))
    }

    #[test]
    fn detects_mmc_pack_versions_and_mod_loaders() {
        let directory = test_directory("import-metadata");
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("mmc-pack.json"),
            r#"{"components":[{"uid":"net.minecraft","version":"1.21.1"},{"uid":"net.fabricmc.fabric-loader","version":"0.16.10"}]}"#,
        )
        .unwrap();

        assert_eq!(
            detect_import_metadata(&directory).unwrap(),
            (
                "1.21.1".to_string(),
                "fabric".to_string(),
                Some("0.16.10".to_string())
            )
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn detects_sklauncher_profile_metadata() {
        let directory = test_directory("sklauncher-profile");
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("sklauncher_profiles.json"),
            r#"{"profiles":[{"version":"1.20.1-forge-47.4.0"}]}"#,
        )
        .unwrap();

        assert_eq!(
            detect_import_metadata(&directory).unwrap(),
            (
                "1.20.1".to_string(),
                "forge".to_string(),
                Some("47.4.0".to_string())
            )
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn resolves_multimc_instance_metadata_and_game_data_separately() {
        let directory = test_directory("multimc-import");
        let game_directory = directory.join(".minecraft");
        fs::create_dir_all(game_directory.join("saves")).unwrap();
        fs::write(
            directory.join("mmc-pack.json"),
            r#"{"components":[{"uid":"net.minecraft","version":"1.21.1"}]}"#,
        )
        .unwrap();

        let (game_dir, metadata_dir) = resolve_import_directories(&directory).unwrap();
        assert_eq!(game_dir, game_directory);
        assert_eq!(metadata_dir, directory);
        assert_eq!(
            detect_import_metadata(&metadata_dir).unwrap(),
            ("1.21.1".to_string(), "vanilla".to_string(), None)
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn copies_instance_data_without_touching_launcher_runtime_files() {
        let source = test_directory("import-source");
        let target = test_directory("import-target");
        fs::create_dir_all(source.join("mods")).unwrap();
        fs::create_dir_all(source.join("saves").join("World")).unwrap();
        fs::create_dir_all(source.join("versions")).unwrap();
        fs::write(source.join("mods").join("example.jar"), b"mod").unwrap();
        fs::write(source.join("options.txt"), b"options").unwrap();
        fs::write(source.join("versions").join("runtime.jar"), b"runtime").unwrap();

        copy_imported_game_data(&source, &target).unwrap();

        assert_eq!(
            fs::read(target.join("mods").join("example.jar")).unwrap(),
            b"mod"
        );
        assert_eq!(fs::read(target.join("options.txt")).unwrap(), b"options");
        assert!(!target.join("versions").exists());
        assert!(source.join("mods").join("example.jar").is_file());
        fs::remove_dir_all(source).unwrap();
        fs::remove_dir_all(target).unwrap();
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show The Boys", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let tray = TrayIconBuilder::new()
                .tooltip("The Boys Minecraft Launcher")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => restore_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        restore_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            if let Some(icon) = app.default_window_icon() {
                tray.set_icon(Some(icon.clone()))?;
            }
            app.manage(tray);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_hardware,
            install_minecraft_instance,
            import_minecraft_instance,
            launch_game,
            stop_game,
            is_game_running,
            detect_java_installations,
            get_curseforge_key_status,
            save_microsoft_credentials,
            get_microsoft_credentials,
            clear_microsoft_credentials,
            save_curseforge_api_key,
            clear_curseforge_api_key,
            search_curseforge,
            validate_java_path,
            fetch_ely_by_skin,
            verify_file_hash,
            save_skin_file,
            ping_minecraft_server,
            create_desktop_shortcut,
            list_instances,
            create_instance,
            delete_instance,
            clone_instance,
            list_instance_mods,
            toggle_mod_file,
            delete_mod_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running The Boys launcher application");
}
