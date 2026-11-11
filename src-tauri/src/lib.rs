use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine as _;
use futures_util::StreamExt;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::{Cursor, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
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
pub struct GraphicsApiVersions {
    pub opengl: Option<String>,
    pub opengl_error: Option<String>,
    pub vulkan: Option<String>,
    pub vulkan_error: Option<String>,
    pub directx12: Option<String>,
    pub directx12_error: Option<String>,
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

fn instance_game_dir(
    instance_id: &str,
    custom_game_dir: Option<String>,
) -> Result<PathBuf, String> {
    validate_instance_id(instance_id)?;
    Ok(custom_game_dir
        .filter(|path| !path.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or(get_app_data_dir()?.join("instances").join(instance_id)))
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

fn addon_folder(addon_type: &str) -> Result<&'static str, String> {
    match addon_type.to_ascii_lowercase().as_str() {
        "mod" | "mods" => Ok("mods"),
        "resourcepack" | "resource_pack" | "resourcepacks" => Ok("resourcepacks"),
        "shader" | "shaders" | "shaderpack" | "shaderpacks" => Ok("shaderpacks"),
        "datapack" | "datapacks" | "data_pack" => Ok("datapacks"),
        "modpack" | "modpacks" => Err(
            "Modpacks cannot be installed into an existing instance. Import or create a dedicated modpack instance instead."
                .to_string(),
        ),
        _ => Err(format!("Unsupported addon type: {addon_type}")),
    }
}

fn validate_addon_file_name(
    file_name: &str,
    folder_name: &str,
    allow_disabled: bool,
) -> Result<(), String> {
    let lower_name = file_name.to_ascii_lowercase();
    let extension = if folder_name == "mods" {
        ".jar"
    } else {
        ".zip"
    };
    let valid_extension = lower_name.ends_with(extension)
        || (allow_disabled && lower_name.ends_with(&format!("{extension}.disabled")));
    if file_name.is_empty()
        || file_name.len() > 255
        || file_name == "."
        || file_name == ".."
        || file_name.contains(['/', '\\', ':'])
        || file_name.chars().any(char::is_control)
        || !valid_extension
    {
        return Err("The downloaded file name is not a valid addon file.".to_string());
    }
    Ok(())
}

#[derive(Debug, Serialize)]
struct ImportedAddonFile {
    file_name: String,
    name: String,
    addon_type: String,
    size_bytes: u64,
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
async fn get_system_hardware() -> Result<HardwareInfo, String> {
    tokio::task::spawn_blocking(collect_system_hardware)
        .await
        .map_err(|error| format!("Hardware detection task failed: {error}"))?
}

fn collect_system_hardware() -> Result<HardwareInfo, String> {
    let rk = RefreshKind::new()
        .with_cpu(CpuRefreshKind::everything())
        .with_memory(MemoryRefreshKind::everything());
    let sys = System::new_with_specifics(rk);

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

fn find_version_line(output: &str, markers: &[&str]) -> Option<String> {
    output
        .lines()
        .find_map(|line| {
            let lower_line = line.to_ascii_lowercase();
            markers.iter().find_map(|marker| {
                lower_line.find(&marker.to_ascii_lowercase()).map(|index| {
                    line[index + marker.len()..]
                        .trim()
                        .trim_matches(['"', '<', '>'])
                        .to_string()
                })
            })
        })
        .filter(|version| !version.is_empty())
}

async fn run_graphics_query(program: &str, args: &[&str]) -> Result<String, String> {
    let mut command = tokio::process::Command::new(program);
    suppress_tokio_console_window(&mut command);
    let output = tokio::time::timeout(Duration::from_secs(8), command.args(args).output())
        .await
        .map_err(|_| format!("{program} query timed out."))?
        .map_err(|error| format!("Could not run {program}: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "{program} exited with {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[cfg(target_os = "windows")]
async fn query_directx_version() -> Result<String, String> {
    let report_path =
        std::env::temp_dir().join(format!("theboys-dxdiag-{}.xml", Uuid::new_v4().simple()));
    let report_arg = report_path.to_string_lossy().into_owned();
    let result = run_graphics_query("dxdiag", &["/whql:off", "/x", &report_arg]).await;
    let report = match result {
        Ok(_) => tokio::fs::read_to_string(&report_path)
            .await
            .map_err(|error| format!("Could not read DirectX diagnostic report: {error}")),
        Err(error) => Err(error),
    };
    if let Err(error) = tokio::fs::remove_file(&report_path).await {
        if error.kind() != std::io::ErrorKind::NotFound {
            log::warn!("Could not remove DirectX diagnostic report: {error}");
        }
    }
    let report = report?;
    find_version_line(&report, &["<directxversion>"])
        .map(|version| {
            version
                .split('<')
                .next()
                .unwrap_or_default()
                .trim()
                .to_string()
        })
        .ok_or_else(|| "DirectX version was not present in the dxdiag report.".to_string())
}

#[cfg(not(target_os = "windows"))]
async fn query_directx_version() -> Result<String, String> {
    Err("DirectX 12 is only available on Windows.".to_string())
}

/// Queries graphics API version information when explicitly requested by the user.
#[tauri::command]
async fn detect_graphics_api_versions() -> Result<GraphicsApiVersions, String> {
    let (opengl_result, vulkan_result, directx_result) = tokio::join!(
        run_graphics_query("glxinfo", &["-B"]),
        run_graphics_query("vulkaninfo", &["--summary"]),
        query_directx_version(),
    );
    let opengl = opengl_result.and_then(|output| {
        find_version_line(
            &output,
            &[
                "OpenGL core profile version string:",
                "OpenGL version string:",
            ],
        )
        .ok_or_else(|| "OpenGL version was not present in glxinfo output.".to_string())
    });
    let vulkan = vulkan_result.and_then(|output| {
        find_version_line(&output, &["Vulkan Instance Version:", "apiVersion ="])
            .ok_or_else(|| "Vulkan version was not present in vulkaninfo output.".to_string())
    });
    Ok(GraphicsApiVersions {
        opengl: opengl.as_ref().ok().cloned(),
        opengl_error: opengl.err(),
        vulkan: vulkan.as_ref().ok().cloned(),
        vulkan_error: vulkan.err(),
        directx12: directx_result.as_ref().ok().cloned(),
        directx12_error: directx_result.err(),
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
async fn stop_game(pid: u32) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || stop_game_sync(pid))
        .await
        .map_err(|error| format!("Game stop task failed: {error}"))?
}

fn stop_game_sync(pid: u32) -> Result<bool, String> {
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
async fn is_game_running(pid: u32) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || is_game_running_sync(pid))
        .await
        .map_err(|error| format!("Game process check failed: {error}"))?
}

fn is_game_running_sync(pid: u32) -> Result<bool, String> {
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
async fn detect_java_installations() -> Result<Vec<JavaInstallation>, String> {
    tokio::task::spawn_blocking(detect_java_installations_sync)
        .await
        .map_err(|error| format!("Java detection task failed: {error}"))?
}

fn detect_java_installations_sync() -> Result<Vec<JavaInstallation>, String> {
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
async fn validate_java_path(java_path: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&java_path);
        if !path.is_file() {
            return false;
        }
        let mut command = Command::new(path);
        suppress_console_window(&mut command);
        command
            .arg("-version")
            .output()
            .is_ok_and(|result| result.status.success())
    })
    .await
    .map_err(|error| format!("Java validation task failed: {error}"))
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

#[cfg(target_os = "windows")]
fn powershell_single_quoted(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(target_os = "windows")]
fn validate_shortcut_icon(bytes: &[u8]) -> Result<(), String> {
    const ICO_HEADER_SIZE: usize = 22;
    const MAX_ICON_SIZE: usize = 4 * 1024 * 1024;
    const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];
    if bytes.len() < ICO_HEADER_SIZE + PNG_SIGNATURE.len() || bytes.len() > MAX_ICON_SIZE {
        return Err("The shortcut icon has an invalid size.".to_string());
    }
    if bytes[0..6] != [0, 0, 1, 0, 1, 0]
        || u32::from_le_bytes(bytes[14..18].try_into().unwrap()) as usize
            != bytes.len() - ICO_HEADER_SIZE
        || u32::from_le_bytes(bytes[18..22].try_into().unwrap()) as usize != ICO_HEADER_SIZE
        || bytes[ICO_HEADER_SIZE..ICO_HEADER_SIZE + PNG_SIGNATURE.len()] != PNG_SIGNATURE
    {
        return Err("The shortcut icon is not a valid single-image PNG icon.".to_string());
    }
    Ok(())
}

/// Creates a Windows shortcut that opens the requested instance in the launcher.
#[tauri::command]
fn create_desktop_shortcut(
    instance_name: String,
    instance_id: String,
    icon_ico_base64: String,
) -> Result<String, String> {
    validate_instance_id(&instance_id)?;
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (instance_name, icon_ico_base64);
        return Err("Desktop shortcut creation is only supported on Windows.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let icon_bytes = STANDARD
            .decode(icon_ico_base64)
            .map_err(|error| format!("Could not decode the shortcut icon: {error}"))?;
        validate_shortcut_icon(&icon_bytes)?;

        let safe_name = instance_name
            .replace(
                |character: char| !character.is_alphanumeric() && character != ' ',
                "_",
            )
            .trim()
            .to_string();
        let safe_name = if safe_name.is_empty() {
            "Minecraft Instance"
        } else {
            safe_name.as_str()
        };
        let target = std::env::current_exe()
            .map_err(|error| format!("Could not locate the launcher executable: {error}"))?;
        let working_directory = target
            .parent()
            .ok_or_else(|| "Could not determine the launcher directory.".to_string())?;
        let icon_directory = get_app_data_dir()?.join("shortcut-icons");
        fs::create_dir_all(&icon_directory)
            .map_err(|error| format!("Could not create the shortcut icon directory: {error}"))?;
        let icon_path = icon_directory.join(format!("{instance_id}.ico"));
        fs::write(&icon_path, icon_bytes)
            .map_err(|error| format!("Could not save the shortcut icon: {error}"))?;

        let link_name = format!("Launch {safe_name}.lnk");
        let link_name_literal = powershell_single_quoted(&link_name);
        let target_literal = powershell_single_quoted(&target.to_string_lossy());
        let working_directory_literal =
            powershell_single_quoted(&working_directory.to_string_lossy());
        let icon_literal = powershell_single_quoted(&format!("{},0", icon_path.to_string_lossy()));
        let arguments_literal =
            powershell_single_quoted(&format!("--launch-instance {instance_id}"));
        let description_literal =
            powershell_single_quoted(&format!("Launch {safe_name} with The Boys Launcher"));
        let script = format!(
            "$shell = New-Object -ComObject WScript.Shell; \
             $desktop = $shell.SpecialFolders.Item('Desktop'); \
             $path = Join-Path $desktop {link_name_literal}; \
             $shortcut = $shell.CreateShortcut($path); \
             $shortcut.TargetPath = {target_literal}; \
             $shortcut.Arguments = {arguments_literal}; \
             $shortcut.WorkingDirectory = {working_directory_literal}; \
             $shortcut.IconLocation = {icon_literal}; \
             $shortcut.Description = {description_literal}; \
             $shortcut.Save(); \
             [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($path))"
        );
        let mut command = Command::new("powershell.exe");
        command.args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ]);
        suppress_console_window(&mut command);
        let output = command
            .output()
            .map_err(|error| format!("Could not start Windows shortcut creation: {error}"))?;
        if !output.status.success() {
            let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if detail.is_empty() {
                "Windows could not create the desktop shortcut.".to_string()
            } else {
                format!("Windows could not create the desktop shortcut: {detail}")
            });
        }
        let encoded_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let path_bytes = STANDARD
            .decode(encoded_path)
            .map_err(|error| format!("Windows returned an invalid shortcut path: {error}"))?;
        let path = String::from_utf8(path_bytes)
            .map_err(|error| format!("Windows returned an invalid shortcut path: {error}"))?;
        if path.is_empty() {
            return Err(
                "Windows created the shortcut but did not return its location.".to_string(),
            );
        }
        Ok(path)
    }
}

#[tauri::command]
fn get_startup_instance_id() -> Result<Option<String>, String> {
    let arguments = std::env::args().collect::<Vec<_>>();
    let Some(index) = arguments
        .iter()
        .position(|argument| argument == "--launch-instance")
    else {
        return Ok(None);
    };
    let instance_id = arguments
        .get(index + 1)
        .ok_or_else(|| "The launch shortcut did not include an instance ID.".to_string())?;
    validate_instance_id(instance_id)?;
    Ok(Some(instance_id.clone()))
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
        [".minecraft", "minecraft", "game"]
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
    let mods = match list_instance_mods(id.clone(), Some(custom_game_dir.to_string_lossy().into()))
    {
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
fn list_instance_mods(
    instance_id: String,
    custom_game_dir: Option<String>,
) -> Result<Vec<ModItem>, String> {
    let mods_dir = instance_game_dir(&instance_id, custom_game_dir)?.join("mods");
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
fn toggle_mod_file(
    instance_id: String,
    file_name: String,
    enable: bool,
    custom_game_dir: Option<String>,
) -> Result<String, String> {
    validate_mod_file_name(&file_name)?;
    let mods_dir = instance_game_dir(&instance_id, custom_game_dir)?.join("mods");
    let current_path = mods_dir.join(&file_name);

    if !current_path.exists() {
        return Err("Mod file does not exist".to_string());
    }

    let new_file_name = if enable {
        file_name
            .strip_suffix(".disabled")
            .unwrap_or(&file_name)
            .to_string()
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
fn delete_mod_file(
    instance_id: String,
    file_name: String,
    custom_game_dir: Option<String>,
) -> Result<bool, String> {
    validate_mod_file_name(&file_name)?;
    let file_path = instance_game_dir(&instance_id, custom_game_dir)?
        .join("mods")
        .join(&file_name);
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstallAddonRequest {
    pub instance_id: String,
    pub addon_id: String,
    pub addon_name: String,
    pub addon_type: String, // "mod", "resourcepack", "shader", "datapack"
    pub provider: String,   // "modrinth" or "curseforge"
    pub game_version: Option<String>,
    pub loader: Option<String>,
    pub direct_download_url: Option<String>,
    pub file_name: Option<String>,
    #[serde(default)]
    pub custom_game_dir: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstallAddonResult {
    pub success: bool,
    pub file_name: String,
    pub file_path: String,
    pub size_bytes: u64,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstanceAddonItem {
    pub id: String,
    pub file_name: String,
    pub name: String,
    pub addon_type: String,
    pub enabled: bool,
    pub size_bytes: u64,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LauncherUpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_name: String,
    pub release_notes: String,
    pub download_url: Option<String>,
    pub asset_name: Option<String>,
}

/// Downloads and installs an addon (mod, resource pack, shader pack, or data pack) directly into the instance
#[tauri::command]
async fn install_instance_addon(
    request: InstallAddonRequest,
) -> Result<InstallAddonResult, String> {
    let instance_dir = instance_game_dir(&request.instance_id, request.custom_game_dir.clone())?;

    let folder_name = addon_folder(&request.addon_type)?;
    let target_dir = instance_dir.join(folder_name);
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Could not create folder {}: {e}", target_dir.display()))?;

    let client = reqwest::Client::new();
    let (download_url, final_file_name) = if let Some(direct_url) =
        request.direct_download_url.filter(|u| !u.trim().is_empty())
    {
        let name = request.file_name.unwrap_or_else(|| {
            direct_url
                .rsplit('/')
                .next()
                .unwrap_or("addon.jar")
                .to_string()
        });
        (direct_url, name)
    } else if request.provider.eq_ignore_ascii_case("modrinth") {
        let url = format!(
            "https://api.modrinth.com/v2/project/{}/version",
            request.addon_id
        );
        let resp = client
            .get(&url)
            .header(
                "User-Agent",
                "TheBoysLauncher/1.0.0 (https://github.com/ktesla39/TheBoyz)",
            )
            .send()
            .await
            .map_err(|e| format!("Failed to fetch Modrinth project versions: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!(
                "Modrinth version lookup returned HTTP {}.",
                resp.status()
            ));
        }

        let versions: Vec<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| format!("Invalid Modrinth version list: {e}"))?;

        if versions.is_empty() {
            return Err("No downloadable versions found for this Modrinth addon.".to_string());
        }

        let req_loader = request.loader.as_deref().unwrap_or("").to_ascii_lowercase();
        let req_gv = request.game_version.as_deref().unwrap_or("");

        let chosen_version = versions
            .iter()
            .find(|version| {
                let loaders = version.get("loaders").and_then(|loaders| loaders.as_array());
                let game_versions = version
                    .get("game_versions")
                    .and_then(|game_versions| game_versions.as_array());
                let loader_matches = req_loader.is_empty()
                    || req_loader == "vanilla"
                    || loaders.map_or(true, |available| {
                        available.iter().any(|item| {
                            item.as_str()
                                .map_or(false, |loader| loader.eq_ignore_ascii_case(&req_loader))
                        })
                    });
                let game_version_matches = req_gv.is_empty()
                    || req_gv == "all"
                    || game_versions.map_or(false, |available| {
                        available
                            .iter()
                            .any(|item| item.as_str().map_or(false, |version| version == req_gv))
                    });
                loader_matches && game_version_matches
            })
            .ok_or_else(|| {
                "No addon version matches this Minecraft version and mod loader. Disable the exact-version filter or choose a compatible addon.".to_string()
            })?;

        let files = chosen_version
            .get("files")
            .and_then(|f| f.as_array())
            .ok_or_else(|| "Selected version has no files.".to_string())?;
        let primary_file = files
            .iter()
            .find(|f| f.get("primary").and_then(|p| p.as_bool()).unwrap_or(false))
            .or_else(|| files.first())
            .ok_or_else(|| "No downloadable file in selected version.".to_string())?;

        let file_url = primary_file
            .get("url")
            .and_then(|u| u.as_str())
            .ok_or_else(|| "File object is missing download URL.".to_string())?
            .to_string();
        let file_name = primary_file
            .get("filename")
            .and_then(|f| f.as_str())
            .unwrap_or("addon.jar")
            .to_string();
        (file_url, file_name)
    } else if request.provider.eq_ignore_ascii_case("curseforge") {
        let api_key = get_curseforge_api_key()?
            .ok_or_else(|| "CurseForge API key is required to download from CurseForge. Save your key in Launcher Settings or use Modrinth.".to_string())?;

        let url = format!(
            "https://api.curseforge.com/v1/mods/{}/files",
            request.addon_id
        );
        let resp = client
            .get(&url)
            .header("x-api-key", &api_key)
            .send()
            .await
            .map_err(|e| format!("CurseForge file request failed: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("CurseForge returned HTTP {}.", resp.status()));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Invalid CurseForge files response: {e}"))?;
        let files = body
            .get("data")
            .and_then(|d| d.as_array())
            .ok_or_else(|| "No files found for this CurseForge addon.".to_string())?;

        if files.is_empty() {
            return Err("CurseForge reports no files for this addon.".to_string());
        }

        let req_gv = request.game_version.as_deref().unwrap_or("");
        let chosen_file = files
            .iter()
            .find(|f| {
                if req_gv.is_empty() || req_gv == "all" {
                    return true;
                }
                f.get("gameVersions")
                    .and_then(|gv| gv.as_array())
                    .map_or(false, |arr| {
                        arr.iter()
                            .any(|item| item.as_str().map_or(false, |g| g == req_gv))
                    })
            })
            .ok_or_else(|| "No compatible file found.".to_string())?;

        let file_id = chosen_file
            .get("id")
            .and_then(|id| id.as_u64())
            .ok_or_else(|| "File entry has no ID.".to_string())?;
        let file_name = chosen_file
            .get("fileName")
            .and_then(|f| f.as_str())
            .unwrap_or("addon.jar")
            .to_string();

        let direct_url = chosen_file
            .get("downloadUrl")
            .and_then(|u| u.as_str())
            .map(str::to_string);
        let final_url = match direct_url {
            Some(u) if !u.trim().is_empty() => u,
            _ => {
                let dl_url = format!(
                    "https://api.curseforge.com/v1/mods/{}/files/{}/download-url",
                    request.addon_id, file_id
                );
                let dl_res = client
                    .get(&dl_url)
                    .header("x-api-key", &api_key)
                    .send()
                    .await
                    .map_err(|e| format!("CurseForge download URL resolution failed: {e}"))?;
                if !dl_res.status().is_success() {
                    return Err(format!(
                        "CurseForge download URL lookup returned HTTP {}.",
                        dl_res.status()
                    ));
                }
                let dl_body: serde_json::Value = dl_res
                    .json()
                    .await
                    .map_err(|e| format!("Invalid CurseForge download URL response: {e}"))?;
                dl_body
                    .get("data")
                    .and_then(|d| d.as_str())
                    .ok_or_else(|| "CurseForge did not return a valid download link.".to_string())?
                    .to_string()
            }
        };
        (final_url, file_name)
    } else {
        return Err(format!("Unsupported addon provider: {}", request.provider));
    };

    let download_resp = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download addon file: {e}"))?;

    if !download_resp.status().is_success() {
        return Err(format!(
            "Addon download failed with HTTP status {}.",
            download_resp.status()
        ));
    }

    let bytes = download_resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read addon file bytes: {e}"))?;
    if bytes.is_empty() {
        return Err("Downloaded addon file was empty.".to_string());
    }

    let safe_file_name =
        final_file_name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    validate_addon_file_name(&safe_file_name, folder_name, false)?;

    let target_path = target_dir.join(&safe_file_name);
    fs::write(&target_path, &bytes).map_err(|e| {
        format!(
            "Failed to save addon file to {}: {e}",
            target_path.display()
        )
    })?;

    Ok(InstallAddonResult {
        success: true,
        file_name: safe_file_name.clone(),
        file_path: target_path.to_string_lossy().to_string(),
        size_bytes: bytes.len() as u64,
        message: format!(
            "Successfully installed '{}' into {} ({:.2} MB).",
            safe_file_name,
            folder_name,
            bytes.len() as f64 / (1024.0 * 1024.0)
        ),
    })
}

fn safe_modpack_relative_path(value: &str) -> Result<PathBuf, String> {
    if value.is_empty() || value.contains(['\\', ':']) {
        return Err(format!("Modpack contains an unsafe file path: {value}"));
    }
    let path = Path::new(value);
    if path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, std::path::Component::Normal(_)))
    {
        return Err(format!("Modpack contains an unsafe file path: {value}"));
    }
    Ok(path.to_path_buf())
}

async fn download_modpack_file(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Modpack file download failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Modpack file download returned HTTP {}.",
            response.status()
        ));
    }
    const MAX_FILE_BYTES: usize = 1024 * 1024 * 1024;
    if response
        .content_length()
        .is_some_and(|length| length > MAX_FILE_BYTES as u64)
    {
        return Err("Modpack download exceeds the 1 GiB per-file limit.".to_string());
    }
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("Could not read modpack download: {error}"))?;
        if bytes.len().saturating_add(chunk.len()) > MAX_FILE_BYTES {
            return Err("Modpack download exceeds the 1 GiB per-file limit.".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.is_empty() {
        return Err("Modpack download returned an empty file.".to_string());
    }
    Ok(bytes)
}

fn extract_modpack_overrides(
    archive: &mut zip::ZipArchive<Cursor<Vec<u8>>>,
    instance_dir: &Path,
) -> Result<u64, String> {
    let mut total_bytes = 0u64;
    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|error| format!("Could not inspect modpack archive: {error}"))?;
        let entry_name = file.name().to_string();
        let relative = ["overrides/", "client-overrides/"]
            .iter()
            .find_map(|prefix| entry_name.strip_prefix(prefix));
        let Some(relative) = relative else {
            continue;
        };
        let relative_path = safe_modpack_relative_path(relative)?;
        let target = instance_dir.join(relative_path);
        if file.is_dir() {
            fs::create_dir_all(&target)
                .map_err(|error| format!("Could not create modpack directory: {error}"))?;
            continue;
        }
        total_bytes = total_bytes.saturating_add(file.size());
        if total_bytes > 2 * 1024 * 1024 * 1024 {
            return Err("Modpack overrides exceed the 2 GiB safety limit.".to_string());
        }
        let parent = target
            .parent()
            .ok_or_else(|| "Modpack file path has no parent directory.".to_string())?;
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create modpack directory: {error}"))?;
        let mut output = fs::File::create(&target)
            .map_err(|error| format!("Could not create {}: {error}", target.display()))?;
        std::io::copy(&mut file, &mut output)
            .map_err(|error| format!("Could not extract {}: {error}", target.display()))?;
    }
    Ok(total_bytes)
}

async fn install_modrinth_pack(
    request: &InstallAddonRequest,
    instance_dir: &Path,
    client: &reqwest::Client,
) -> Result<(String, u64), String> {
    let versions_url = format!(
        "https://api.modrinth.com/v2/project/{}/version",
        request.addon_id
    );
    let response = client
        .get(&versions_url)
        .header(
            "User-Agent",
            "TheBoysLauncher/1.1.0 (https://github.com/ktesla39/TheBoyz)",
        )
        .send()
        .await
        .map_err(|error| format!("Could not query Modrinth modpack versions: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Modrinth modpack lookup returned HTTP {}.",
            response.status()
        ));
    }
    let versions: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|error| format!("Invalid Modrinth modpack response: {error}"))?;
    let game_version = request.game_version.as_deref().unwrap_or_default();
    let loader = request.loader.as_deref().unwrap_or_default();
    let version = versions
        .iter()
        .find(|version| {
            let games = version
                .get("game_versions")
                .and_then(|value| value.as_array());
            let loaders = version.get("loaders").and_then(|value| value.as_array());
            games.is_some_and(|games| {
                games
                    .iter()
                    .any(|entry| entry.as_str() == Some(game_version))
            }) && (loader.is_empty()
                || loader == "vanilla"
                || loaders.is_some_and(|loaders| {
                    loaders.iter().any(|entry| {
                        entry
                            .as_str()
                            .is_some_and(|value| value.eq_ignore_ascii_case(loader))
                    })
                }))
        })
        .ok_or_else(|| {
            "No Modrinth modpack version matches the selected Minecraft version and loader."
                .to_string()
        })?;
    let file = version
        .get("files")
        .and_then(|files| files.as_array())
        .and_then(|files| {
            files
                .iter()
                .find(|file| file.get("primary").and_then(|value| value.as_bool()) == Some(true))
                .or_else(|| files.first())
        })
        .ok_or_else(|| {
            "Modrinth modpack version does not contain a downloadable file.".to_string()
        })?;
    let archive_url = file
        .get("url")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "Modrinth modpack file is missing its download URL.".to_string())?;
    let archive_bytes = download_modpack_file(client, archive_url).await?;
    let mut archive = zip::ZipArchive::new(Cursor::new(archive_bytes))
        .map_err(|error| format!("Invalid Modrinth modpack archive: {error}"))?;
    let index_bytes = {
        let mut index = archive
            .by_name("modrinth.index.json")
            .map_err(|error| format!("Modrinth archive is missing modrinth.index.json: {error}"))?;
        let mut bytes = Vec::new();
        index
            .read_to_end(&mut bytes)
            .map_err(|error| format!("Could not read Modrinth modpack index: {error}"))?;
        bytes
    };
    let index: serde_json::Value = serde_json::from_slice(&index_bytes)
        .map_err(|error| format!("Invalid Modrinth modpack index: {error}"))?;
    let files = index
        .get("files")
        .and_then(|files| files.as_array())
        .ok_or_else(|| "Modrinth modpack index has no files list.".to_string())?;
    let mut total_bytes = 0u64;
    for entry in files {
        if entry
            .get("env")
            .and_then(|env| env.get("client"))
            .and_then(serde_json::Value::as_str)
            == Some("unsupported")
        {
            continue;
        }
        let path = entry
            .get("path")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| "Modrinth modpack file is missing its path.".to_string())?;
        let relative_path = safe_modpack_relative_path(path)?;
        let urls = entry
            .get("downloads")
            .and_then(|downloads| downloads.as_array())
            .ok_or_else(|| format!("Modrinth modpack file {path} has no download URLs."))?;
        let mut downloaded = None;
        for url in urls.iter().filter_map(serde_json::Value::as_str) {
            match download_modpack_file(client, url).await {
                Ok(bytes) => {
                    downloaded = Some(bytes);
                    break;
                }
                Err(error) => {
                    log::warn!("Could not download modpack file {path} from {url}: {error}")
                }
            }
        }
        let bytes = downloaded.ok_or_else(|| format!("Could not download modpack file {path}."))?;
        if let Some(expected_sha1) = entry
            .get("hashes")
            .and_then(|hashes| hashes.get("sha1"))
            .and_then(serde_json::Value::as_str)
        {
            let mut hasher = sha1::Sha1::new();
            sha1::Digest::update(&mut hasher, &bytes);
            let actual_sha1 = hex::encode(sha1::Digest::finalize(hasher));
            if !actual_sha1.eq_ignore_ascii_case(expected_sha1) {
                return Err(format!("Hash verification failed for modpack file {path}."));
            }
        }
        total_bytes = total_bytes.saturating_add(bytes.len() as u64);
        if total_bytes > 2 * 1024 * 1024 * 1024 {
            return Err("Modpack files exceed the 2 GiB install limit.".to_string());
        }
        let target = instance_dir.join(relative_path);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create modpack directory: {error}"))?;
        }
        fs::write(&target, bytes).map_err(|error| {
            format!(
                "Could not install modpack file {}: {error}",
                target.display()
            )
        })?;
    }
    total_bytes =
        total_bytes.saturating_add(extract_modpack_overrides(&mut archive, instance_dir)?);
    Ok(("Modrinth modpack".to_string(), total_bytes))
}

