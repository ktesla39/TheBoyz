import React from 'react';
import { ChevronRight } from 'lucide-react';
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
      className="card-obsidian w-full max-w-xl overflow-hidden rounded-2xl"
    >
      <header className="border-b border-white/5 bg-[var(--mc-panel)] px-6 py-5">
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

      <div className="grid gap-3 p-5">
        <button
          type="button"
          onClick={() => {
            playMinecraftClickSound();
            onChooseOffline();
          }}
          data-tone="amber"
          className="choice-card group flex min-h-24 items-center gap-4 rounded-xl px-4 py-4 text-left"
        >
          <span className="choice-icon"><OfflineShieldIcon className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--mc-text)]">Offline profile</span>
            <span className="mt-1 block text-xs text-[var(--mc-muted)]">Create a local player profile for offline play.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--mc-muted)] transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            playMinecraftClickSound();
            onChooseMicrosoft();
          }}
          data-tone="ice"
          className="choice-card group flex min-h-24 items-center gap-4 rounded-xl px-4 py-4 text-left"
        >
          <span className="choice-icon"><MicrosoftBrandIcon className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--mc-text)]">Microsoft account</span>
            <span className="mt-1 block text-xs text-[var(--mc-muted)]">Sign in to use your Xbox profile and owned games.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--mc-muted)] transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </section>
  </div>
);
