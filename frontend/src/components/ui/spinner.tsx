import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 className={cn('animate-spin text-muted-foreground', sizeClasses[size], className)} />
  );
}

interface LoadingProps {
  message?: string;
  className?: string;
}

export function Loading({ message = 'Loading...', className }: LoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-8', className)}>
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