async fn install_curseforge_pack(
    request: &InstallAddonRequest,
    instance_dir: &Path,
    client: &reqwest::Client,
) -> Result<(String, u64), String> {
    let api_key = get_curseforge_api_key()?.ok_or_else(|| {
        "A CurseForge API key is required to install CurseForge modpacks.".to_string()
    })?;
    let mut files_url = reqwest::Url::parse(&format!(
        "https://api.curseforge.com/v1/mods/{}/files",
        request.addon_id
    ))
    .map_err(|error| format!("Could not construct CurseForge file URL: {error}"))?;
    files_url
        .query_pairs_mut()
        .append_pair(
            "gameVersion",
            request.game_version.as_deref().unwrap_or_default(),
        )
        .append_pair("pageSize", "50")
        .append_pair("index", "0");
    let response = client
        .get(files_url)
        .header("x-api-key", &api_key)
        .send()
        .await
        .map_err(|error| format!("Could not query CurseForge modpack files: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "CurseForge modpack lookup returned HTTP {}.",
            response.status()
        ));
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("Invalid CurseForge modpack response: {error}"))?;
    let pack_file = body
        .get("data")
        .and_then(serde_json::Value::as_array)
        .and_then(|files| {
            files.iter().find(|file| {
                file.get("fileName")
                    .and_then(serde_json::Value::as_str)
                    .is_some_and(|name| name.to_ascii_lowercase().ends_with(".zip"))
            })
        })
        .ok_or_else(|| "CurseForge did not return an installable modpack archive.".to_string())?;
    let pack_id = pack_file
        .get("id")
        .and_then(serde_json::Value::as_u64)
        .ok_or_else(|| "CurseForge modpack file is missing its ID.".to_string())?;
    let download_url = pack_file
        .get("downloadUrl")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let download_url = match download_url {
        Some(url) => url,
        None => {
            let url = format!(
                "https://api.curseforge.com/v1/mods/{}/files/{pack_id}/download-url",
                request.addon_id
            );
            let response = client
                .get(url)
                .header("x-api-key", &api_key)
                .send()
                .await
                .map_err(|error| {
                    format!("Could not resolve CurseForge modpack download URL: {error}")
                })?;
            if !response.status().is_success() {
                return Err(format!(
                    "CurseForge download URL lookup returned HTTP {}.",
                    response.status()
                ));
            }
            response
                .json::<serde_json::Value>()
                .await
                .map_err(|error| format!("Invalid CurseForge download URL response: {error}"))?
                .get("data")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| "CurseForge did not provide a modpack download URL.".to_string())?
                .to_string()
        }
    };
    let archive_bytes = download_modpack_file(client, &download_url).await?;
    let mut archive = zip::ZipArchive::new(Cursor::new(archive_bytes))
        .map_err(|error| format!("Invalid CurseForge modpack archive: {error}"))?;
    let manifest_bytes = {
        let mut manifest = archive
            .by_name("manifest.json")
            .map_err(|error| format!("CurseForge archive is missing manifest.json: {error}"))?;
        let mut bytes = Vec::new();
        manifest
            .read_to_end(&mut bytes)
            .map_err(|error| format!("Could not read CurseForge modpack manifest: {error}"))?;
        bytes
    };
    let manifest: serde_json::Value = serde_json::from_slice(&manifest_bytes)
        .map_err(|error| format!("Invalid CurseForge modpack manifest: {error}"))?;
    let pack_files = manifest
        .get("files")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "CurseForge modpack manifest has no files list.".to_string())?;
    let mut identifiers = Vec::new();
    for file in pack_files {
        if file.get("required").and_then(serde_json::Value::as_bool) == Some(false) {
            continue;
        }
        let mod_id = file
            .get("projectID")
            .and_then(serde_json::Value::as_u64)
            .ok_or_else(|| "CurseForge modpack entry has no project ID.".to_string())?;
        let file_id = file
            .get("fileID")
            .and_then(serde_json::Value::as_u64)
            .ok_or_else(|| "CurseForge modpack entry has no file ID.".to_string())?;
        identifiers.push(serde_json::json!({"modId": mod_id, "fileId": file_id}));
    }
    let mut total_bytes = 0u64;
    for chunk in identifiers.chunks(50) {
        let response = client
            .post("https://api.curseforge.com/v1/mods/files")
            .header("x-api-key", &api_key)
            .json(chunk)
            .send()
            .await
            .map_err(|error| format!("Could not resolve CurseForge modpack files: {error}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "CurseForge file lookup returned HTTP {}.",
                response.status()
            ));
        }
        let body: serde_json::Value = response
            .json()
            .await
            .map_err(|error| format!("Invalid CurseForge file lookup response: {error}"))?;
        let files = body
            .get("data")
            .and_then(serde_json::Value::as_array)
            .ok_or_else(|| "CurseForge file lookup returned no file data.".to_string())?;
        for file in files {
            let url = file
                .get("downloadUrl")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| {
                    "A modpack file is unavailable for download from CurseForge.".to_string()
                })?;
            let name = file
                .get("fileName")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| "CurseForge file is missing its name.".to_string())?;
            let bytes = download_modpack_file(client, url).await?;
            total_bytes = total_bytes.saturating_add(bytes.len() as u64);
            if total_bytes > 2 * 1024 * 1024 * 1024 {
                return Err("Modpack files exceed the 2 GiB install limit.".to_string());
            }
            let target = instance_dir
                .join("mods")
                .join(safe_modpack_relative_path(name)?);
            fs::create_dir_all(
                target
                    .parent()
                    .ok_or_else(|| "Mod file has no parent directory.".to_string())?,
            )
            .map_err(|error| format!("Could not create mods directory: {error}"))?;
            fs::write(&target, bytes).map_err(|error| {
                format!(
                    "Could not install CurseForge mod {}: {error}",
                    target.display()
                )
            })?;
        }
    }
    total_bytes =
        total_bytes.saturating_add(extract_modpack_overrides(&mut archive, instance_dir)?);
    Ok(("CurseForge modpack".to_string(), total_bytes))
}

