import { useState } from 'react';
import { useLocation } from 'wouter';
import { Droplet, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseClient, createServerSession } from '@/lib/supabase';

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = await getSupabaseClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (!data.session) {
        setError('Login failed. Please try again.');
        return;
      }

      await createServerSession(
        data.session.access_token,
        data.session.refresh_token,
      );

      window.location.href = '/';
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-6">Log in to your account</p>

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
                  placeholder="••••••••"
                  autoComplete="current-password"
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Log in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Don't have an account?{' '}
          <button
            onClick={() => setLocation('/signup')}
            className="text-primary hover:underline font-medium"
          >
            Sign up
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
