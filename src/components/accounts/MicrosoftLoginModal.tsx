import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { requestMicrosoftDeviceCode, completeMicrosoftLogin } from '../../services/authService';
import { MicrosoftAccount, DeviceCodeResponse } from '../../types/auth';
import { MicrosoftBrandIcon } from '../icons/MinecraftIcons';

interface MicrosoftLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: (account: MicrosoftAccount) => void;
}

export const MicrosoftLoginModal: React.FC<MicrosoftLoginModalProps> = ({
  isOpen,
  onClose,
  onAccountAdded,
}) => {
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    setDeviceCode(null);
    setLoading(true);
    setAuthenticating(false);
    setError(null);

    const authenticate = async () => {
      try {
        const code = await requestMicrosoftDeviceCode();
        if (controller.signal.aborted) return;
        setDeviceCode(code);
        setLoading(false);
        setAuthenticating(true);

        const account = await completeMicrosoftLogin(code, controller.signal);
        if (controller.signal.aborted) return;
        onAccountAdded(account);
        onClose();
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setAuthenticating(false);
        }
      }
    };

    void authenticate();
    return () => controller.abort();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    if (!deviceCode) return;
    try {
      await navigator.clipboard.writeText(deviceCode.user_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const handleOpenLink = () => {
    if (!deviceCode) return;
    window.open(deviceCode.verification_uri, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="microsoft-login-title"
        className="card-obsidian w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.8)]"
      >
        <header className="flex items-center justify-between border-b border-white/5 bg-[#0a0d14] px-6 py-4">
          <div className="flex items-center gap-3">
            <MicrosoftBrandIcon className="h-5 w-5" />
            <div>
              <h2 id="microsoft-login-title" className="text-sm font-black text-white font-display">
                Microsoft Account Sign-In
              </h2>
              <p className="text-[11px] text-slate-400">Microsoft device authorization</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Cancel Microsoft sign-in"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-xs font-mono">Requesting a device code from Microsoft…</p>
            </div>
          )}

          {deviceCode && (
            <>
              <p className="text-xs leading-relaxed text-slate-300">
                Open Microsoft&apos;s sign-in page and enter this code to authorize your account:
              </p>
              <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-black/60 p-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-display">
                  Your Microsoft Device Code
                </span>
                <div className="select-all text-3xl font-black tracking-widest text-emerald-400 font-mono">
                  {deviceCode.user_code}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="btn-mc btn-mc-green flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold text-white font-display"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Code'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenLink}
                    className="btn-mc btn-mc-green flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-black text-white font-display"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open sign-in page</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {authenticating && (
            <div className="space-y-1.5 rounded-xl border border-white/5 bg-black/40 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 font-display">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                <span>Waiting for Microsoft authorization…</span>
              </div>
              <p className="text-[11px] leading-normal text-slate-400">
                The launcher will verify your Xbox account and Minecraft Java profile after approval.
              </p>
            </div>
          )}

          {error && (
            <div role="alert" className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-white/5 pt-3 text-[11px] text-slate-500 font-mono">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span>Your Microsoft password is entered only on Microsoft&apos;s sign-in page.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