#[tauri::command]
async fn install_instance_modpack(
    request: InstallAddonRequest,
) -> Result<InstallAddonResult, String> {
    validate_instance_id(&request.instance_id)?;
    let instance_dir = instance_game_dir(&request.instance_id, request.custom_game_dir.clone())?;
    let remove_on_failure = !instance_dir.exists();
    fs::create_dir_all(&instance_dir)
        .map_err(|error| format!("Could not create instance directory: {error}"))?;
    let client = reqwest::Client::new();
    let install_result = if request.provider.eq_ignore_ascii_case("modrinth") {
        install_modrinth_pack(&request, &instance_dir, &client).await
    } else if request.provider.eq_ignore_ascii_case("curseforge") {
        install_curseforge_pack(&request, &instance_dir, &client).await
    } else {
        Err(format!(
            "Unsupported modpack provider: {}",
            request.provider
        ))
    };
    let (label, size_bytes) = match install_result {
        Ok(result) => result,
        Err(error) => {
            if remove_on_failure {
                if let Err(cleanup_error) = fs::remove_dir_all(&instance_dir) {
                    return Err(format!(
                        "{error} Also failed to remove the incomplete modpack instance: {cleanup_error}"
                    ));
                }
            }
            return Err(error);
        }
    };
    Ok(InstallAddonResult {
        success: true,
        file_name: request.addon_name.clone(),
        file_path: instance_dir.to_string_lossy().to_string(),
        size_bytes,
        message: format!(
            "Installed {label} '{}' ({:.2} MB).",
            request.addon_name,
            size_bytes as f64 / (1024.0 * 1024.0)
        ),
    })
}

