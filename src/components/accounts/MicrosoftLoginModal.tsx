import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ExternalLink, Copy, Check, Loader2, AlertCircle, Globe, Key, RefreshCw } from 'lucide-react';
import { requestMicrosoftDeviceCode, completeMicrosoftLogin, requireMicrosoftClientId } from '../../services/authService';
import { MicrosoftAccount, DeviceCodeResponse } from '../../types/auth';
import { MicrosoftBrandIcon } from '../icons/MinecraftIcons';
import { invokeLoginWithMicrosoftLoopback, isTauriEnvironment } from '../../services/tauriBridge';
import { playMinecraftClickSound, playMinecraftLevelUpSound } from '../../services/soundService';

interface MicrosoftLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: (account: MicrosoftAccount) => void;
}

type AuthMethod = 'browser' | 'device_code';

export const MicrosoftLoginModal: React.FC<MicrosoftLoginModalProps> = ({
  isOpen,
  onClose,
  onAccountAdded,
}) => {
  const isDesktop = isTauriEnvironment();
  const [method, setMethod] = useState<AuthMethod>(isDesktop ? 'browser' : 'device_code');
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listeningPort, setListeningPort] = useState<number>(28420);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Start Browser Loopback Flow
  const startLoopbackFlow = useCallback(async () => {
    setError(null);
    setLoading(true);
    setAuthenticating(true);

    try {
      const clientId = requireMicrosoftClientId();
      const account = await invokeLoginWithMicrosoftLoopback(clientId, listeningPort);
      playMinecraftLevelUpSound();
      onAccountAdded(account as MicrosoftAccount);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
      setAuthenticating(false);
    }
  }, [listeningPort, onAccountAdded, onClose]);

  // Start Device Code Flow
  const startDeviceCodeFlow = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setDeviceCode(null);
    setLoading(true);
    setAuthenticating(false);
    setError(null);

    try {
      const code = await requestMicrosoftDeviceCode();
      if (controller.signal.aborted) return;
      setDeviceCode(code);
      setLoading(false);
      setAuthenticating(true);

      const account = await completeMicrosoftLogin(code, controller.signal);
      if (controller.signal.aborted) return;
      playMinecraftLevelUpSound();
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
  }, [onAccountAdded, onClose]);

  useEffect(() => {
    if (!isOpen) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    if (method === 'browser' && isDesktop) {
      void startLoopbackFlow();
    } else {
      void startDeviceCodeFlow();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, method, isDesktop, startLoopbackFlow, startDeviceCodeFlow]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="microsoft-login-title"
        className="card-obsidian w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.8)]"
      >
        <header className="flex items-center justify-between border-b border-white/10 bg-[#0a0d14] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <MicrosoftBrandIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 id="microsoft-login-title" className="text-sm font-black text-white font-display">
                Microsoft Account Sign-In
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {method === 'browser' ? 'Localhost loopback listener' : 'Device authorization code'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playMinecraftClickSound();
              onClose();
            }}
            className="rounded p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
            aria-label="Cancel Microsoft sign-in"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Method selector tabs */}
        <div className="flex border-b border-white/10 bg-black/40 px-6 pt-3 gap-2">
          {isDesktop && (
            <button
              type="button"
              onClick={() => {
                playMinecraftClickSound();
                setMethod('browser');
              }}
              className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 text-xs font-bold transition-all cursor-pointer font-display ${
                method === 'browser'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web Browser (Localhost)</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">Fastest</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              playMinecraftClickSound();
              setMethod('device_code');
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 text-xs font-bold transition-all cursor-pointer font-display ${
              method === 'device_code'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Device Code</span>
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Browser Loopback View */}
          {method === 'browser' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 font-display">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span>Localhost Loopback Listener Active</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The launcher opened your default web browser to Microsoft&apos;s sign-in page and is listening on:
                </p>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/60 border border-white/10 font-mono text-xs">
                  <span className="text-slate-400">Callback URL:</span>
                  <span className="text-emerald-400 font-bold select-all">
                    http://localhost:{listeningPort}/callback
                  </span>
                </div>
              </div>

              {authenticating && (
                <div className="flex flex-col items-center justify-center gap-3 py-6 text-slate-400 bg-black/30 rounded-xl border border-white/5">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-white font-display">Waiting for Authorization</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Log into your Microsoft account in your browser tab.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => void startLoopbackFlow()}
                  disabled={loading}
                  className="btn-mc btn-mc-green flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white font-display cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Restart Browser Sign-In</span>
                </button>
                <span className="text-[11px] text-slate-500 font-mono">Port: {listeningPort}</span>
              </div>
            </div>
          )}

          {/* Device Code View */}
          {method === 'device_code' && (
            <>
              {loading && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-400">
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
                        className="btn-mc btn-mc-green flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold text-white font-display cursor-pointer"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy Code'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenLink}
                        className="btn-mc btn-mc-green flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-black text-white font-display cursor-pointer"
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
            </>
          )}

          {error && (
            <div role="alert" className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-white/5 pt-3 text-[11px] text-slate-500 font-mono">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span>Your credentials are encrypted and stored in the OS credential store.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
