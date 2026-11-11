import React, { useState } from 'react';
import {
  Upload,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { MinecraftInstance, InstalledMod } from '../../types/instance';
import { EnderEyeIcon, DiamondSwordIcon } from '../icons/MinecraftIcons';
import { open } from '@tauri-apps/plugin-dialog';
import {
  invokeDeleteModFile,
  invokeImportLocalAddonFiles,
  invokeToggleModFile,
  isTauriEnvironment,
} from '../../services/tauriBridge';

interface InstanceModsViewProps {
  activeInstance: MinecraftInstance | null;
  onUpdateMods: (instanceId: string, mods: InstalledMod[]) => void;
}

export const InstanceModsView: React.FC<InstanceModsViewProps> = ({
  activeInstance,
  onUpdateMods,
}) => {
  const [search, setSearch] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!activeInstance) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs">
        Please select an active instance to manage its installed mods.
      </div>
    );
  }

  const mods = activeInstance.mods;

  const handleToggleMod = async (modId: string) => {
    const mod = mods.find((item) => item.id === modId);
    if (!mod) return;
    const enabled = !mod.enabled;
    try {
      const actualEnabled = !mod.filename.toLowerCase().endsWith('.disabled');
      const filename = isTauriEnvironment() && actualEnabled !== enabled
        ? await invokeToggleModFile(
            activeInstance.id,
            mod.filename,
            enabled,
            activeInstance.customGameDir,
          )
        : mod.filename;
      onUpdateMods(
        activeInstance.id,
        mods.map((item) => item.id === modId ? { ...item, enabled, filename } : item),
      );
    } catch (reason) {
      setImportError(`Could not toggle mod: ${reason instanceof Error ? reason.message : String(reason)}`);
    }
  };

  const handleDeleteMod = async (modId: string) => {
    const mod = mods.find((item) => item.id === modId);
    if (!mod) return;
    try {
      if (isTauriEnvironment()) {
        await invokeDeleteModFile(activeInstance.id, mod.filename, activeInstance.customGameDir);
      }
      onUpdateMods(activeInstance.id, mods.filter((item) => item.id !== modId));
    } catch (reason) {
      setImportError(`Could not delete mod: ${reason instanceof Error ? reason.message : String(reason)}`);
    }
  };

  const handleToggleAll = async (enabledState: boolean) => {
    try {
      const updated: InstalledMod[] = [];
      for (const mod of mods) {
        const actualEnabled = !mod.filename.toLowerCase().endsWith('.disabled');
        const filename = isTauriEnvironment() && actualEnabled !== enabledState
          ? await invokeToggleModFile(
              activeInstance.id,
              mod.filename,
              enabledState,
              activeInstance.customGameDir,
            )
          : mod.filename;
        updated.push({ ...mod, enabled: enabledState, filename });
        onUpdateMods(activeInstance.id, [...updated, ...mods.slice(updated.length)]);
      }
      onUpdateMods(activeInstance.id, updated);
    } catch (reason) {
      setImportError(`Could not update mods: ${reason instanceof Error ? reason.message : String(reason)}`);
    }
  };

  const handleFileImport = async () => {
    setImportError(null);
    try {
      const selected = await open({
        multiple: true,
        title: 'Select mod JAR files',
        filters: [{ name: 'Minecraft mods', extensions: ['jar'] }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      const imported = await invokeImportLocalAddonFiles(
        activeInstance.id,
        activeInstance.customGameDir,
        paths,
      );
      const newMods: InstalledMod[] = imported.map((file, index) => ({
        id: `local_${Date.now()}_${index}`,
        name: file.name,
        filename: file.file_name,
        version: 'Local file',
        enabled: true,
        author: 'Local File',
        description: 'Manually imported mod JAR file',
        sizeBytes: file.size_bytes,
        source: 'local',
      }));
      if (newMods.length > 0) {
        onUpdateMods(activeInstance.id, [...mods, ...newMods]);
      }
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  // Dependency warning
  const hasFabricMods = mods.some((m) => m.enabled);
  const hasFabricApi = mods.some((m) => m.name.toLowerCase().includes('fabric api') && m.enabled);
  const missingFabricApiWarning = activeInstance.loader === 'fabric' && hasFabricMods && !hasFabricApi;

  const filteredMods = mods.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <EnderEyeIcon className="w-5 h-5" />
            Installed Mods — {activeInstance.name}
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Location: <code>{activeInstance.customGameDir || `.minecraft/instances/${activeInstance.id}`}/mods</code>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleFileImport()}
            className="btn-tactile-dark flex items-center gap-2 px-3 py-2 text-slate-200 text-xs font-bold rounded-lg cursor-pointer font-display"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import .JAR</span>
          </button>

          <button
            onClick={() => handleToggleAll(true)}
            className="btn-tactile-dark px-3 py-2 text-slate-300 text-xs font-bold rounded-lg cursor-pointer font-display"
          >
            Enable All
          </button>
          <button
            onClick={() => handleToggleAll(false)}
            className="btn-tactile-dark px-3 py-2 text-slate-300 text-xs font-bold rounded-lg cursor-pointer font-display"
          >
            Disable All
          </button>
        </div>
      </div>

      {importError && (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {importError}
        </div>
      )}

      {/* Dependency Warning */}
      {missingFabricApiWarning && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300 space-y-1">
            <h4 className="font-bold font-display">Missing Core Dependency: Fabric API</h4>
            <p className="font-normal">
              Your instance is running Fabric with active mods, but <strong>Fabric API</strong> was not detected. Most Fabric mods require Fabric API to launch without crashing.
            </p>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search active mods..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#0e131f] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {mods.filter((m) => m.enabled).length} of {mods.length} mods enabled
        </div>
      </div>

      {/* Mods List Table */}
      <div className="card-obsidian rounded-xl overflow-hidden">
        {filteredMods.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-2 font-mono">
            <p>No mods currently installed in this instance.</p>
            <p className="text-[11px] text-slate-500">
              Browse Modrinth or import your own .jar files to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0a0d14] text-slate-400 border-b border-white/5 uppercase tracking-wider text-[10px] font-bold font-display">
                <tr>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">Mod Name</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMods.map((mod) => (
                  <tr
                    key={mod.id}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      !mod.enabled ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleMod(mod.id)}
                        className="cursor-pointer transition-transform hover:scale-110"
                      >
                        {mod.enabled ? (
                          <ToggleRight className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-600" />
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4 font-bold text-white font-display">
                      <div className="flex items-center gap-2">
                        {mod.iconUrl ? (
                          <img
                            src={mod.iconUrl}
                            alt={mod.name}
                            className="w-5 h-5 rounded object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <DiamondSwordIcon className="w-4 h-4" />
                        )}
                        <span>{mod.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {mod.filename}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300 font-semibold">
                      {mod.version}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-black/40 border border-white/5 text-slate-400">
                        {mod.source}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteMod(mod.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        title="Delete mod"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