/// Lists all addons (mods, resourcepacks, shaderpacks, datapacks) installed in an instance
#[tauri::command]
fn list_instance_addons(
    instance_id: String,
    custom_game_dir: Option<String>,
) -> Result<Vec<InstanceAddonItem>, String> {
    let instance_dir = instance_game_dir(&instance_id, custom_game_dir)?;
    if !instance_dir.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();
    let folders = [
        ("mods", "mod"),
        ("resourcepacks", "resourcepack"),
        ("shaderpacks", "shader"),
        ("datapacks", "datapack"),
    ];

    for (folder, addon_type) in folders {
        let dir = instance_dir.join(folder);
        if !dir.is_dir() {
            continue;
        }
        let entries = fs::read_dir(&dir)
            .map_err(|error| format!("Could not list {}: {error}", dir.display()))?;
        for entry in entries {
            let path = entry.map_err(|error| error.to_string())?.path();
            if !path.is_file() {
                continue;
            }
            let file_name = path
                .file_name()
                .ok_or_else(|| format!("Addon path has no file name: {}", path.display()))?
                .to_string_lossy()
                .to_string();
            let lower = file_name.to_lowercase();
            let expected_extension = if addon_type == "mod" { ".jar" } else { ".zip" };
            if !lower.ends_with(expected_extension)
                && !lower.ends_with(&format!("{expected_extension}.disabled"))
            {
                continue;
            }
            let enabled = !lower.ends_with(".disabled");
            let clean_length = file_name.len()
                - if enabled { 0 } else { ".disabled".len() }
                - expected_extension.len();
            let clean_name = file_name[..clean_length].to_string();
            let size_bytes = path
                .metadata()
                .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?
                .len();

            items.push(InstanceAddonItem {
                id: format!("{folder}_{file_name}"),
                file_name: file_name.clone(),
                name: clean_name,
                addon_type: addon_type.to_string(),
                enabled,
                size_bytes,
                path: path.to_string_lossy().to_string(),
            });
        }
    }

    Ok(items)
}

