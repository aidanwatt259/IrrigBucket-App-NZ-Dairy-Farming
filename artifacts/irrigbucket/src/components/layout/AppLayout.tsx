import React from 'react';
import { Droplet, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { Progress } from '@/components/ui/progress';

interface AppLayoutProps {
  children: React.ReactNode;
  step: number;
  title: string;
  showBack?: boolean;
}

export function AppLayout({ children, step, title, showBack = true }: AppLayoutProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    window.history.back();
  };

  const progressValue = (step / 5) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-background/90 backdrop-blur-sm">
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {showBack && (
                <button 
                  onClick={handleBack}
                  className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation('/')}>
                <div className="bg-primary/10 p-2 rounded-xl text-primary">
                  <Droplet className="w-5 h-5 fill-primary" />
                </div>
                <span className="font-display font-bold text-xl tracking-tight text-foreground hidden sm:block">
                  Irrig<span className="text-primary">Bucket</span>
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">
                Step {step} of 5
              </span>
            </div>
          </div>
          
          <div className="pb-4">
            <Progress value={progressValue} className="h-2" />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 pt-6 sm:pt-10 pb-20">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            {title}
          </h1>
        </div>
        
        {children}
      </main>
    </div>
  );
}
