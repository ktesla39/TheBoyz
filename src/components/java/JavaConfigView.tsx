import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { MinecraftInstance, JavaConfig } from '../../types/instance';
import { RamChipIcon } from '../icons/MinecraftIcons';
import { TauriJavaInstallation } from '../../services/tauriBridge';

interface JavaConfigViewProps {
  activeInstance: MinecraftInstance | null;
  onUpdateJavaConfig: (instanceId: string, config: JavaConfig) => void;
  javaInstallations: TauriJavaInstallation[];
  desktopAvailable: boolean;
  runtimeError: string | null;
  onRefreshRuntime: () => void;
}

export const JavaConfigView: React.FC<JavaConfigViewProps> = ({
  activeInstance,
  onUpdateJavaConfig,
  javaInstallations,
  desktopAvailable,
  runtimeError,
  onRefreshRuntime,
}) => {
  const [javaPath, setJavaPath] = useState(activeInstance?.javaConfig.path ?? '');
  const [javaVersion, setJavaVersion] = useState(activeInstance?.javaConfig.version ?? 17);
  const [minRam, setMinRam] = useState(activeInstance?.javaConfig.minMemoryMb ?? 2048);
  const [maxRam, setMaxRam] = useState(activeInstance?.javaConfig.maxMemoryMb ?? 4096);
  const [gc, setGc] = useState<JavaConfig['garbageCollector']>(activeInstance?.javaConfig.garbageCollector ?? 'G1GC');
  const [customArgs, setCustomArgs] = useState(activeInstance?.javaConfig.jvmArguments.join(' ') ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!activeInstance) return;
    setJavaPath(activeInstance.javaConfig.path);
    setJavaVersion(activeInstance.javaConfig.version);
    setMinRam(activeInstance.javaConfig.minMemoryMb);
    setMaxRam(activeInstance.javaConfig.maxMemoryMb);
    setGc(activeInstance.javaConfig.garbageCollector);
    setCustomArgs(activeInstance.javaConfig.jvmArguments.join(' '));
  }, [activeInstance?.id]);

  if (!activeInstance) {
    return (
      <div className="p-12 text-center text-slate-400">
        Please select an instance to configure its Java runtime and JVM arguments.
      </div>
    );
  }

  const handleApplyPreset = (preset: 'balanced' | 'performance' | 'lightweight' | 'potato') => {
    if (preset === 'balanced') {
      setGc('G1GC');
      setMinRam(2048);
      setMaxRam(6144);
      setCustomArgs('-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch');
    } else if (preset === 'performance') {
      setGc('ZGC');
      setMinRam(4096);
      setMaxRam(8192);
      setCustomArgs('-XX:+UseZGC -XX:+ZGenerational -XX:+AlwaysPreTouch -XX:+UnlockExperimentalVMOptions');
    } else if (preset === 'potato') {
      setGc('G1GC');
      setMinRam(768);
      setMaxRam(2048);
      setCustomArgs('-XX:+UseG1GC -XX:G1ReservePercent=15 -XX:MaxGCPauseMillis=40 -XX:+ExplicitGCInvokesConcurrent -Dsun.java2d.opengl=false');
    } else {
      setGc('G1GC');
      setMinRam(1024);
      setMaxRam(3072);
      setCustomArgs('-XX:+UseG1GC');
    }
  };

  const handleSave = () => {
    const argsArray = customArgs.trim().split(/\s+/).filter(Boolean);
    const updated: JavaConfig = {
      ...activeInstance.javaConfig,
      path: javaPath.trim(),
      version: javaVersion,
      minMemoryMb: minRam,
      maxMemoryMb: maxRam,
      garbageCollector: gc,
      jvmArguments: argsArray,
    };
    onUpdateJavaConfig(activeInstance.id, updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <RamChipIcon className="w-5 h-5 text-emerald-400" />
            Java Runtime & JVM Parameters
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Fine-tune memory heap allocation and garbage collection for <strong className="text-white">{activeInstance.name}</strong>.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="btn-mc btn-mc-green flex items-center gap-2 px-5 py-2 text-white font-black text-xs rounded cursor-pointer font-display"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          <span>{saved ? 'Saved!' : 'Save JVM Settings'}</span>
        </button>
      </div>

      <section className="card-obsidian p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white font-display">Java executable</h3>
            <p className="text-xs text-slate-400 mt-1">Select a detected runtime or enter its executable path. The launcher will use this path for the active instance.</p>
          </div>
          <button
            type="button"
            onClick={onRefreshRuntime}
            disabled={!desktopAvailable}
            className="btn-mc btn-mc-green px-3 py-2 rounded text-xs font-bold text-white flex items-center gap-2 disabled:opacity-50 font-display"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Detect Java
          </button>
        </div>

        {!desktopAvailable && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-amber-100">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            Java auto-detection requires the desktop launcher.
          </div>
        )}
        {runtimeError && (
          <div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.06] p-3 text-xs text-red-200">
            {runtimeError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Detected installations</span>
            <select
              value={javaInstallations.some((installation) => installation.path === javaPath) ? javaPath : ''}
              onChange={(event) => {
                const installation = javaInstallations.find((item) => item.path === event.target.value);
                if (!installation) return;
                setJavaPath(installation.path);
                setJavaVersion(installation.major_version);
              }}
              className="w-full rounded-lg bg-black/40 border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Choose a detected Java runtime</option>
              {javaInstallations.map((installation) => (
                <option key={installation.path} value={installation.path}>
                  Java {installation.major_version} · {installation.vendor ?? 'Unknown vendor'} · {installation.path}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Executable path</span>
            <input
              value={javaPath}
              onChange={(event) => setJavaPath(event.target.value)}
              placeholder={desktopAvailable ? 'Path to java.exe / javaw.exe' : 'Set this in the desktop app'}
              className="w-full rounded-lg bg-black/40 border border-white/10 p-3 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </label>
        </div>
        <p className="text-[10px] text-slate-500 font-mono">
          Selected Java version: {javaVersion || 'not detected'}. Save JVM settings to apply the executable and version to this instance.
        </p>
      </section>

      {/* Preset Quick Actions */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-display">
          JVM Tuning Presets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={() => handleApplyPreset('potato')}
            className="card-obsidian p-4 rounded-xl text-left transition-all cursor-pointer group border-amber-500/30"
          >
            <div className="flex items-center gap-2 text-xs font-black text-white font-display">
              <Zap className="w-4 h-4 text-amber-400" />
              Potato PC (Older Hardware)
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-normal">
              Capped at 2GB RAM. Tailored for dual-core CPUs, low-spec systems, and older laptops.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('balanced')}
            className="card-obsidian p-4 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-xs font-black text-white font-display">
              <Zap className="w-4 h-4 text-emerald-400" />
              Balanced (Aikar&apos;s Flags)
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-normal">
              Proven stability with G1GC. Recommended for vanilla, Fabric, and standard modpacks.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('performance')}
            className="card-obsidian p-4 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-xs font-black text-white font-display">
              <Zap className="w-4 h-4 text-cyan-400" />
              Ultra Low-Latency (ZGC)
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-normal">
              Generational ZGC for high-memory systems (Java 21+). Eliminates pause micro-stutters.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('lightweight')}
            className="card-obsidian p-4 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-xs font-black text-white font-display">
              <Zap className="w-4 h-4 text-purple-400" />
              Lightweight (Low RAM)
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-normal">
              Capped at 3GB. Optimized for laptops, lightweight mods, and legacy Minecraft versions.
            </p>
          </button>
        </div>
      </div>

      {/* Memory Allocation Sliders */}
      <div className="card-obsidian p-6 rounded-2xl space-y-6">
        <h3 className="text-sm font-black text-white font-display flex items-center gap-2">
          <RamChipIcon className="w-4 h-4 text-emerald-400" />
          Memory (RAM) Heap Allocation
        </h3>

        {/* Max RAM */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Maximum Allocated Memory (-Xmx)</span>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              {maxRam} MB ({(maxRam / 1024).toFixed(1)} GB)
            </span>
          </div>
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={maxRam}
            onChange={(e) => {
              const val = Number(e.target.value);
              setMaxRam(val);
              if (minRam > val) setMinRam(val);
            }}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>1 GB</span>
            <span>4 GB (Default)</span>
            <span>8 GB</span>
            <span>16 GB</span>
          </div>
        </div>

        {/* Min RAM */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Initial Allocated Memory (-Xms)</span>
            <span className="font-mono text-slate-400 font-bold text-sm">
              {minRam} MB ({(minRam / 1024).toFixed(1)} GB)
            </span>
          </div>
          <input
            type="range"
            min={512}
            max={8192}
            step={256}
            value={minRam}
            onChange={(e) => {
              const val = Number(e.target.value);
              setMinRam(val);
              if (val > maxRam) setMaxRam(val);
            }}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Garbage Collector Selection */}
      <div className="card-obsidian p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-black text-white font-display">
          Garbage Collector Pipeline
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'G1GC', label: 'G1GC (Default)' },
            { id: 'ZGC', label: 'ZGC (Java 21+)' },
            { id: 'Shenandoah', label: 'Shenandoah' },
            { id: 'ParallelGC', label: 'Parallel GC' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setGc(item.id as any)}
              className={`p-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                gc === item.id
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'border-white/5 bg-black/40 text-slate-400 hover:border-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom JVM Flags */}
      <div className="card-obsidian p-6 rounded-2xl space-y-3">
        <label className="block text-sm font-black text-white font-display">
          Custom JVM Arguments
        </label>
        <textarea
          rows={3}
          value={customArgs}
          onChange={(e) => setCustomArgs(e.target.value)}
          placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled..."
          className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-xs font-mono text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
        />
        <p className="text-[11px] text-slate-500 font-mono">
          Flags are passed directly to the Java runtime when launching Minecraft.
        </p>
      </div>
    </div>
  );
};