/// Toggles an addon file (mod or pack) between enabled and disabled
#[tauri::command]
fn toggle_instance_addon(
    instance_id: String,
    addon_type: String,
    file_name: String,
    enable: bool,
    custom_game_dir: Option<String>,
) -> Result<String, String> {
    let folder_name = addon_folder(&addon_type)?;
    validate_addon_file_name(&file_name, folder_name, true)?;
    let dir = instance_game_dir(&instance_id, custom_game_dir)?.join(folder_name);
    let current_path = dir.join(&file_name);
    if !current_path.exists() {
        return Err(format!("Addon file '{}' does not exist.", file_name));
    }

    let new_name = if enable {
        file_name
            .strip_suffix(".disabled")
            .unwrap_or(&file_name)
            .to_string()
    } else {
        if file_name.ends_with(".disabled") {
            file_name.clone()
        } else {
            format!("{}.disabled", file_name)
        }
    };
    let new_path = dir.join(&new_name);
    fs::rename(current_path, new_path).map_err(|e| e.to_string())?;
    Ok(new_name)
}

/// Deletes an addon file from an instance
#[tauri::command]
fn delete_instance_addon(
    instance_id: String,
    addon_type: String,
    file_name: String,
    custom_game_dir: Option<String>,
) -> Result<bool, String> {
    let folder_name = addon_folder(&addon_type)?;
    validate_addon_file_name(&file_name, folder_name, true)?;
    let file_path = instance_game_dir(&instance_id, custom_game_dir)?
        .join(folder_name)
        .join(&file_name);
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn import_local_addon_files(
    instance_id: String,
    custom_game_dir: Option<String>,
    paths: Vec<String>,
) -> Result<Vec<ImportedAddonFile>, String> {
    let instance_dir = instance_game_dir(&instance_id, custom_game_dir)?;
    fs::create_dir_all(&instance_dir)
        .map_err(|error| format!("Could not create instance directory: {error}"))?;

    let mut files_to_copy = Vec::new();
    for path in paths {
        let source = PathBuf::from(path)
            .canonicalize()
            .map_err(|error| format!("Could not access selected addon file: {error}"))?;
        if !source.is_file() {
            return Err(format!(
                "Selected addon is not a file: {}",
                source.display()
            ));
        }
        let file_name = source
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| {
                format!(
                    "Selected addon has an invalid file name: {}",
                    source.display()
                )
            })?
            .to_string();
        let extension = source
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or_default();
        let (folder_name, addon_type) = if extension.eq_ignore_ascii_case("jar") {
            ("mods", "mod")
        } else if extension.eq_ignore_ascii_case("zip") {
            ("resourcepacks", "resourcepack")
        } else {
            return Err(format!(
                "Unsupported addon file '{}'. Choose a .jar or .zip file.",
                file_name
            ));
        };
        validate_addon_file_name(&file_name, folder_name, false)?;
        let target_dir = instance_dir.join(folder_name);
        fs::create_dir_all(&target_dir)
            .map_err(|error| format!("Could not create {}: {error}", target_dir.display()))?;
        let target = target_dir.join(&file_name);
        if target.exists()
            || files_to_copy.iter().any(
                |(_, existing_target, _, _): &(PathBuf, PathBuf, String, String)| {
                    existing_target == &target
                },
            )
        {
            return Err(format!(
                "An addon named '{}' already exists in this instance.",
                file_name
            ));
        }
        files_to_copy.push((source, target, addon_type.to_string(), file_name));
    }

    let mut imported = Vec::with_capacity(files_to_copy.len());
    let mut copied_paths: Vec<PathBuf> = Vec::with_capacity(files_to_copy.len());
    for (source, target, addon_type, file_name) in files_to_copy {
        if let Err(error) = fs::copy(&source, &target) {
            rollback_imported_addons(&copied_paths);
            return Err(format!(
                "Could not copy addon {}: {error}",
                source.display()
            ));
        }
        copied_paths.push(target.clone());
        let metadata = match fs::metadata(&target) {
            Ok(metadata) => metadata,
            Err(error) => {
                rollback_imported_addons(&copied_paths);
                return Err(format!(
                    "Could not inspect imported addon {}: {error}",
                    target.display()
                ));
            }
        };
        let name = file_name
            .strip_suffix(if addon_type == "mod" { ".jar" } else { ".zip" })
            .unwrap_or(&file_name)
            .to_string();
        imported.push(ImportedAddonFile {
            file_name,
            name,
            addon_type,
            size_bytes: metadata.len(),
        });
    }
    Ok(imported)
}

