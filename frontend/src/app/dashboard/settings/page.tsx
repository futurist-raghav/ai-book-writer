'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

const profileSchema = z.object({
  full_name: z.string().optional(),
  writing_style: z.string().optional(),
  preferred_tense: z.string().optional(),
  preferred_perspective: z.string().optional(),
  ai_assist_enabled: z.boolean().optional(),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(6, 'Password must be at least 6 characters'),
    new_password: z.string().min(8, 'New password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

const writingStyles = ['narrative', 'descriptive', 'conversational', 'formal', 'literary'];
const tenses = ['past', 'present', 'mixed'];
const perspectives = ['first person', 'third person limited', 'third person omniscient'];

export default function SettingsPage() {
  const { setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: userData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => apiClient.auth.me(),
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: userData?.data?.full_name || '',
      writing_style: userData?.data?.writing_style || '',
      preferred_tense: userData?.data?.preferred_tense || '',
      preferred_perspective: userData?.data?.preferred_perspective || '',
      ai_assist_enabled: userData?.data?.ai_assist_enabled ?? true,
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const normalized = {
        full_name: data.full_name?.trim() || undefined,
        writing_style: data.writing_style?.trim() || undefined,
        preferred_tense: data.preferred_tense?.trim() || undefined,
        preferred_perspective: data.preferred_perspective?.trim() || undefined,
        ai_assist_enabled: data.ai_assist_enabled ?? true,
      };

      await apiClient.auth.updateMe({ full_name: normalized.full_name });
      await apiClient.auth.updateWritingProfile({
        writing_style: normalized.writing_style,
        preferred_tense: normalized.preferred_tense,
        preferred_perspective: normalized.preferred_perspective,
        ai_assist_enabled: normalized.ai_assist_enabled,
      });

      const refreshed = await apiClient.auth.me();
      return refreshed.data;
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast.success('Settings saved successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      apiClient.auth.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      passwordForm.reset();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to change password');
    },
  });

  const onProfileSubmit = (data: ProfileForm) => profileMutation.mutate(data);
  const onPasswordSubmit = (data: PasswordForm) => {
    passwordMutation.mutate({
      current_password: data.current_password,
      new_password: data.new_password,
    });
  };

  if (isLoading) {
    return <Loading message="Loading settings..." />;
  }

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto pt-8 pb-24">
        <QueryErrorState
          title="Unable to load settings"
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24 space-y-8">
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Workspace Controls</p>
        <h1 className="text-5xl md:text-6xl font-light tracking-tighter text-primary font-body">Settings</h1>
        <p className="font-label text-sm text-on-surface-variant mt-4 max-w-3xl">
          Configure account details, writing defaults, and AI behavior. These preferences influence transcription cleanup,
          chapter drafting, and rewrite depth across your projects.
        </p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-5 flex flex-wrap gap-3">
        <Link href="/dashboard/books" className="px-4 py-2 rounded-lg border border-outline-variant/20 font-label text-xs font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors">
          Select Project
        </Link>
        <Link href="/dashboard/drafts" className="px-4 py-2 rounded-lg border border-outline-variant/20 font-label text-xs font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors">
          Manage Drafts
        </Link>
        <Link href="/dashboard/archive" className="px-4 py-2 rounded-lg border border-outline-variant/20 font-label text-xs font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors">
          Browse Archive
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
          <div className="mb-5">
            <h2 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Account Profile</h2>
            <p className="font-label text-xs text-on-surface-variant mt-1">Used in ownership, exports, and account identity.</p>
          </div>

          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={userData?.data?.email || ''} disabled />
              <p className="text-xs text-muted-foreground">Email cannot be changed from this panel.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" {...profileForm.register('full_name')} placeholder="Your display name" />
            </div>

            <Button
              type="button"
              onClick={profileForm.handleSubmit(onProfileSubmit)}
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Profile
            </Button>
          </form>
        </section>

        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
          <div className="mb-5">
            <h2 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Writing + AI Defaults</h2>
            <p className="font-label text-xs text-on-surface-variant mt-1">Baseline style used when creating or refining chapters.</p>
          </div>

          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="writing_style">Writing Style</Label>
              <select
                id="writing_style"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...profileForm.register('writing_style')}
              >
                <option value="">Select style...</option>
                {writingStyles.map((style) => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_tense">Preferred Tense</Label>
              <select
                id="preferred_tense"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...profileForm.register('preferred_tense')}
              >
                <option value="">Select tense...</option>
                {tenses.map((tense) => (
                  <option key={tense} value={tense}>{tense}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_perspective">Preferred Perspective</Label>
              <select
                id="preferred_perspective"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...profileForm.register('preferred_perspective')}
              >
                <option value="">Select perspective...</option>
                {perspectives.map((perspective) => (
                  <option key={perspective} value={perspective}>{perspective}</option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4" {...profileForm.register('ai_assist_enabled')} />
              <span>
                Enable AI wording enhancement and deeper explanation support after STT for new content.
              </span>
            </label>

            <Button
              type="button"
              onClick={profileForm.handleSubmit(onProfileSubmit)}
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Preferences
            </Button>
          </form>
        </section>

        <section className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
          <div className="mb-5">
            <h2 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Security</h2>
            <p className="font-label text-xs text-on-surface-variant mt-1">Update your account password.</p>
          </div>

          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <Input id="current_password" type="password" {...passwordForm.register('current_password')} />
                {passwordForm.formState.errors.current_password && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.current_password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input id="new_password" type="password" {...passwordForm.register('new_password')} />
                {passwordForm.formState.errors.new_password && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.new_password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <Input id="confirm_password" type="password" {...passwordForm.register('confirm_password')} />
                {passwordForm.formState.errors.confirm_password && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.confirm_password.message}</p>
                )}
              </div>
            </div>

            <Button type="submit" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </form>
        </section>

        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
          <div className="mb-5">
            <h2 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Appearance</h2>
            <p className="font-label text-xs text-on-surface-variant mt-1">Customize how the editor looks and feels.</p>
          </div>

          <div className="space-y-4">
            <DarkModeToggle />
          </div>
        </section>
      </div>
    </div>
  );
}
