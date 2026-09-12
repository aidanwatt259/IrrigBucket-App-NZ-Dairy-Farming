import { useState } from 'react';
import { useLocation } from 'wouter';
import { Droplet, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = await getSupabaseClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth-callback`,
        },
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
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

        {sent ? (
          <div className="bg-white border border-border/60 rounded-2xl p-8 shadow-sm text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If an account exists for{' '}
              <span className="font-medium text-foreground">{email}</span>,
              we've sent a password reset link. It expires in 1 hour.
            </p>
            <Button variant="outline" className="w-full mt-6" onClick={() => setLocation('/login')}>
              Back to login
            </Button>
          </div>
        ) : (
          <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
            <h1 className="text-2xl font-display font-bold text-foreground mb-1">Reset password</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your email and we'll send you a link to reset your password.
            </p>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 mb-4 border border-destructive/20">
                {error}
              </div>
            )}

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
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </div>
        )}

        <p className="text-center mt-5">
          <button
            onClick={() => setLocation('/login')}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            ← Back to login
          </button>
        </p>
      </div>
    </div>
  );
}
