import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { HomeView } from './components/home/HomeView';
import { InstancesView } from './components/instances/InstancesView';
import { VersionsView } from './components/versions/VersionsView';
import { AddonsView } from './components/addons/AddonsView';
import { GraphicsView } from './components/graphics/GraphicsView';
import { JavaConfigView } from './components/java/JavaConfigView';
import { DownloadsView } from './components/downloads/DownloadsView';
import { AccountsView } from './components/accounts/AccountsView';
import { SettingsView } from './components/settings/SettingsView';
import { LiveConsoleModal } from './components/console/LiveConsoleModal';
import { InstanceDetailView } from './components/instances/InstanceDetailView';
import { ServersView } from './components/servers/ServersView';

import {
  loadSavedInstances,
  saveInstances,
  loadSavedAccounts,
  saveAccounts,
  loadSavedServers,
  saveServers,
  loadActiveInstanceId,
  saveActiveInstanceId,
  loadActiveAccountId,
  saveActiveAccountId,
  loadSettings,
  saveSettings,
  hasShownFirstRunAccountChoice,
  markFirstRunAccountChoiceShown,
  LauncherSettings,
} from './services/storageService';
import {
  MinecraftInstance,
  InstalledMod,
  InstalledPack,
  ModLoaderType,
  GraphicsApiType,
  JavaConfig,
  ServerBookmark,
} from './types/instance';
import { LauncherAccount } from './types/auth';
import { DownloadTask, LogEntry } from './types/launcher';
import { getRecommendedJavaVersion } from './services/mojangApi';
import { refreshMicrosoftAccount } from './services/authService';
import {
  invokeDetectJava,
  invokeGetMicrosoftCredentials,
  invokeSaveMicrosoftCredentials,
  invokeClearMicrosoftCredentials,
  invokeGetSystemHardware,
  invokeIsGameRunning,
  invokeLaunchGame,
  invokeStopGame,
  isTauriEnvironment,
  TauriHardwareInfo,
  TauriJavaInstallation,
} from './services/tauriBridge';
import { applyLauncherTheme } from './services/themeService';
import { SkinManagerModal } from './components/accounts/SkinManagerModal';
import { AddOfflineAccountModal } from './components/accounts/AddOfflineAccountModal';
import { MicrosoftLoginModal } from './components/accounts/MicrosoftLoginModal';
import { FirstRunAccountChoiceModal } from './components/accounts/FirstRunAccountChoiceModal';
import { CreateInstanceModal } from './components/instances/CreateInstanceModal';
import { SkinProvider, SkinModel } from './types/auth';
import { UpdatePrompt } from './components/common/UpdatePrompt';

