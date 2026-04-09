import { AxiosError } from 'axios';

type ErrorPayload = {
  detail?: string;
  message?: string;
  errors?: Array<{ message?: string }>;
};

const FRIENDLY_STATUS_MESSAGES: Record<number, string> = {
  400: 'This request could not be processed. Please check your input and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource could not be found.',
  408: 'The request timed out. Please try again.',
  409: 'A conflicting change was detected. Refresh and try again.',
  422: 'Some fields are invalid. Please review your input and retry.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'The server encountered an error. Please try again shortly.',
  502: 'The service is temporarily unavailable. Please try again shortly.',
  503: 'The service is currently unavailable. Please try again shortly.',
  504: 'The server took too long to respond. Please try again shortly.',
};

function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as ErrorPayload | undefined;

    const explicit =
      data?.detail ||
      data?.message ||
      data?.errors?.find((item) => item?.message)?.message;

    if (explicit && explicit.trim()) {
      return explicit;
    }

    if (typeof status === 'number' && FRIENDLY_STATUS_MESSAGES[status]) {
      return FRIENDLY_STATUS_MESSAGES[status];
    }

    if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
      return 'The request timed out. Please try again.';
    }

    if (!error.response) {
      return 'Network connection issue. Check your connection and try again.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

interface QueryErrorStateProps {
  title?: string;
  error?: unknown;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function QueryErrorState({
  title = 'Unable to load data',
  error,
  message,
  onRetry,
  retryLabel = 'Try Again',
  className,
}: QueryErrorStateProps) {
  const resolvedMessage = message || getErrorMessage(error, 'Please try again in a moment.');

  return (
    <div
      className={`rounded-xl border border-error/20 bg-error/5 p-6 text-center ${className || ''}`.trim()}
      role="alert"
      aria-live="polite"
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
        <span className="material-symbols-outlined">error</span>
      </div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">{title}</h3>
      <p className="mx-auto mb-4 max-w-xl text-sm text-on-surface-variant">{resolvedMessage}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
