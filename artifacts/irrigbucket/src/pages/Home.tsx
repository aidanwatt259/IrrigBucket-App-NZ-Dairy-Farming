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
  SprayCan 
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const irrigatorTypes = [
  { id: 'pivot', name: 'Centre Pivot', desc: 'Rotating arm that sweeps in a circle', icon: CircleDot },
  { id: 'lateral', name: 'Lateral Move', desc: 'Linear system moving across paddock', icon: MoveRight },
  { id: 'kline', name: 'K-Line / Pods', desc: 'Portable pod-based drip system', icon: Grip },
  { id: 'gun', name: 'Travelling Gun', desc: 'Single large sprinkler head on cart', icon: Target },
  { id: 'solid', name: 'Solid Set / Fixed', desc: 'Permanent fixed sprinkler grid', icon: Grid2X2 },
  { id: 'boom', name: 'Boom Spray', desc: 'Overhead spray boom system', icon: SprayCan },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const setIrrigatorType = useAppStore(state => state.setIrrigatorType);
  const currentType = useAppStore(state => state.irrigatorType);

  const handleSelect = (id: string) => {
    setIrrigatorType(id);
    setLocation('/setup');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Hero Section */}
      <div className="relative pt-20 pb-16 sm:pt-32 sm:pb-24 px-4 sm:px-6 lg:px-8 text-center bg-gradient-to-b from-white to-background border-b border-border/50">
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
            const Icon = type.icon;
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
                      <Icon className="w-8 h-8" />
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