fn rollback_imported_addons(copied_paths: &[PathBuf]) {
    for copied_path in copied_paths {
        if let Err(error) = fs::remove_file(copied_path) {
            log::error!(
                "Could not roll back imported addon {}: {error}",
                copied_path.display()
            );
        }
    }
}

fn parse_oauth_callback(request: &str) -> Result<String, String> {
    let request_line = request
        .lines()
        .next()
        .ok_or_else(|| "Microsoft returned an empty browser callback.".to_string())?;
    let mut parts = request_line.split_whitespace();
    if parts.next() != Some("GET") {
        return Err("Microsoft returned an invalid browser callback.".to_string());
    }
    let target = parts
        .next()
        .ok_or_else(|| "Microsoft returned an invalid browser callback.".to_string())?;
    let callback_url = reqwest::Url::parse(&format!("http://localhost{target}"))
        .map_err(|error| format!("Invalid Microsoft callback URL: {error}"))?;
    if callback_url.path() != "/callback" {
        return Err("Microsoft returned an unexpected browser callback path.".to_string());
    }
    let parameters = callback_url.query_pairs().collect::<HashMap<_, _>>();
    if let Some(error) = parameters.get("error") {
        let description = parameters
            .get("error_description")
            .map(|value| value.as_ref())
            .unwrap_or(error.as_ref());
        return Err(format!("Microsoft sign-in failed: {description}"));
    }
    parameters
        .get("code")
        .filter(|code| !code.is_empty())
        .map(|code| code.to_string())
        .ok_or_else(|| "Could not extract authorization code from Microsoft redirect.".to_string())
}

