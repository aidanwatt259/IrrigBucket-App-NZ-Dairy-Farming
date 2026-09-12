import { useState } from 'react';
import { useLocation } from 'wouter';
import { Droplet, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.39.07 2.36.74 3.17.8 1.21-.24 2.38-.93 3.6-.84 1.54.12 2.69.71 3.47 1.78-3.19 1.9-2.39 6.08.39 7.28-.57 1.36-1.31 2.71-2.63 3.84zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

export default function Signup() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleOAuth(provider: 'google' | 'apple') {
    setOauthLoading(provider);
    setError(null);
    try {
      const supabase = await getSupabaseClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth-callback`,
        },
      });
      if (oauthError) setError(oauthError.message);
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  }

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

      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

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
            <h1 className="text-xl font-display font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We've sent a confirmation link to{' '}
              <span className="font-medium text-foreground">{email}</span>.
              Click it to verify your account and then log in.
            </p>
            <Button variant="outline" className="w-full mt-6" onClick={() => setLocation('/login')}>
              Go to login
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
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">Create account</h1>
          <p className="text-sm text-muted-foreground mb-6">Start saving and tracking your reports</p>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 mb-4 border border-destructive/20">
              {error}
            </div>
          )}

          {/* Social auth */}
          <div className="space-y-2.5 mb-5">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== null || isLoading}
              className="w-full flex items-center justify-center gap-2.5 border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GoogleIcon />
              {oauthLoading === 'google' ? 'Connecting…' : 'Continue with Google'}
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('apple')}
              disabled={oauthLoading !== null || isLoading}
              className="w-full flex items-center justify-center gap-2.5 border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AppleIcon />
              {oauthLoading === 'apple' ? 'Connecting…' : 'Continue with Apple'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or sign up with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
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
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || oauthLoading !== null}>
              {isLoading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground/70 text-center mt-4">
            You'll receive a verification email to confirm your account.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{' '}
          <button onClick={() => setLocation('/login')} className="text-primary hover:underline font-medium">
            Log in
          </button>
        </p>

        <p className="text-center mt-3">
          <button
            onClick={() => setLocation('/')}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            ← Back to home
          </button>
        </p>
      </div>
    </div>
  );
}
