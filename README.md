# The Boys — Next-Gen Minecraft Launcher 🎮⚡

<div align="center">
  <img src="public/logo.png" alt="The Boys Launcher Logo" width="140" height="140" style="border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);" />
  <br />
  <p><strong>A Minecraft-inspired launcher interface built with Rust (Tauri 2.0), React 19, TypeScript, and Tailwind CSS v4.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Rust-2021-DEA584?style=for-the-badge&logo=rust&logoColor=white" alt="Rust" />
    <img src="https://img.shields.io/badge/Tauri-2.0-24C8DB?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri" />
    <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-7.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    <img src="https://img.shields.io/badge/Minecraft-Java_Edition-5B8C32?style=for-the-badge&logo=minecraft&logoColor=white" alt="Minecraft" />
  </p>
</div>

---

## ⚠️ Release Readiness

The native backend now installs Mojang version metadata, client JARs, libraries, natives, assets, and logging configuration, then constructs the JVM/game arguments from the selected version metadata. Fabric and Quilt profiles use their upstream metadata services; Forge and NeoForge use their upstream client installers. Clicking Play verifies/installs missing files before starting Java. The launcher requires a compatible Java executable selected in settings; it does not provision Java runtimes.

This is the first end-to-end implementation and is **not yet release-certified**: clean-machine installs and gameplay have not been tested for every supported Minecraft/loader combination. Loader availability is determined by upstream services, and unsupported combinations return an error. Verify real installs and online/offline account behavior before describing the launcher as production-ready.

## 🌟 Key Features

### 🚀 High-Performance Rust & Tauri 2.0 Backend
- **Ultra-lightweight footprint**: Consumes minimal memory compared to traditional Electron launchers.
- **Native Process Supervision**: Directly manages Java client processes, monitoring lifecycle state, tracking PIDs, and handling clean shutdowns.
- **Discrete GPU Offloading**: Automatically injects NVIDIA/AMD discrete graphics environment flags (`DRI_PRIME=1`, `__NV_PRIME_RENDER_OFFLOAD=1`, `__GLX_VENDOR_LIBRARY_NAME=nvidia`).
- **Automated Java Detection**: Discovers installed JDK/JRE runtimes across common system paths for Java 8, 17, and 21.

