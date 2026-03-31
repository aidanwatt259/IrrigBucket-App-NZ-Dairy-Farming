import { create } from 'zustand';
import { calculatePlan, SystemParams, Plan, SectionDefinition, PivotSection, sectionsFromPivot } from './calculations';

interface AppState {
  irrigatorType: string | null;
  systemParams: SystemParams;
  plan: Plan | null;
  volumes: number[];
  windSpeed: number;
  testDate: string;
  sections: SectionDefinition[];
  pivotSections: PivotSection[];

  setIrrigatorType: (type: string) => void;
  setSystemParams: (params: Partial<SystemParams>) => void;
  generatePlan: () => void;
  setVolume: (index: number, volume: number) => void;
  setVolumesArray: (volumes: number[]) => void;
  setTestConditions: (date: string, wind: number) => void;
  setSections: (sections: SectionDefinition[]) => void;
  setPivotSections: (pivotSections: PivotSection[]) => void;
  commitPivotSetup: (pivotSections: PivotSection[]) => void;
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
  pivotSections: [],

  setIrrigatorType: (type) => set({ irrigatorType: type }),

  setSystemParams: (params) => set((state) => ({
    systemParams: { ...state.systemParams, ...params },
  })),

  generatePlan: () => {
    const { irrigatorType, systemParams } = get();
    if (!irrigatorType) return;
    const plan = calculatePlan(irrigatorType, systemParams);
    const pivotSections = plan.pivotSections ?? [];
    set({
      plan,
      volumes: Array(plan.bucketCount).fill(0),
      sections: [],
      pivotSections,
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

  setPivotSections: (pivotSections) => set({ pivotSections }),

  // Called when user confirms the editable pivot setup and moves to data entry.
  // Updates volumes count and auto-populates SectionDefinitions.
  commitPivotSetup: (pivotSections) => {
    const total = pivotSections.reduce((sum, s) => sum + s.buckets, 0);
    const sections = sectionsFromPivot(pivotSections);
    set({
      pivotSections,
      sections,
      volumes: Array(total).fill(0),
      plan: { ...get().plan!, bucketCount: total, pivotSections },
    });
  },

  reset: () => set({
    irrigatorType: null,
    systemParams: { ...defaultParams },
    plan: null,
    volumes: [],
    windSpeed: 0,
    sections: [],
    pivotSections: [],
  }),
}));
