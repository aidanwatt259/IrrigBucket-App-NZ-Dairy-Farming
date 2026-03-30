import { create } from 'zustand';
import { calculatePlan, SystemParams, Plan, SectionDefinition } from './calculations';

interface AppState {
  irrigatorType: string | null;
  systemParams: SystemParams;
  plan: Plan | null;
  volumes: number[];
  windSpeed: number;
  testDate: string;
  sections: SectionDefinition[];
  
  setIrrigatorType: (type: string) => void;
  setSystemParams: (params: Partial<SystemParams>) => void;
  generatePlan: () => void;
  setVolume: (index: number, volume: number) => void;
  setVolumesArray: (volumes: number[]) => void;
  setTestConditions: (date: string, wind: number) => void;
  setSections: (sections: SectionDefinition[]) => void;
  reset: () => void;
}

const defaultParams: SystemParams = {
  diameter: 250,
  targetDepth: 15,
};

export const useAppStore = create<AppState>((set, get) => ({
  irrigatorType: null,
  systemParams: { ...defaultParams },
  plan: null,
  volumes: [],
  windSpeed: 0,
  testDate: new Date().toISOString().split('T')[0],
  sections: [],

  setIrrigatorType: (type) => set({ irrigatorType: type }),
  
  setSystemParams: (params) => set((state) => ({ 
    systemParams: { ...state.systemParams, ...params } 
  })),
  
  generatePlan: () => {
    const { irrigatorType, systemParams } = get();
    if (!irrigatorType) return;
    const plan = calculatePlan(irrigatorType, systemParams);
    set({ 
      plan, 
      volumes: Array(plan.bucketCount).fill(0),
      sections: [],
    });
  },
  
  setVolume: (index, volume) => set((state) => {
    const newVolumes = [...state.volumes];
    newVolumes[index] = volume;
    return { volumes: newVolumes };
  }),

  setVolumesArray: (volumes) => set({ volumes }),
  
  setTestConditions: (date, wind) => set({ testDate: date, windSpeed: wind }),

  setSections: (sections) => set({ sections }),

  reset: () => set({
    irrigatorType: null,
    systemParams: { ...defaultParams },
    plan: null,
    volumes: [],
    windSpeed: 0,
    sections: [],
  }),
}));