### 🕹️ Universal Instance Management
- **Full Mod Loader Support**: Supports **Vanilla**, **Fabric**, **Forge**, **NeoForge**, and **Quilt**.
- **Isolated Environments**: Each instance runs with its own isolated directory structure (`mods`, `resourcepacks`, `shaderpacks`, `saves`, `configs`).
- **Fine-grained JVM Controls**: Memory heap allocation sliders (Min/Max RAM), custom JVM arguments, and automated GC tuning presets (Aikar's G1GC, Shenandoah, and Low-RAM Potato Mode).
- **1-Click Cloning & Desktop Shortcuts**: Instant instance duplication and automated Windows `.bat`/`.lnk` desktop shortcut generation.
- **Launcher Imports**: Copy saves, mods, configs, resource packs, shaders, and server settings from SKLauncher 4 and compatible Minecraft game directories without changing the source.
- **Launch Progress & Timing**: Follow install/download progress and see how long each launch takes to start its Java process.
- **After-Launch Actions**: Keep the launcher open, minimize it, hide it to the system tray, or close it after Minecraft starts.

### 🌐 Multiplayer Server Monitor & Direct Connect
- **Real-Time TCP Server List Ping (SLP)**: Native Minecraft handshake protocol pinging servers directly over TCP to measure latency, player counts, and server status.
- **MOTD Formatting Decoder**: Decodes legacy and modern Minecraft color formatting codes (`§a`, `§c`, `§e`, `§b`, etc.) into authentic styled spans.
- **1-Click Direct Connect Boot Target**: On Minecraft 1.20.5 and newer, the launcher uses Quick Play to connect to the selected server as the game starts.
- **In-Monitor Instance Management**: Manage mods, memory, and settings for the boot instance directly from the Server Monitor view.

### 🎨 Authentic Minecraft GUI Aesthetic Studio
- **Tactile 3D Buttons**: Modeled after authentic Minecraft texture-pack GUI elements with pixel-crisp 3D bevels, highlight borders, shadows, and physical click depression.
- **10 Button Color Themes**: Emerald Classic, Glacial Diamond, Redstone Crimson, Nether Gold, Ender Void, Raw Copper, Lapis Lazuli, Obsidian Carbon, Netherite Steel, and Prismarine Teal.
- **Dynamic Hex Color Engine**: Fine-tune any button or accent color with the built-in color wheel; the dynamic shader engine automatically calculates highlights and shadow bevels.
- **Atmospheric Background Themes**: 9 immersive launcher environments including *Obsidian Dark, Emerald Grove, Glacial Diamond, Nether Crimson, Ender Void, Redstone Core, Cyber Matrix, Deepslate Classic, and OLED Pure Black*.
- **Brand Icon Customization**: Choose from 17 pixel-art Minecraft icons, upload your own local image, or paste an icon URL.

### 🛡️ Dual Authentication & 3D Skin Studio
- **Dual Auth Engine**: Seamless support for both **Microsoft Online Accounts** (OAuth 2.0) and **Offline Profiles** (Ely.by skinsystem integration).
- **Interactive 3D Skin Canvas**: Real-time WebGL/Canvas 3D player model showcase with cape rendering, Steve (4px) / Alex (3px slim) arm support, and skin texture uploading.

### 📦 Integrated Modrinth & CurseForge Discovery
- Search and filter thousands of mods, modpacks, resource packs, and shaders directly inside the launcher.
- Automatic version compatibility checking and dependency resolution.

---

## 🏗️ Architecture

```
TheBoyz/
├── public/                       # Static public assets (official logo, favicon)
│   └── logo.png                  # Master application brand icon
├── src/                          # Frontend React 19 application
│   ├── assets/                   # Images and banners
│   ├── components/               # Modular UI components
│   │   ├── accounts/             # Account management & skin studio
│   │   ├── addons/               # Modrinth & CurseForge browser
│   │   ├── common/               # Desktop shortcuts & target modals
│   │   ├── console/              # Real-time game log stream
│   │   ├── home/                 # Launch cockpit & quick instances
│   │   ├── icons/                # High-definition pixel SVG Minecraft icons
│   │   ├── instances/            # Instance creator & detailed manager
│   │   ├── layout/               # Dynamic sidebar & top header
│   │   ├── servers/              # Multiplayer Server Monitor
│   │   ├── settings/             # Aesthetic Studio & hardware preferences
│   │   └── skin/                 # 3D Skin canvas & player heads
│   ├── services/                 # API clients, launch engine, theme engine
│   │   ├── authService.ts        # Dual Microsoft & Ely.by authentication
│   │   ├── launchEngine.ts       # Minecraft launch argument builder
│   │   ├── soundService.ts       # Authentic WebAudio click & level-up SFX
│   │   ├── tauriBridge.ts        # Typed IPC bridge to Tauri backend
│   │   └── themeService.ts       # Dynamic palette and button bevel engine
│   ├── types/                    # TypeScript interfaces & definitions
│   ├── App.tsx                   # Main application controller
│   └── index.css                 # Obsidian textures, tactile buttons, styles
├── src-tauri/                    # Native Rust Tauri 2.0 backend
│   ├── src/
│   │   ├── lib.rs                # Native Tauri IPC commands and instance import
│   │   └── main.rs               # Application entry point
│   ├── Cargo.toml                # Rust crate dependencies
│   ├── tauri.conf.json           # Tauri window, security & bundle config
│   └── icons/                    # App icons (generated from public/logo.png)
├── index.html                    # HTML entry point with favicon lockup
├── package.json                  # Cleaned, lean frontend dependencies
├── tsconfig.json                 # TypeScript compiler configuration
└── vite.config.ts                # Vite build pipeline with Tailwind v4
```

---

## 🛠️ Tauri Rust Command API

The Rust backend exposes 27 commands via Tauri's IPC bridge:

| Command | Description |
| :--- | :--- |
| `get_system_hardware` | Queries system CPU, RAM, disk space, and flags older low-spec hardware. |
| `detect_java_installations` | Scans system directories and discovers Java 8, 17, and 21 installations. |
| `validate_java_path` | Verifies whether a designated Java executable exists and functions. |
| `install_minecraft_instance` | Downloads/verifies Mojang client, library, native, asset, and logging files; installs the requested loader profile. |
| `import_minecraft_instance` | Copies supported game data from another launcher into a new managed instance. |
| `launch_game` | Builds the classpath and launcher arguments from the installed version profile, then starts Java in the instance directory. |
| `stop_game` | Terminates a running Minecraft process by PID. |
| `is_game_running` | Checks whether a specific game process is currently active. |
| `ping_minecraft_server` | Performs a real TCP socket handshake to fetch MOTD, latency, and online player counts. |
| `search_curseforge` | Searches CurseForge for compatible Minecraft projects. |
| `get_curseforge_key_status` | Checks whether a CurseForge API key is configured in the system credential store. |
| `save_curseforge_api_key` | Saves a CurseForge API key in the system credential store. |
| `clear_curseforge_api_key` | Removes the saved CurseForge API key. |
| `create_desktop_shortcut` | Generates a 1-click desktop launch shortcut file. |
| `save_skin_file` | Caches base64-encoded skin PNGs into the local application skins directory. |
| `fetch_ely_by_skin` | Queries Ely.by texture repositories for offline player skins and cloaks. |
| `save_microsoft_credentials` | Saves Microsoft sign-in credentials in the system credential store. |
| `get_microsoft_credentials` | Reads saved Microsoft sign-in credentials from the system credential store. |
| `clear_microsoft_credentials` | Removes saved Microsoft sign-in credentials. |
| `verify_file_hash` | Calculates SHA-1 and SHA-256 hashes for a file. |
| `list_instances` | Reads all stored instances from the filesystem. |
| `create_instance` | Scaffold an isolated instance directory tree (`mods`, `packs`, `saves`). |
| `delete_instance` | Removes an instance directory and associated files. |
| `clone_instance` | Duplicates an instance profile and configurations. |
| `list_instance_mods` | Scans and lists `.jar` and `.jar.disabled` mod files in an instance. |
| `toggle_mod_file` | Enables or disables a mod by renaming between `.jar` and `.jar.disabled`. |
| `delete_mod_file` | Deletes a mod JAR file from disk. |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18.0+` or `v20.0+`
- **Rust toolchain**: `stable` (installed via [rustup](https://rustup.rs/))
- **Java**: Java 8, 16, 17, 21, or 25 may be required by the selected Minecraft version.

### Installation
```bash
# Clone the repository
git clone https://github.com/ktesla39/TheBoyz.git
cd TheBoyz

# Install frontend dependencies
npm install
```

### Running in Development Mode
```bash
# Run Vite web development server
npm run dev

# Run full native Tauri desktop application
npm run tauri -- dev
```

### Building for Production
```bash
# Build production web bundle
npm run build

# Build standalone native installer / executable
npm run tauri -- build
```

### Website
The matching React/TypeScript website lives in `website/` and shares the public launcher logo. The GitHub Pages workflow builds and deploys it from the `main` branch; enable GitHub Pages with **GitHub Actions** as the build source in repository Settings → Pages.

```bash
cd website
npm ci
npm run dev
npm run build
```

Set `VITE_GITHUB_REPOSITORY=ktesla39/TheBoyz` in the root `.env` to enable the website's download button. It checks published GitHub releases (including prereleases), finds the newest Windows `.exe` installer, and links directly to that asset instead of opening the GitHub release page.

### Signed automatic updates and GitHub Releases
The launcher checks the latest GitHub Release in the desktop app and offers the update before installing it. Releases are built for Windows by `.github/workflows/release.yml`; push a version tag such as `v1.0.1` to publish a signed NSIS installer and the updater's `latest.json`.

Create a Tauri updater signing key locally. Keep the private key and password secret:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.tauri"
npm run tauri -- signer generate --write-keys "$env:USERPROFILE\.tauri\the-boys-updater.key"
```

Add the generated **public** key to repository Settings → Secrets and variables → Actions → Variables as `TAURI_UPDATER_PUBLIC_KEY`. Add the private-key file contents and the password chosen during generation as Actions secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Never commit the private key or put it in `.env`, frontend variables, or website code. The release workflow validates these values and writes the tagged version and signed updater endpoint into the build configuration before packaging.

The website's download lookup uses the public `VITE_GITHUB_REPOSITORY` variable and GitHub's public releases API. Local updater checks remain disabled until a signed release configuration is prepared. The root `.env.example` contains only public/local-development settings and does not contain signing credentials.

---

## 📜 License
Built with passion by **The Boys Development Team**.
Licensed under the [MIT License](LICENSE).