/// Opens Microsoft OAuth and accepts localhost callbacks on either loopback address family.
#[tauri::command]
async fn login_with_microsoft_loopback(
    client_id: Option<String>,
    port: Option<u16>,
) -> Result<serde_json::Value, String> {
    let client_id = client_id
        .filter(|c| !c.trim().is_empty())
        .unwrap_or_else(|| "fa5a840b-f490-4075-aaa9-83a6763c602e".to_string());

    let preferred_port = port.unwrap_or(28420);
    let listener = match TcpListener::bind(("127.0.0.1", preferred_port)).await {
        Ok(l) => l,
        Err(_) => match TcpListener::bind(("127.0.0.1", 28421)).await {
            Ok(l) => l,
            Err(_) => TcpListener::bind(("127.0.0.1", 0))
                .await
                .map_err(|e| format!("Failed to bind local loopback port for OAuth: {e}"))?,
        },
    };

    let bound_port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read bound port: {e}"))?
        .port();
    let ipv6_listener = TcpListener::bind(("::1", bound_port)).await.ok();

    let verifier_raw = format!("{}_{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let code_verifier = URL_SAFE_NO_PAD.encode(verifier_raw.as_bytes());
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    let redirect_uri = format!("http://localhost:{bound_port}/callback");
    let mut auth_url =
        reqwest::Url::parse("https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize")
            .map_err(|error| format!("Could not create Microsoft sign-in URL: {error}"))?;
    auth_url
        .query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("response_type", "code")
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_mode", "query")
        .append_pair("scope", "XboxLive.signin offline_access")
        .append_pair("code_challenge", &code_challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("prompt", "select_account");
    let auth_url = auth_url.to_string();

    // Open user's system default web browser
    #[cfg(target_os = "windows")]
    let browser_result = {
        let mut cmd = Command::new("cmd");
        suppress_console_window(&mut cmd);
        cmd.args(["/C", "start", "", &auth_url]).spawn()
    };
    #[cfg(target_os = "macos")]
    let browser_result = Command::new("open").arg(&auth_url).spawn();
    #[cfg(target_os = "linux")]
    let browser_result = Command::new("xdg-open").arg(&auth_url).spawn();
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let browser_result: Result<std::process::Child, std::io::Error> =
        Err(std::io::Error::other("Unsupported operating system"));
    browser_result
        .map_err(|error| format!("Could not open Microsoft sign-in in a browser: {error}"))?;

    // Wait for the browser redirect to localhost callback (3 minutes timeout)
    let accepted = tokio::time::timeout(Duration::from_secs(180), async {
        if let Some(listener_v6) = ipv6_listener.as_ref() {
            tokio::select! {
                result = listener.accept() => result,
                result = listener_v6.accept() => result,
            }
        } else {
            listener.accept().await
        }
    })
    .await
    .map_err(|_| "Microsoft sign-in timed out after 3 minutes. Please try again.")?
    .map_err(|e| format!("Failed to accept incoming loopback connection: {e}"))?;
    let (mut stream, _) = accepted;

    let mut buffer = [0u8; 4096];
    let bytes_read = stream
        .read(&mut buffer)
        .await
        .map_err(|e| format!("Failed to read OAuth response: {e}"))?;
    let request_str = String::from_utf8_lossy(&buffer[..bytes_read]);

    let auth_code = parse_oauth_callback(&request_str)?;

    // Respond to user's browser with a styled confirmation page
    let html_body = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authentication Successful — The Boys Launcher</title>
  <style>
    body { margin: 0; background: #0c0f17; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #151b27; border: 2px solid #2a344a; border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); }
    .icon { font-size: 54px; margin-bottom: 16px; }
    h1 { font-size: 24px; color: #10b981; margin: 0 0 12px 0; font-weight: 800; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.5; margin: 0 0 24px 0; }
    .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎮</div>
    <h1>Signed In Successfully!</h1>
    <p>Your Microsoft account has been verified. You can now close this browser window and return to <strong>The Boys Launcher</strong>.</p>
    <div class="badge">Safe to close this window</div>
  </div>
</body>
</html>"#;
    let response_bytes = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html_body.len(),
        html_body
    );
    let _ = stream.write_all(response_bytes.as_bytes()).await;
    let _ = stream.flush().await;

    // Exchange auth code for Microsoft OAuth access token
    let http_client = reqwest::Client::new();
    let token_res = http_client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("grant_type", "authorization_code"),
            ("code", auth_code.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("code_verifier", code_verifier.as_str()),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to exchange authorization code: {e}"))?;

    let token_json: serde_json::Value = token_res
        .json()
        .await
        .map_err(|e| format!("Invalid token response: {e}"))?;

    let ms_access_token = token_json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            let desc = token_json
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown token error");
            format!("Microsoft token exchange error: {desc}")
        })?;
    let ms_refresh_token = token_json
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let expires_in = token_json
        .get("expires_in")
        .and_then(|v| v.as_u64())
        .unwrap_or(86400);

    // Xbox Live authentication
    let xbox_res = http_client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={ms_access_token}")
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|e| format!("Xbox Live authentication request failed: {e}"))?;

    let xbox_json: serde_json::Value = xbox_res
        .json()
        .await
        .map_err(|e| format!("Invalid Xbox Live response: {e}"))?;
    let xbox_token = xbox_json
        .get("Token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Xbox authentication did not return a token.".to_string())?;
    let uhs = xbox_json
        .get("DisplayClaims")
        .and_then(|dc| dc.get("xui"))
        .and_then(|xui| xui.as_array())
        .and_then(|arr| arr.first())
        .and_then(|first| first.get("uhs"))
        .and_then(|uhs| uhs.as_str())
        .ok_or_else(|| "Xbox authentication did not return a user hash.".to_string())?;

    // XSTS authorization
    let xsts_res = http_client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&serde_json::json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbox_token]
            },
            "RelyingParty": "http://xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|e| format!("XSTS authentication request failed: {e}"))?;

    let xsts_json: serde_json::Value = xsts_res
        .json()
        .await
        .map_err(|e| format!("Invalid XSTS response: {e}"))?;
    let xsts_token = xsts_json
        .get("Token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            if let Some(err_code) = xsts_json.get("XErr").and_then(|v| v.as_u64()) {
                match err_code {
                    2148916233 => {
                        "This Microsoft account has no Xbox account created yet.".to_string()
                    }
                    2148916238 => {
                        "This account is a child account and requires parental consent.".to_string()
                    }
                    _ => format!("Xbox security authentication failed (code {err_code})."),
                }
            } else {
                "Xbox security authentication failed.".to_string()
            }
        })?;

    // Minecraft services login
    let mc_auth_res = http_client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&serde_json::json!({
            "identityToken": format!("XBL3.0 x={uhs};{xsts_token}")
        }))
        .send()
        .await
        .map_err(|e| format!("Minecraft login request failed: {e}"))?;

    let mc_auth_json: serde_json::Value = mc_auth_res
        .json()
        .await
        .map_err(|e| format!("Invalid Minecraft auth response: {e}"))?;
    let mc_access_token = mc_auth_json
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Minecraft services authentication failed.".to_string())?;

    // Minecraft profile lookup
    let profile_res = http_client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_access_token)
        .send()
        .await
        .map_err(|e| format!("Minecraft profile request failed: {e}"))?;

    let profile_json: serde_json::Value = profile_res
        .json()
        .await
        .map_err(|e| format!("Invalid Minecraft profile response: {e}"))?;
    let profile_id = profile_json
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            "Minecraft profile has no ID. Does this account own Minecraft Java Edition?".to_string()
        })?;
    let profile_name = profile_json
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Minecraft profile has no username.".to_string())?;

    let skins = profile_json.get("skins").and_then(|v| v.as_array());
    let skin_url = skins
        .and_then(|arr| arr.first())
        .and_then(|s| s.get("url"))
        .and_then(|u| u.as_str());
    let variant = skins
        .and_then(|arr| arr.first())
        .and_then(|s| s.get("variant"))
        .and_then(|v| v.as_str());
    let model = match variant {
        Some("SLIM") => "slim",
        _ => "classic",
    };

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let expires_at = now_ms + (expires_in * 1000);

    // Save tokens in OS keyring
    save_microsoft_credentials(
        profile_id.to_string(),
        mc_access_token.to_string(),
        ms_refresh_token.clone(),
        expires_at,
    )?;

    Ok(serde_json::json!({
        "id": profile_id,
        "type": "microsoft",
        "username": profile_name,
        "uuid": profile_id,
        "accessToken": mc_access_token,
        "refreshToken": ms_refresh_token,
        "expiresAt": expires_at,
        "ownsGame": true,
        "skinProvider": "mojang",
        "skinUrl": skin_url,
        "model": model,
        "createdAt": now_ms,
        "lastUsed": now_ms
    }))
}

fn parse_semver_triplet(version: &str) -> (u32, u32, u32) {
    let mut parts = version.trim().trim_start_matches('v').split('.');
    let major = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let patch = parts
        .next()
        .and_then(|p| p.split('-').next())
        .and_then(|p| p.parse().ok())
        .unwrap_or(0);
    (major, minor, patch)
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    let l = parse_semver_triplet(latest);
    let c = parse_semver_triplet(current);
    l > c
}

fn select_windows_installer(assets: &[serde_json::Value]) -> Option<(String, String)> {
    assets.iter().find_map(|asset| {
        let name = asset.get("name").and_then(|name| name.as_str())?;
        if !name.to_ascii_lowercase().ends_with(".exe") {
            return None;
        }
        let url = asset
            .get("browser_download_url")
            .and_then(|url| url.as_str())?;
        Some((url.to_string(), name.to_string()))
    })
}

/// Checks the official GitHub repository for new releases and returns update information
#[tauri::command]
async fn check_github_launcher_update() -> Result<LauncherUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let repo =
        std::env::var("GITHUB_REPOSITORY").unwrap_or_else(|_| "ktesla39/TheBoyz".to_string());
    let url = format!("https://api.github.com/repos/{repo}/releases/latest");

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header(
            "User-Agent",
            format!("TheBoysLauncher/{}", env!("CARGO_PKG_VERSION")),
        )
        .send()
        .await
        .map_err(|e| format!("Failed to check GitHub releases: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "GitHub releases request returned HTTP {}.",
            resp.status()
        ));
    }

    let release: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Invalid release metadata: {e}"))?;
    let tag = release
        .get("tag_name")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .trim_start_matches('v');
    if tag.is_empty() {
        return Err("GitHub release metadata did not include a version tag.".to_string());
    }
    let release_name = release
        .get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("The Boys Launcher")
        .to_string();
    let release_notes = release
        .get("body")
        .and_then(|b| b.as_str())
        .unwrap_or("Bug fixes and performance improvements.")
        .to_string();

    let (download_url, asset_name) = release
        .get("assets")
        .and_then(|assets| assets.as_array())
        .and_then(|assets| select_windows_installer(assets))
        .map_or((None, None), |(url, name)| (Some(url), Some(name)));

    let has_update = download_url.is_some() && is_newer_version(tag, &current_version);

    Ok(LauncherUpdateInfo {
        has_update,
        current_version,
        latest_version: tag.to_string(),
        release_name,
        release_notes,
        download_url,
        asset_name,
    })
}

