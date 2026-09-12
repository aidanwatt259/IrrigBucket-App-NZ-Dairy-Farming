import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Droplet, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseClient, createServerSession } from '@/lib/supabase';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // On mount, check Supabase has an active recovery session (set by AuthCallback).
  useEffect(() => {
    getSupabaseClient()
      .then((sb) => sb.auth.getSession())
      .then(({ data }) => setHasSession(!!data.session))
      .catch(() => setHasSession(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = await getSupabaseClient();

      // Update the password — requires an active Supabase session from the reset link.
      const { data, error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (data.user) {
        // Create the server session so the user is immediately logged in.
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          await createServerSession(
            sessionData.session.access_token,
            sessionData.session.refresh_token,
          );
        }
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // Loading state while checking session
  if (hasSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  // No valid session — link is expired or was already used
  if (hasSession === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="bg-primary/10 p-2 rounded-xl text-primary">
              <Droplet className="w-5 h-5 fill-primary" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">
              Irrig<span className="text-primary">Bucket</span>
            </span>
          </div>
          <div className="bg-white border border-border/60 rounded-2xl p-8 shadow-sm text-center">
            <p className="text-sm text-muted-foreground mb-4">
              This reset link has expired or has already been used.
              Please request a new one.
            </p>
            <Button className="w-full" onClick={() => setLocation('/forgot-password')}>
              Request new link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="bg-primary/10 p-2 rounded-xl text-primary">
              <Droplet className="w-5 h-5 fill-primary" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">
              Irrig<span className="text-primary">Bucket</span>
            </span>
          </div>
          <div className="bg-white border border-border/60 rounded-2xl p-8 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground mb-2">Password updated</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Your password has been changed. You're now logged in.
            </p>
            <Button className="w-full" onClick={() => (window.location.href = '/')}>
              Go to app
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-primary/10 p-2 rounded-xl text-primary">
            <Droplet className="w-5 h-5 fill-primary" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-foreground">
            Irrig<span className="text-primary">Bucket</span>
          </span>
        </div>

        <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">Set new password</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Choose a new password for your account.
          </p>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 mb-4 border border-destructive/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  autoFocus
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm new password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
                placeholder="Re-enter your new password"
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
