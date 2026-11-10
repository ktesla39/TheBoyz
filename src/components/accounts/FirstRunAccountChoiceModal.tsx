import React from 'react';
import { MicrosoftBrandIcon, OfflineShieldIcon } from '../icons/MinecraftIcons';
import { playMinecraftClickSound } from '../../services/soundService';

interface FirstRunAccountChoiceModalProps {
  onChooseOffline: () => void;
  onChooseMicrosoft: () => void;
}

export const FirstRunAccountChoiceModal: React.FC<FirstRunAccountChoiceModalProps> = ({
  onChooseOffline,
  onChooseMicrosoft,
}) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-account-title"
      className="card-obsidian w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.8)]"
    >
      <header className="border-b border-white/5 bg-[#0a0d14] px-6 py-5">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[var(--mc-accent)]">
          Welcome to The Boys
        </span>
        <h2 id="first-run-account-title" className="mt-1 text-xl font-black text-white font-display">
          Choose your account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Select an offline profile or sign in with Microsoft to continue.
        </p>
      </header>

      <div className="grid gap-3 p-6 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            playMinecraftClickSound();
            onChooseOffline();
          }}
          className="btn-mc btn-mc-green flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl px-4 py-5 text-white"
        >
          <OfflineShieldIcon className="h-7 w-7 text-amber-300" />
          <span className="text-sm font-black font-display">Offline Account</span>
          <span className="text-center text-[11px] font-medium text-white/75">Create a local player profile</span>
        </button>
        <button
          type="button"
          onClick={() => {
            playMinecraftClickSound();
            onChooseMicrosoft();
          }}
          className="btn-mc btn-mc-green flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl px-4 py-5 text-white"
        >
          <MicrosoftBrandIcon className="h-7 w-7" />
          <span className="text-sm font-black font-display">Microsoft Account</span>
          <span className="text-center text-[11px] font-medium text-white/75">Sign in with your Microsoft account</span>
        </button>
      </div>
    </section>
  </div>
);
