import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PwaRuntime } from '@/components/pwa/pwa-runtime';

type InstallChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

function setOnlineStatus(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

function mockServiceWorkerRegister() {
  const register = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: { register },
  });
  return register;
}

async function dispatchInstallPromptEvent(choice: InstallChoice, prompt = jest.fn().mockResolvedValue(undefined)) {
  const event = new Event('beforeinstallprompt');
  Object.defineProperty(event, 'prompt', {
    configurable: true,
    value: prompt,
  });
  Object.defineProperty(event, 'userChoice', {
    configurable: true,
    value: Promise.resolve(choice),
  });
  await act(async () => {
    window.dispatchEvent(event);
  });
  return prompt;
}

describe('PwaRuntime', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows offline banner and registers service worker', async () => {
    setOnlineStatus(false);
    const register = mockServiceWorkerRegister();

    render(<PwaRuntime />);

    expect(screen.getByText(/You are offline\./i)).toBeInTheDocument();
    await waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js'));
  });

  it('shows and dismisses install prompt UI', async () => {
    setOnlineStatus(true);
    mockServiceWorkerRegister();

    render(<PwaRuntime />);

    await dispatchInstallPromptEvent({ outcome: 'dismissed', platform: 'web' });

    expect(await screen.findByText('Install AI Book Writer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    await waitFor(() => {
      expect(screen.queryByText('Install AI Book Writer')).not.toBeInTheDocument();
    });
  });

  it('invokes browser install prompt when user clicks Install', async () => {
    setOnlineStatus(true);
    mockServiceWorkerRegister();

    render(<PwaRuntime />);

    const prompt = await dispatchInstallPromptEvent({ outcome: 'accepted', platform: 'web' });

    const installButton = await screen.findByRole('button', { name: 'Install' });
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Install AI Book Writer')).not.toBeInTheDocument();
    });
  });
});