/// Downloads and launches the in-place NSIS installer from GitHub releases without wiping user data
#[tauri::command]
async fn apply_github_launcher_update(download_url: String) -> Result<bool, String> {
    let parsed_url =
        reqwest::Url::parse(&download_url).map_err(|_| "Invalid download URL.".to_string())?;
    if parsed_url.scheme() != "https"
        || parsed_url.host_str() != Some("github.com")
        || !parsed_url.path().to_ascii_lowercase().ends_with(".exe")
    {
        return Err("Invalid download URL.".to_string());
    }

    let client = reqwest::Client::new();
    let resp = client
        .get(&download_url)
        .header(
            "User-Agent",
            format!("TheBoysLauncher/{}", env!("CARGO_PKG_VERSION")),
        )
        .send()
        .await
        .map_err(|e| format!("Failed to download update installer: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with HTTP {}.", resp.status()));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read update installer bytes: {e}"))?;
    let temp_dir = std::env::temp_dir();
    let target_path = temp_dir.join("the-boys-launcher-setup-update.exe");
    fs::write(&target_path, &bytes)
        .map_err(|e| format!("Failed to write installer to temp: {e}"))?;

    #[cfg(windows)]
    {
        let mut cmd = Command::new(&target_path);
        suppress_console_window(&mut cmd);
        cmd.arg("/S"); // NSIS silent/passive update in place
        cmd.spawn()
            .map_err(|e| format!("Failed to launch updater: {e}"))?;
        std::process::exit(0);
    }

    #[cfg(not(windows))]
    {
        Err("The Windows installer updater is only available on Windows.".to_string())
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
    use super::{
        find_version_line, safe_modpack_relative_path, validate_addon_file_name,
        validate_instance_id, validate_mod_file_name,
    };

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

    #[test]
    fn validates_addon_names_and_file_types() {
        assert!(validate_addon_file_name("example.jar", "mods", false).is_ok());
        assert!(validate_addon_file_name("pack.zip", "resourcepacks", false).is_ok());
        assert!(validate_addon_file_name("example.jar.disabled", "mods", true).is_ok());
        assert!(validate_addon_file_name("../outside.jar", "mods", true).is_err());
        assert!(validate_addon_file_name("archive.zip", "mods", false).is_err());
        assert!(validate_addon_file_name("example.jar.disabled", "mods", false).is_err());
    }

    #[test]
    fn rejects_unsafe_modpack_paths() {
        assert!(safe_modpack_relative_path("mods/example.jar").is_ok());
        assert!(safe_modpack_relative_path("../outside.jar").is_err());
        assert!(safe_modpack_relative_path("C:/outside.jar").is_err());
        assert!(safe_modpack_relative_path("mods\\outside.jar").is_err());
    }

    #[test]
    fn reads_graphics_versions_from_system_tool_output() {
        assert_eq!(
            find_version_line(
                "OpenGL core profile version string: 4.6 (Core Profile)\n",
                &["OpenGL core profile version string:"]
            )
            .as_deref(),
            Some("4.6 (Core Profile)")
        );
        assert_eq!(
            find_version_line(
                "Vulkan Instance Version: 1.3.280\n",
                &["Vulkan Instance Version:"]
            )
            .as_deref(),
            Some("1.3.280")
        );
        assert_eq!(
            find_version_line(
                "<DirectXVersion>DirectX 12</DirectXVersion>",
                &["<directxversion>"]
            )
            .map(|value| value
                .split('<')
                .next()
                .unwrap_or_default()
                .trim()
                .to_string())
            .as_deref(),
            Some("DirectX 12")
        );
    }
}

#[cfg(test)]
#[cfg(target_os = "windows")]
mod shortcut_icon_tests {
    use super::{powershell_single_quoted, validate_shortcut_icon};

    fn test_icon() -> Vec<u8> {
        let png_signature = [137, 80, 78, 71, 13, 10, 26, 10];
        let mut icon = vec![0; 22];
        icon[2..6].copy_from_slice(&[1, 0, 1, 0]);
        icon.extend_from_slice(&png_signature);
        let image_size = png_signature.len() as u32;
        icon[14..18].copy_from_slice(&image_size.to_le_bytes());
        icon[18..22].copy_from_slice(&22u32.to_le_bytes());
        icon
    }

    #[test]
    fn accepts_png_icons_and_rejects_malformed_icons() {
        let icon = test_icon();
        assert!(validate_shortcut_icon(&icon).is_ok());

        let mut invalid = icon;
        invalid[0] = 1;
        assert!(validate_shortcut_icon(&invalid).is_err());
    }

    #[test]
    fn escapes_powershell_single_quoted_paths() {
        assert_eq!(
            powershell_single_quoted("D:\\Bob's\\Launcher"),
            "'D:\\Bob''s\\Launcher'"
        );
    }
}

#[cfg(test)]
mod oauth_callback_tests {
    use super::parse_oauth_callback;

    #[test]
    fn parses_encoded_authorization_codes() {
        assert_eq!(
            parse_oauth_callback("GET /callback?code=abc%2F123&state=x HTTP/1.1\r\n").unwrap(),
            "abc/123"
        );
    }

    #[test]
    fn reports_oauth_errors_and_rejects_unexpected_paths() {
        assert!(parse_oauth_callback(
            "GET /callback?error=access_denied&error_description=User%20cancelled HTTP/1.1\r\n"
        )
        .unwrap_err()
        .contains("User cancelled"));
        assert!(parse_oauth_callback("GET /?code=abc HTTP/1.1\r\n").is_err());
    }
}

#[cfg(test)]
mod updater_tests {
    use super::select_windows_installer;

    #[test]
    fn selects_nsis_installer_instead_of_msi_package() {
        let assets = vec![
            serde_json::json!({"name":"The Boys.msi","browser_download_url":"https://github.com/x/y/releases/download/v1/The%20Boys.msi"}),
            serde_json::json!({"name":"The Boys.exe","browser_download_url":"https://github.com/x/y/releases/download/v1/The%20Boys.exe"}),
        ];
        assert_eq!(
            select_windows_installer(&assets),
            Some((
                "https://github.com/x/y/releases/download/v1/The%20Boys.exe".to_string(),
                "The Boys.exe".to_string()
            ))
        );
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
    fn detects_hmcl_nested_game_directory_and_version_metadata() {
        let directory = test_directory("hmcl-instance");
        let game_directory = directory.join(".minecraft");
        let version = "fabric-loader-0.15.11-1.20.1";
        fs::create_dir_all(game_directory.join("mods")).unwrap();
        fs::create_dir_all(game_directory.join("versions").join(version)).unwrap();
        fs::write(
            game_directory
                .join("versions")
                .join(version)
                .join(format!("{version}.json")),
            r#"{"inheritsFrom":"1.20.1","libraries":[{"name":"net.fabricmc:fabric-loader:0.15.11"}]}"#,
        )
        .unwrap();

        let (game_dir, metadata_dir) = resolve_import_directories(&directory).unwrap();
        assert_eq!(game_dir, game_directory);
        assert_eq!(metadata_dir, game_dir);
        assert_eq!(
            detect_import_metadata(&metadata_dir).unwrap(),
            (
                "1.20.1".to_string(),
                "fabric".to_string(),
                Some("0.15.11".to_string())
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

    #[test]
    fn imports_local_addons_into_the_requested_game_directory() {
        let source = test_directory("addon-source");
        let target = test_directory("addon-target");
        fs::create_dir_all(&source).unwrap();
        let addon_path = source.join("example.jar");
        fs::write(&addon_path, b"mod contents").unwrap();

        let imported = import_local_addon_files(
            "test_instance".to_string(),
            Some(target.to_string_lossy().to_string()),
            vec![addon_path.to_string_lossy().to_string()],
        )
        .unwrap();

        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].file_name, "example.jar");
        assert_eq!(
            fs::read(target.join("mods").join("example.jar")).unwrap(),
            b"mod contents"
        );

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
            detect_graphics_api_versions,
            install_minecraft_instance,
            install_instance_modpack,
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
            get_startup_instance_id,
            list_instances,
            create_instance,
            delete_instance,
            clone_instance,
            list_instance_mods,
            toggle_mod_file,
            delete_mod_file,
            install_instance_addon,
            list_instance_addons,
            toggle_instance_addon,
            delete_instance_addon,
            import_local_addon_files,
            login_with_microsoft_loopback,
            check_github_launcher_update,
            apply_github_launcher_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running The Boys launcher application");
}
