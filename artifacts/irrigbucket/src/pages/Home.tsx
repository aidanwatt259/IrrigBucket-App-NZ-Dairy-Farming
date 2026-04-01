import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { 
  Droplet, 
  CircleDot, 
  MoveRight, 
  Grip, 
  Target, 
  Grid2X2,
  Menu,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { SideMenu } from '@/components/layout/SideMenu';

function RotoRainerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Faint outer coverage circle */}
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2.5 2.5" opacity="0.25" />

      {/* Arm 1 — pointing straight up */}
      <line x1="16" y1="16" x2="16" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Nozzle head */}
      <circle cx="16" cy="4" r="2" fill="currentColor" />
      {/* Water droplets */}
      <circle cx="13.5" cy="2.5" r="1.1" fill="currentColor" opacity="0.5" />
      <circle cx="18.5" cy="2.5" r="1.1" fill="currentColor" opacity="0.5" />

      {/* Arm 2 — bottom right (120° from arm 1) */}
      <line x1="16" y1="16" x2="25.3" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="25.3" cy="21.5" r="2" fill="currentColor" />
      <circle cx="27.5" cy="24" r="1.1" fill="currentColor" opacity="0.5" />
      <circle cx="28" cy="21" r="1.1" fill="currentColor" opacity="0.5" />

      {/* Arm 3 — bottom left (240° from arm 1) */}
      <line x1="16" y1="16" x2="6.7" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="6.7" cy="21.5" r="2" fill="currentColor" />
      <circle cx="4.5" cy="24" r="1.1" fill="currentColor" opacity="0.5" />
      <circle cx="4" cy="21" r="1.1" fill="currentColor" opacity="0.5" />

      {/* Central hub */}
      <circle cx="16" cy="16" r="3" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="none" stroke="white" strokeWidth="1.2" />

      {/* Rotation arc hint */}
      <path
        d="M 16 5.5 A 10.5 10.5 0 0 1 24.5 20"
        stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"
        strokeDasharray="1.5 2.5" opacity="0.4"
      />
    </svg>
  );
}

const irrigatorTypes = [
  { id: 'pivot', name: 'Centre Pivot', desc: 'Rotating arm that sweeps in a circle', icon: CircleDot, custom: false },
  { id: 'lateral', name: 'Lateral Move', desc: 'Linear system moving across paddock', icon: MoveRight, custom: false },
  { id: 'kline', name: 'K-Line / Pods', desc: 'Portable pod-based drip system', icon: Grip, custom: false },
  { id: 'gun', name: 'Travelling Gun', desc: 'Single large sprinkler head on cart', icon: Target, custom: false },
  { id: 'solid', name: 'Solid Set / Fixed', desc: 'Permanent fixed sprinkler grid', icon: Grid2X2, custom: false },
  { id: 'boom', name: 'Roto Rainer', desc: 'Rotating boom arm sprinkler system', icon: null, custom: true },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const setIrrigatorType = useAppStore(state => state.setIrrigatorType);
  const currentType = useAppStore(state => state.irrigatorType);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSelect = (id: string) => {
    setIrrigatorType(id);
    setLocation('/setup');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">

      {/* ── Fixed Header ──────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo — left */}
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Droplet className="w-5 h-5 fill-primary" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight text-foreground">
                Irrig<span className="text-primary">Bucket</span>
              </span>
            </div>
            {/* Hamburger — right */}
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      {/* Hero Section */}
      <div className="relative pt-16 pb-16 sm:pt-24 sm:pb-24 px-4 sm:px-6 lg:px-8 text-center bg-gradient-to-b from-white to-background border-b border-border/50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
            <Droplet className="w-10 h-10 text-primary fill-primary" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-display font-extrabold tracking-tight text-foreground mb-6">
            Perfect Bucket Tests,<br className="hidden sm:block" />
            <span className="text-primary">Every Time.</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Get the exact setup for your irrigation system — bucket count, spacing, and placement, calculated instantly for NZ dairy farmers.
          </p>
        </motion.div>
      </div>

      {/* Selection Grid */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-display font-bold text-center mb-10">Select your irrigator type to begin:</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {irrigatorTypes.map((type, i) => {
            const isSelected = currentType === type.id;
            
            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card 
                  className={`cursor-pointer transition-all duration-300 h-full flex flex-col hover-elevate ${
                    isSelected ? 'ring-4 ring-primary border-primary' : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleSelect(type.id)}
                >
                  <div className="p-6 md:p-8 flex-1 flex flex-col items-center text-center">
                    <div className={`p-4 rounded-2xl mb-6 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                      {type.custom
                        ? <RotoRainerIcon className="w-8 h-8" />
                        : (() => { const Icon = type.icon!; return <Icon className="w-8 h-8" />; })()
                      }
                    </div>
                    <h3 className="text-xl font-bold font-display mb-2">{type.name}</h3>
                    <p className="text-muted-foreground">{type.desc}</p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer Badge */}
      <div className="max-w-md mx-auto pb-20 text-center px-4">
        <div className="inline-flex items-center justify-center p-1 pr-4 bg-white rounded-full shadow-md border border-border/50">
          <img 
            src={`${import.meta.env.BASE_URL}images/dairy-badge.png`} 
            alt="DairyNZ Badge" 
            className="w-10 h-10 rounded-full mr-3"
          />
          <span className="text-sm font-semibold text-foreground">Follows DairyNZ testing protocols</span>
        </div>
      </div>
    </div>
  );
}
