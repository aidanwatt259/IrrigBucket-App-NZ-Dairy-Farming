import { useState } from 'react';
import { useLocation } from 'wouter';
import { Droplet, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';

export default function Signup() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
          // Supabase will email a confirmation link to this address.
          // The link redirects to /auth-callback where the session is completed.
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
            <Button
              variant="outline"
              className="w-full mt-6"
              onClick={() => setLocation('/login')}
            >
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
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
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
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
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Confirm password
              </label>
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground/70 text-center mt-4">
            You'll receive a verification email to confirm your account.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{' '}
          <button
            onClick={() => setLocation('/login')}
            className="text-primary hover:underline font-medium"
          >
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