export default function App() {
  // Master Launcher Persistent State
  const [instances, setInstances] = useState<MinecraftInstance[]>(loadSavedInstances);
  const [activeInstanceId, setActiveInstanceId] = useState<string>(loadActiveInstanceId);
  const [accounts, setAccounts] = useState<LauncherAccount[]>(loadSavedAccounts);
  const [activeAccountId, setActiveAccountId] = useState<string>(loadActiveAccountId);
  const [servers, setServers] = useState<ServerBookmark[]>(loadSavedServers);
  const [inspectingInstanceId, setInspectingInstanceId] = useState<string | null>(null);
  const [settings, setSettings] = useState<LauncherSettings>(loadSettings);

  // Navigation & UI State
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isSkinManagerOpen, setIsSkinManagerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFirstRunAccountChoiceOpen, setIsFirstRunAccountChoiceOpen] = useState(
    () => !hasShownFirstRunAccountChoice()
  );
  const [isFirstRunOfflineModalOpen, setIsFirstRunOfflineModalOpen] = useState(false);
  const [isFirstRunMicrosoftModalOpen, setIsFirstRunMicrosoftModalOpen] = useState(false);

  useEffect(() => {
    if (isFirstRunAccountChoiceOpen) {
      markFirstRunAccountChoiceShown();
    }
  }, [isFirstRunAccountChoiceOpen]);

  // Apply Theme, Button Colors & Low-Spec Mode to Root
  useEffect(() => {
    applyLauncherTheme(
      settings.themePreset,
      {
        accentColor: settings.customAccentColor,
        bgColor: settings.customBgColor,
        surfaceColor: settings.customSurfaceColor,
      },
      settings.lowSpecMode,
      settings.buttonColorTheme,
      settings.customButtonColor,
      settings.theme
    );
  }, [settings]);

  // Runtime Game Engine State
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [gamePid, setGamePid] = useState<number | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [hardwareInfo, setHardwareInfo] = useState<TauriHardwareInfo | null>(null);
  const [javaInstallations, setJavaInstallations] = useState<TauriJavaInstallation[]>([]);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const refreshRuntimeInfo = useCallback(async () => {
    if (!isTauriEnvironment()) return;

    const [hardwareResult, javaResult] = await Promise.allSettled([
      invokeGetSystemHardware(),
      invokeDetectJava(),
    ]);
    const errors: string[] = [];

    if (hardwareResult.status === 'fulfilled') {
      setHardwareInfo(hardwareResult.value);
    } else {
      setHardwareInfo(null);
      errors.push(`Hardware detection: ${hardwareResult.reason instanceof Error ? hardwareResult.reason.message : String(hardwareResult.reason)}`);
    }

    if (javaResult.status === 'fulfilled') {
      setJavaInstallations(javaResult.value);
    } else {
      setJavaInstallations([]);
      errors.push(`Java detection: ${javaResult.reason instanceof Error ? javaResult.reason.message : String(javaResult.reason)}`);
    }

    setRuntimeError(errors.length ? errors.join(' ') : null);
  }, []);

  useEffect(() => {
    void refreshRuntimeInfo();
  }, [refreshRuntimeInfo]);

  // Centralized Download Tasks
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  // Sync state changes to local storage
  useEffect(() => {
    saveInstances(instances);
  }, [instances]);

  useEffect(() => {
    saveAccounts(accounts);
  }, [accounts]);

  useEffect(() => {
    if (!isTauriEnvironment()) return;
    let active = true;
    const hydrateCredentials = async () => {
      for (const account of accounts) {
        if (account.type !== 'microsoft') continue;
        try {
          if (account.accessToken) {
            await invokeSaveMicrosoftCredentials(account.id, {
              access_token: account.accessToken,
              refresh_token: account.refreshToken,
              expires_at: account.expiresAt,
            });
            if (active) setAccounts((current) => current.map((item) => item.id === account.id && item.type === 'microsoft'
              ? { ...item, accessToken: undefined, refreshToken: undefined }
              : item));
            continue;
          }
          const credentials = await invokeGetMicrosoftCredentials(account.id);
          if (credentials && active) {
            setAccounts((current) => current.map((item) => item.id === account.id && item.type === 'microsoft'
              ? { ...item, accessToken: credentials.access_token, refreshToken: credentials.refresh_token ?? undefined, expiresAt: credentials.expires_at }
              : item));
          }
        } catch (reason) {
          console.error('Could not migrate or load Microsoft credentials from the OS credential store.', reason);
        }
      }
    };
    void hydrateCredentials();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    saveServers(servers);
  }, [servers]);

  useEffect(() => {
    saveActiveInstanceId(activeInstanceId);
  }, [activeInstanceId]);

  useEffect(() => {
    saveActiveAccountId(activeAccountId);
  }, [activeAccountId]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Derived active items
  const activeInstance = useMemo(
    () => instances.find((i) => i.id === activeInstanceId) ?? null,
    [instances, activeInstanceId]
  );

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const inspectingInstance = useMemo(
    () => (inspectingInstanceId ? instances.find((i) => i.id === inspectingInstanceId) || null : null),
    [instances, inspectingInstanceId]
  );

  // Tab Titles Map
  const tabTitles: Record<NavTab, string> = {
    home: 'Home Overview',
    instances: inspectingInstance ? `Manage: ${inspectingInstance.name}` : 'Instance Management',
    addons: 'Addons',
    servers: 'Multiplayer Server Monitor',
    versions: 'Minecraft Versions Catalog',
    graphics: 'Graphics API & Hardware',
    java: 'Java & JVM Configuration',
    downloads: 'Download Manager',
    accounts: 'Account Profiles',
    settings: 'Preferences & Settings',
  };

  // Launch Engine Handler
  const handleLaunchGame = async (serverAddress?: string, instanceId?: string) => {
    const launchInstance = instanceId
      ? instances.find((instance) => instance.id === instanceId)
      : activeInstance;
    if (isLaunching || isGameRunning) return;

    const appendLog = (level: LogEntry['level'], message: string) => {
      const now = new Date();
      setLogs((prev) => [...prev, {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`,
        level,
        source: level === 'ERROR' ? 'SYSTEM' : 'LAUNCHER',
        message,
      }]);
    };

    setIsConsoleOpen(true);
    if (!launchInstance || !activeAccount) {
      appendLog('ERROR', 'Select a Minecraft instance and player account before launching.');
      return;
    }
    if (!isTauriEnvironment()) {
      appendLog('ERROR', 'Game launch is available only in the installed desktop launcher.');
      return;
    }
    let instanceToLaunch = launchInstance;
    if (!instanceToLaunch.javaConfig.path.trim()) {
      try {
        const detected = javaInstallations.length > 0 ? javaInstallations : await invokeDetectJava();
        if (javaInstallations.length === 0) setJavaInstallations(detected);
        const requiredJava = getRecommendedJavaVersion(instanceToLaunch.gameVersion);
        const compatible = requiredJava === null
          ? detected[0]
          : detected.find((java) => java.major_version === requiredJava)
            ?? detected.filter((java) => java.major_version > requiredJava).sort((a, b) => a.major_version - b.major_version)[0];
        if (!compatible) {
          const requirement = requiredJava === null ? 'a compatible Java runtime' : `Java ${requiredJava} or newer`;
          appendLog('ERROR', `No compatible Java runtime was found. Install ${requirement} and try again. Your instance files were not changed.`);
          return;
        }
        instanceToLaunch = { ...instanceToLaunch, javaConfig: { ...instanceToLaunch.javaConfig, path: compatible.path, version: compatible.major_version } };
        setInstances((current) => current.map((item) => item.id === instanceToLaunch.id ? instanceToLaunch : item));
        appendLog('INFO', `Using Java ${compatible.major_version} automatically for this Minecraft instance.`);
      } catch (reason) {
        appendLog('ERROR', `Could not detect Java. Install a compatible runtime and try again. ${reason instanceof Error ? reason.message : String(reason)}`);
        return;
      }
    }
    let launchAccount = activeAccount;
    if (launchAccount.type === 'microsoft') {
      try {
        const credentials = await invokeGetMicrosoftCredentials(launchAccount.id);
        if (!credentials) throw new Error('Microsoft sign-in credentials are missing. Sign in again.');
        if (credentials.expires_at <= Date.now() + 60_000) {
          if (!credentials.refresh_token) throw new Error('Microsoft sign-in has expired. Sign in again to continue.');
          launchAccount = await refreshMicrosoftAccount(launchAccount, credentials.refresh_token);
          await invokeSaveMicrosoftCredentials(launchAccount.id, {
            access_token: launchAccount.accessToken ?? '',
            refresh_token: launchAccount.refreshToken,
            expires_at: launchAccount.expiresAt,
          });
          appendLog('INFO', 'Microsoft sign-in was refreshed securely.');
        } else {
          launchAccount = {
            ...launchAccount,
            accessToken: credentials.access_token,
            refreshToken: credentials.refresh_token ?? undefined,
            expiresAt: credentials.expires_at,
          };
        }
        setAccounts((current) => current.map((item) => item.id === launchAccount.id ? launchAccount : item));
      } catch (reason) {
        appendLog('ERROR', reason instanceof Error ? reason.message : String(reason));
        return;
      }
    }

    const launchLog: LogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toTimeString().split(' ')[0],
      level: 'INFO',
      source: 'LAUNCHER',
      message: serverAddress
        ? `Installing/verifying ${launchInstance.name} (Minecraft ${launchInstance.gameVersion}), then connecting to ${serverAddress}.`
        : `Installing/verifying ${launchInstance.name} (Minecraft ${launchInstance.gameVersion}).`,
    };
    setLogs((prev) => [...prev, launchLog]);
    setIsLaunching(true);
    try {
      appendLog('INFO', 'Verifying or installing Minecraft files before launch.');
      const result = await invokeLaunchGame(
        instanceToLaunch,
        launchAccount,
        serverAddress,
        settings.lowSpecMode || hardwareInfo?.is_low_spec === true
      );
      if (!result.success || result.pid === null) {
        throw new Error(result.message || 'The launcher did not return a game process ID.');
      }
      setGamePid(result.pid);
      setIsGameRunning(true);
      appendLog('INFO', `${result.message} Java process ID: ${result.pid}.`);
    } catch (reason) {
      appendLog('ERROR', reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStopGame = async () => {
    if (gamePid === null) return;
    try {
      const stopped = await invokeStopGame(gamePid);
      setIsGameRunning(false);
      setGamePid(null);
      setLogs((prev) => [...prev, {
        id: `log_${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        level: stopped ? 'INFO' : 'WARN',
        source: 'SYSTEM',
        message: stopped ? `Stopped Java process ${gamePid}.` : `Java process ${gamePid} was no longer running.`,
      }]);
    } catch (reason) {
      setLogs((prev) => [...prev, {
        id: `log_${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        level: 'ERROR',
        source: 'SYSTEM',
        message: reason instanceof Error ? reason.message : String(reason),
      }]);
    }
  };

  useEffect(() => {
    if (gamePid === null) return;

    let active = true;
    let failureLogged = false;
    const checkProcess = async () => {
      try {
        const running = await invokeIsGameRunning(gamePid);
        if (!active || running) return;
        setIsGameRunning(false);
        setGamePid(null);
        setLogs((prev) => [...prev, {
          id: `log_${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          level: 'INFO',
          source: 'SYSTEM',
          message: `Java process ${gamePid} exited.`,
        }]);
      } catch (reason) {
        if (!active || failureLogged) return;
        failureLogged = true;
        setLogs((prev) => [...prev, {
          id: `log_${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          level: 'ERROR',
          source: 'SYSTEM',
          message: `Could not check Java process ${gamePid}: ${reason instanceof Error ? reason.message : String(reason)}`,
        }]);
      }
    };
    const intervalId = window.setInterval(() => void checkProcess(), 4000);
    void checkProcess();
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [gamePid]);

  // Instance Actions
  const handleAddInstance = (newInst: MinecraftInstance) => {
    setInstances((prev) => [newInst, ...prev]);
    setActiveInstanceId(newInst.id);
  };

  const handleDeleteInstance = (id: string) => {
    if (instances.length <= 1) return;
    const remaining = instances.filter((i) => i.id !== id);
    setInstances(remaining);
    if (activeInstanceId === id) {
      setActiveInstanceId(remaining[0].id);
    }
  };

  const handleCloneInstance = (id: string) => {
    const target = instances.find((i) => i.id === id);
    if (!target) return;

    const cloned: MinecraftInstance = {
      ...target,
      id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: `${target.name} (Copy)`,
      createdAt: Date.now(),
      totalPlayTimeMinutes: 0,
      mods: [...target.mods],
      packs: [...target.packs],
      worlds: target.worlds ? [...target.worlds] : [],
      screenshots: target.screenshots ? [...target.screenshots] : [],
      backups: target.backups ? [...target.backups] : [],
    };
    setInstances((prev) => [cloned, ...prev]);
    setActiveInstanceId(cloned.id);
  };

  const handleUpdateInstance = (updated: MinecraftInstance) => {
    setInstances((prev) =>
      prev.map((inst) => (inst.id === updated.id ? updated : inst))
    );
  };

  const handleUpdateMods = (instanceId: string, updatedMods: InstalledMod[]) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === instanceId ? { ...inst, mods: updatedMods } : inst
      )
    );
  };

  const handleInstallMod = (mod: InstalledMod) => {
    if (!activeInstance) return;
    const updated = [...activeInstance.mods, mod];
    handleUpdateMods(activeInstance.id, updated);
  };

  const handleUpdateGraphicsApi = (instanceId: string, api: GraphicsApiType) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === instanceId ? { ...inst, graphicsApi: api } : inst
      )
    );
  };

  const handleUpdateJavaConfig = (instanceId: string, config: JavaConfig) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === instanceId ? { ...inst, javaConfig: config } : inst
      )
    );
  };

  // Account Actions
  const handleAddAccount = (acc: LauncherAccount) => {
    const add = async () => {
      if (acc.type === 'microsoft' && isTauriEnvironment() && acc.accessToken) {
        try {
          await invokeSaveMicrosoftCredentials(acc.id, {
            access_token: acc.accessToken,
            refresh_token: acc.refreshToken,
            expires_at: acc.expiresAt,
          });
          acc = { ...acc, accessToken: undefined, refreshToken: undefined };
        } catch (reason) {
          window.alert(`Could not safely save Microsoft credentials. The account was not added. ${reason instanceof Error ? reason.message : String(reason)}`);
          return;
        }
      }
      setAccounts((prev) => [acc, ...prev]);
      setActiveAccountId(acc.id);
    };
    void add();
  };

  const handleDeleteAccount = (id: string) => {
    if (accounts.length <= 1) return;
    const accountToDelete = accounts.find((account) => account.id === id);
    if (accountToDelete?.type === 'microsoft' && isTauriEnvironment()) {
      void invokeClearMicrosoftCredentials(accountToDelete.id).catch((reason) => {
        console.error('Could not remove Microsoft credentials from Windows Credential Manager.', reason);
      });
    }
    const remaining = accounts.filter((a) => a.id !== id);
    setAccounts(remaining);
    if (activeAccountId === id) {
      setActiveAccountId(remaining[0].id);
    }
  };

  const handleUpdateAccount = (updated: LauncherAccount) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === updated.id ? updated : acc))
    );
  };

  // Quick Action: Install from Version Catalog
  const handleCreateInstanceWithVersion = (version: string) => {
    const recommendedJava = getRecommendedJavaVersion(version);
    if (recommendedJava === null) {
      window.alert(`The required Java version for Minecraft ${version} is not available in the launcher's compatibility data. Check Mojang's version requirements before creating this instance.`);
      return;
    }
    const newInst: MinecraftInstance = {
      id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: `Minecraft ${version}`,
      icon: 'crafting_table',
      gameVersion: version,
      loader: 'vanilla',
      graphicsApi: 'opengl',
      javaConfig: {
        path: '',
        version: recommendedJava,
        minMemoryMb: 2048,
        maxMemoryMb: 4096,
        jvmArguments: ['-XX:+UseG1GC'],
        garbageCollector: 'G1GC',
      },
      resolution: {
        width: 1920,
        height: 1080,
        fullscreen: false,
      },
      mods: [],
      packs: [],
      worlds: [],
      screenshots: [],
      backups: [],
      createdAt: Date.now(),
      totalPlayTimeMinutes: 0,
    };
    handleAddInstance(newInst);
    setCurrentTab('home');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--mc-bg)] text-slate-100">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeDownloadsCount={tasks.filter((t) => t.status === 'downloading').length}
        onOpenConsole={() => setIsConsoleOpen(true)}
        isGameRunning={isGameRunning}
        activeAccount={activeAccount}
        onOpenSkinManager={() => setIsSkinManagerOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        launcherIcon={settings.launcherIcon}
      />

      {/* Main App Layout */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Bar with Instant Play Instance Dropdown & Custom Skin Head */}
        <TopHeader
          currentTabTitle={tabTitles[currentTab]}
          activeInstance={activeInstance}
          activeAccount={activeAccount}
          instances={instances}
          isGameRunning={isGameRunning}
          isLaunching={isLaunching}
          desktopAvailable={isTauriEnvironment()}
          onLaunchGame={(instanceId) => handleLaunchGame(undefined, instanceId)}
          onStopGame={handleStopGame}
          onSelectInstance={setActiveInstanceId}
          onManageInstance={(instId) => {
            setActiveInstanceId(instId);
            setInspectingInstanceId(instId);
            setCurrentTab('instances');
          }}
          onSwitchAccount={() => setCurrentTab('accounts')}
          onOpenCreateInstance={() => setIsCreateModalOpen(true)}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto bg-[var(--mc-bg)]">
          {currentTab === 'home' && (
            <HomeView
              activeInstance={activeInstance}
              activeAccount={activeAccount}
              instances={instances}
              isGameRunning={isGameRunning}
              isLaunching={isLaunching}
              desktopAvailable={isTauriEnvironment()}
              hardwareInfo={hardwareInfo}
              javaInstallations={javaInstallations}
              runtimeError={runtimeError}
              onRefreshRuntime={() => void refreshRuntimeInfo()}
              onLaunchGame={handleLaunchGame}
              onStopGame={handleStopGame}
              onSelectInstance={setActiveInstanceId}
              onNavigateTab={setCurrentTab}
              onOpenConsole={() => setIsConsoleOpen(true)}
              onOpenSkinManager={() => setIsSkinManagerOpen(true)}
            />
          )}

          {currentTab === 'instances' && inspectingInstance ? (
            <InstanceDetailView
              instance={inspectingInstance}
              onBack={() => setInspectingInstanceId(null)}
              onLaunch={() => {
                setActiveInstanceId(inspectingInstance.id);
                void handleLaunchGame(undefined, inspectingInstance.id);
              }}
              onUpdateInstance={handleUpdateInstance}
              onCloneInstance={() => handleCloneInstance(inspectingInstance.id)}
              onDeleteInstance={() => {
                handleDeleteInstance(inspectingInstance.id);
                setInspectingInstanceId(null);
              }}
            />
          ) : currentTab === 'instances' ? (
            <InstancesView
              instances={instances}
              activeInstanceId={activeInstanceId}
              onSelectActiveInstance={setActiveInstanceId}
              onAddInstance={handleAddInstance}
              onDeleteInstance={handleDeleteInstance}
              onCloneInstance={handleCloneInstance}
              onLaunchInstance={(id) => {
                setActiveInstanceId(id);
                void handleLaunchGame(undefined, id);
              }}
              onManageMods={(inst) => {
                setActiveInstanceId(inst.id);
                setCurrentTab('addons');
              }}
              onOpenDetail={(inst) => {
                setActiveInstanceId(inst.id);
                setInspectingInstanceId(inst.id);
              }}
            />
          ) : null}

          {currentTab === 'addons' && (
            <AddonsView
              activeInstance={activeInstance}
              instances={instances}
              onUpdateInstance={handleUpdateInstance}
              onAddTask={(task) => setTasks((prev) => [task, ...prev])}
              onOpenCreateInstance={() => setIsCreateModalOpen(true)}
            />
          )}

          {currentTab === 'servers' && (
            <ServersView
              servers={servers}
              activeInstance={activeInstance}
              instances={instances}
              onSelectInstance={setActiveInstanceId}
              onManageInstance={(instId) => {
                setActiveInstanceId(instId);
                setInspectingInstanceId(instId);
                setCurrentTab('instances');
              }}
              onAddServer={(server) => setServers((prev) => [server, ...prev])}
              onUpdateServer={(updatedServer) =>
                setServers((prev) => prev.map((server) => server.id === updatedServer.id ? updatedServer : server))
              }
              onDeleteServer={(id) => setServers((prev) => prev.filter((s) => s.id !== id))}
              onLaunchWithServer={(serverAddress, instanceId) => {
                if (instanceId) {
                  setActiveInstanceId(instanceId);
                }
                void handleLaunchGame(serverAddress, instanceId);
              }}
            />
          )}

          {currentTab === 'versions' && (
            <VersionsView
              onCreateInstanceWithVersion={handleCreateInstanceWithVersion}
            />
          )}

          {currentTab === 'graphics' && (
            <GraphicsView
              activeInstance={activeInstance}
              onUpdateGraphicsApi={handleUpdateGraphicsApi}
            />
          )}

          {currentTab === 'java' && (
            <JavaConfigView
              activeInstance={activeInstance}
              onUpdateJavaConfig={handleUpdateJavaConfig}
              javaInstallations={javaInstallations}
              desktopAvailable={isTauriEnvironment()}
              runtimeError={runtimeError}
              onRefreshRuntime={() => void refreshRuntimeInfo()}
            />
          )}

          {currentTab === 'downloads' && (
            <DownloadsView
              tasks={tasks}
              onClearCompleted={() =>
                setTasks((prev) => prev.filter((t) => t.status !== 'completed'))
              }
            />
          )}

          {currentTab === 'accounts' && (
            <AccountsView
              accounts={accounts}
              activeAccountId={activeAccountId}
              onSelectActiveAccount={setActiveAccountId}
              onAddAccount={handleAddAccount}
              onDeleteAccount={handleDeleteAccount}
              onUpdateAccount={handleUpdateAccount}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={setSettings}
            />
          )}
        </main>
      </div>

      {/* Live Console & Crash Diagnostic Modal */}
      <LiveConsoleModal
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        logs={logs}
        isGameRunning={isGameRunning}
        onStopGame={handleStopGame}
        onClearLogs={() => setLogs([])}
      />

      {/* Global Player Skin & Cape Studio Modal */}
      {activeAccount && (
        <SkinManagerModal
          isOpen={isSkinManagerOpen}
          onClose={() => setIsSkinManagerOpen(false)}
          account={activeAccount}
          onUpdateAccountSkin={(updated) => {
            const updatedAcc: LauncherAccount = {
              ...activeAccount,
              skinUrl: updated.skinUrl,
              skinProvider: updated.skinProvider,
              model: updated.model,
              capeUrl: updated.capeUrl,
              capeName: updated.capeName,
            };
            handleUpdateAccount(updatedAcc);
          }}
        />
      )}

      {/* Create Instance Modal */}
      <CreateInstanceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onInstanceCreated={(newInstance) => {
          handleAddInstance(newInstance);
          setIsCreateModalOpen(false);
        }}
      />

      {isFirstRunAccountChoiceOpen && (
        <FirstRunAccountChoiceModal
          onChooseOffline={() => {
            setIsFirstRunAccountChoiceOpen(false);
            setIsFirstRunOfflineModalOpen(true);
          }}
          onChooseMicrosoft={() => {
            setIsFirstRunAccountChoiceOpen(false);
            setIsFirstRunMicrosoftModalOpen(true);
          }}
        />
      )}
      <AddOfflineAccountModal
        isOpen={isFirstRunOfflineModalOpen}
        onClose={() => setIsFirstRunOfflineModalOpen(false)}
        onAccountCreated={handleAddAccount}
      />
      <MicrosoftLoginModal
        isOpen={isFirstRunMicrosoftModalOpen}
        onClose={() => setIsFirstRunMicrosoftModalOpen(false)}
        onAccountAdded={handleAddAccount}
      />
      <UpdatePrompt />
    </div>
  );
}
