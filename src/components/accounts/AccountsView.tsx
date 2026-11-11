import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Layers,
  Palette,
  Upload,
} from 'lucide-react';
import { LauncherAccount, SkinProvider, SkinModel } from '../../types/auth';
import { AddOfflineAccountModal } from './AddOfflineAccountModal';
import { MicrosoftLoginModal } from './MicrosoftLoginModal';
import { SkinManagerModal } from './SkinManagerModal';
import { MinecraftSkinCanvas } from '../skin/MinecraftSkinCanvas';
import {
  MicrosoftBrandIcon,
  OfflineShieldIcon,
  TheBoysEmblemIcon,
} from '../icons/MinecraftIcons';
import { playMinecraftClickSound } from '../../services/soundService';

interface AccountsViewProps {
  accounts: LauncherAccount[];
  activeAccountId: string;
  onSelectActiveAccount: (id: string) => void;
  onAddAccount: (account: LauncherAccount) => void;
  onDeleteAccount: (id: string) => void;
  onUpdateAccount?: (account: LauncherAccount) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  activeAccountId,
  onSelectActiveAccount,
  onAddAccount,
  onDeleteAccount,
  onUpdateAccount,
}) => {
  const [isAddOfflineOpen, setIsAddOfflineOpen] = useState(false);
  const [isAddMicrosoftOpen, setIsAddMicrosoftOpen] = useState(false);
  const [isSkinManagerOpen, setIsSkinManagerOpen] = useState(false);
  const [customizingAccount, setCustomizingAccount] = useState<LauncherAccount | null>(null);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  const handleOpenSkinManager = (account: LauncherAccount) => {
    playMinecraftClickSound();
    setCustomizingAccount(account);
    setIsSkinManagerOpen(true);
  };

  const handleUpdateAccountSkin = (updated: {
    skinUrl: string;
    skinProvider: SkinProvider;
    model: SkinModel;
    capeUrl?: string;
    capeName?: string;
  }) => {
    if (!customizingAccount || !onUpdateAccount) return;
    const updatedAcc: LauncherAccount = {
      ...customizingAccount,
      skinUrl: updated.skinUrl,
      skinProvider: updated.skinProvider,
      model: updated.model,
      capeUrl: updated.capeUrl,
      capeName: updated.capeName,
    };
    onUpdateAccount(updatedAcc);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8 select-none">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2.5">
            <Users className="w-5 h-5 text-emerald-400" />
            Account Profiles & Skins
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage player identities, Ely.by integrations, custom skin PNG uploads, and Microsoft accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playMinecraftClickSound();
              setIsAddOfflineOpen(true);
            }}
            className="btn-mc flex items-center gap-2 px-3.5 py-2 text-amber-300 text-xs font-bold rounded cursor-pointer"
          >
            <OfflineShieldIcon className="w-4 h-4" />
            <span className="font-display">Add Offline Profile</span>
          </button>
          <button
            onClick={() => {
              playMinecraftClickSound();
              setIsAddMicrosoftOpen(true);
            }}
            className="btn-mc btn-mc-green flex items-center gap-2 px-4 py-2 text-white text-xs font-black rounded cursor-pointer font-display"
          >
            <MicrosoftBrandIcon className="w-3.5 h-3.5" />
            <span>Sign In with Microsoft</span>
          </button>
        </div>
      </div>

      {/* Active Account Spotlight Card with Actual 3D Skin Above / Beside Profile */}
      {activeAccount && (
        <div className="card-obsidian p-6 rounded-2xl border-emerald-500/30 shadow-[0_4px_24px_-4px_rgba(16,185,129,0.12)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: Rendered Player Skin Model on Holographic Pedestal */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative p-3 rounded-2xl bg-gradient-to-b from-black/60 to-black/30 border border-white/10 flex flex-col items-center shadow-inner">
                {/* Floating Minecraft Player Nametag */}
                <div className="px-2.5 py-0.5 rounded bg-black/85 border border-white/20 text-white font-pixel text-[10px] shadow-md mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{activeAccount.username}</span>
                </div>

                <div className="drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)]">
                  <MinecraftSkinCanvas
                    skinUrl={activeAccount.skinUrl}
                    capeUrl={activeAccount.capeUrl}
                    model={activeAccount.model}
                    mode="full"
                    height={210}
                    width={140}
                    showPedestal={false}
                    interactive={true}
                  />
                </div>

                {/* Pedestal Stage Glow */}
                <div className="w-32 h-6 -mt-3 rounded-[50%] bg-gradient-to-b from-[var(--mc-glow-color)] to-transparent border-t border-[var(--mc-accent)]/50 blur-[1px] pointer-events-none" />

                <span className="text-[9px] font-mono font-bold text-slate-400 mt-1">
                  Drag to rotate 360°
                </span>
              </div>

              <div className="space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h3 className="text-xl font-black text-white font-display tracking-tight">
                    {activeAccount.username}
                  </h3>
                  {activeAccount.type === 'microsoft' ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                      <MicrosoftBrandIcon className="w-2.5 h-2.5" />
                      ONLINE AUTHENTICATED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                      <OfflineShieldIcon className="w-2.5 h-2.5" />
                      OFFLINE ({activeAccount.skinProvider ? activeAccount.skinProvider.toUpperCase() : 'ELY.BY READY'})
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 font-mono">
                  UUID: {activeAccount.uuid}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <span className="text-[10px] font-mono bg-black/50 px-2.5 py-1 rounded border border-white/10 text-slate-300">
                    Model: <strong className="text-white uppercase">{activeAccount.model}</strong>
                  </span>
                  <span className="text-[10px] font-mono bg-black/50 px-2.5 py-1 rounded border border-white/10 text-slate-300">
                    Cape: <strong className="text-emerald-400">{activeAccount.capeName || 'Equipped'}</strong>
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleOpenSkinManager(activeAccount)}
                    className="btn-mc btn-mc-green flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded cursor-pointer font-display"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Customize Skin & Cape</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Security & Network Details */}
            <div className="text-xs font-mono text-center md:text-right space-y-1 bg-black/30 p-4 rounded-xl border border-white/5">
              {activeAccount.type === 'microsoft' ? (
                <>
                  <div className="text-emerald-400 font-bold">Minecraft Java Licensed</div>
                  <div className="text-[11px] text-slate-400">Official Mojang session token active</div>
                  <div className="text-[10px] text-slate-500">Multiplayer & Realm Verified</div>
                </>
              ) : (
                <>
                  <div className="text-amber-400 font-bold">Offline & Ely.by Ready</div>
                  <div className="text-[11px] text-slate-400">Deterministic RFC 4122 v3 UUID</div>
                  <div className="text-[10px] text-slate-500">Supports custom skin PNGs & cloaks</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accounts List Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-display">
          All Saved Accounts ({accounts.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {accounts.map((account) => {
            const isActive = account.id === activeAccountId;
            return (
              <div
                key={account.id}
                onClick={() => {
                  playMinecraftClickSound();
                  onSelectActiveAccount(account.id);
                }}
                data-tone={account.type === 'microsoft' ? 'green' : 'amber'}
                className={`card-obsidian card-selectable p-4 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-4 ${isActive ? 'card-selected' : ''}`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="card-icon-tile relative shrink-0 p-1 rounded-lg">
                    <MinecraftSkinCanvas
                      skinUrl={account.skinUrl}
                      capeUrl={account.capeUrl}
                      model={account.model}
                      mode="bust"
                      height={46}
                      width={38}
                      interactive={false}
                    />
                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-950 border border-white/10">
                      {account.type === 'microsoft' ? (
                        <MicrosoftBrandIcon className="w-2.5 h-2.5" />
                      ) : (
                        <OfflineShieldIcon className="w-2.5 h-2.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-display truncate">
                        {account.username}
                      </span>
                      {account.type === 'microsoft' ? (
                        <span className="text-[9px] text-emerald-400 font-bold font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          ONLINE
                        </span>
                      ) : (
                        <span className="text-[9px] text-amber-400 font-bold font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                          OFFLINE
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">
                      {account.uuid}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSkinManager(account);
                    }}
                    className="btn-mc py-1 px-2 text-[11px] font-bold text-slate-300 hover:text-white rounded cursor-pointer"
                    title="Change skin or cape"
                  >
                    Skin
                  </button>

                  {isActive ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 font-display bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/30">
                      <Check className="w-3.5 h-3.5" />
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playMinecraftClickSound();
                        onSelectActiveAccount(account.id);
                      }}
                      className="btn-mc btn-mc-green text-xs font-bold font-display text-white px-3 py-1 rounded cursor-pointer"
                    >
                      Use
                    </button>
                  )}

                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playMinecraftClickSound();
                        onDeleteAccount(account.id);
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-white/5 transition-colors cursor-pointer"
                      title="Remove account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <AddOfflineAccountModal
        isOpen={isAddOfflineOpen}
        onClose={() => setIsAddOfflineOpen(false)}
        onAccountCreated={(acc) => {
          onAddAccount(acc);
          onSelectActiveAccount(acc.id);
        }}
      />

      <MicrosoftLoginModal
        isOpen={isAddMicrosoftOpen}
        onClose={() => setIsAddMicrosoftOpen(false)}
        onAccountAdded={(acc) => {
          onAddAccount(acc);
          onSelectActiveAccount(acc.id);
        }}
      />

      {customizingAccount && (
        <SkinManagerModal
          isOpen={isSkinManagerOpen}
          onClose={() => {
            setIsSkinManagerOpen(false);
            setCustomizingAccount(null);
          }}
          account={customizingAccount}
          onUpdateAccountSkin={handleUpdateAccountSkin}
        />
      )}
    </div>
  );
};
