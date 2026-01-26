'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { User, Palette, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

const profileSchema = z.object({
  full_name: z.string().optional(),
  writing_style: z.string().optional(),
  preferred_tense: z.string().optional(),
  preferred_perspective: z.string().optional(),
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

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: userData, isLoading } = useQuery({
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

  const onPasswordSubmit = (data: PasswordForm) => {
    passwordMutation.mutate({
      current_password: data.current_password,
      new_password: data.new_password,
    });
  };

  if (isLoading) {
    return <Loading message="Loading settings..." />;
  }

  const writingStyles = [
    'Narrative',
    'Descriptive',
    'Conversational',
    'Formal',
    'Literary',
  ];

  const tenses = ['Past', 'Present', 'Mixed'];
  const perspectives = ['First Person', 'Third Person Limited', 'Third Person Omniscient'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and writing preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>
              Your personal information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userData?.data?.email || ''}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  {...profileForm.register('full_name')}
                  placeholder="John Doe"
                />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Writing Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Writing Preferences</CardTitle>
            </div>
            <CardDescription>
              Customize how AI processes your content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="writing_style">Writing Style</Label>
                <select
                  id="writing_style"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...profileForm.register('writing_style')}
                >
                  <option value="">Select a style...</option>
                  {writingStyles.map((style) => (
                    <option key={style} value={style.toLowerCase()}>
                      {style}
                    </option>
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
                  <option value="">Select a tense...</option>
                  {tenses.map((tense) => (
                    <option key={tense} value={tense.toLowerCase()}>
                      {tense}
                    </option>
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
                  <option value="">Select a perspective...</option>
                  {perspectives.map((perspective) => (
                    <option key={perspective} value={perspective.toLowerCase()}>
                      {perspective}
                    </option>
                  ))}
                </select>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle>Change Password</CardTitle>
            </div>
            <CardDescription>
              Update your account password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="current_password">Current Password</Label>
                  <Input
                    id="current_password"
                    type="password"
                    {...passwordForm.register('current_password')}
                  />
                  {passwordForm.formState.errors.current_password && (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.current_password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    {...passwordForm.register('new_password')}
                  />
                  {passwordForm.formState.errors.new_password && (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.new_password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm Password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    {...passwordForm.register('confirm_password')}
                  />
                  {passwordForm.formState.errors.confirm_password && (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.confirm_password.message}
                    </p>
                  )}
                </div>
              </div>
              <Button type="submit" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
