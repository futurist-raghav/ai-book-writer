'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PwaRuntime() {
  const [isOffline, setIsOffline] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissedInstallPrompt, setDismissedInstallPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsOffline(!window.navigator.onLine);
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);

    if ('serviceWorker' in window.navigator) {
      window.navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed', error);
      });
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setDismissedInstallPrompt(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  const showInstallPrompt = !isOffline && !isInstalled && !!deferredPrompt && !dismissedInstallPrompt;

  return (
    <>
      {isOffline ? (
        <div className="fixed inset-x-0 top-20 z-[60] px-4 md:px-8 pointer-events-none">
          <div className="mx-auto max-w-[1700px] rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 pointer-events-auto">
            You are offline. Previously loaded chapters stay available and draft saves will sync when your connection returns.
          </div>
        </div>
      ) : null}

      {showInstallPrompt ? (
        <div className="fixed bottom-24 right-4 z-[70] w-[min(92vw,320px)] rounded-xl border border-outline-variant/20 bg-white p-4 shadow-lg md:bottom-6">
          <p className="text-sm font-bold text-primary">Install AI Book Writer</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Add this app to your device for faster launch and better offline access.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDismissedInstallPrompt(true);
              }}
              className="rounded-lg border border-outline-variant/20 px-3 py-1.5 text-xs font-bold text-primary"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => {
                void handleInstallClick();
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white"
            >
              Install
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
