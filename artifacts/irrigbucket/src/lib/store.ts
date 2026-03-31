import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  calculatePlan, SystemParams, Plan,
  SectionDefinition, PivotSection,
  OperationData, sectionsFromPivot,
} from './calculations';

interface AppState {
  irrigatorType: string | null;
  systemParams: SystemParams;
  plan: Plan | null;
  volumes: number[];
  windSpeed: number;
  testDate: string;
  sections: SectionDefinition[];
  pivotSections: PivotSection[];
  operationData: OperationData;

  setIrrigatorType: (type: string) => void;
  setSystemParams: (params: Partial<SystemParams>) => void;
  generatePlan: () => void;
  setVolume: (index: number, volume: number) => void;
  setVolumesArray: (volumes: number[]) => void;
  setTestConditions: (date: string, wind: number) => void;
  setSections: (sections: SectionDefinition[]) => void;
  setPivotSections: (sections: PivotSection[]) => void;
  setOperationData: (data: Partial<OperationData>) => void;
  commitPivotSetup: (pivotSections: PivotSection[]) => void;
  reset: () => void;
}

const defaultParams: SystemParams = { diameter: 250, targetDepth: 15 };

const defaultState = {
  irrigatorType: null as string | null,
  systemParams: { ...defaultParams },
  plan: null as Plan | null,
  volumes: [] as number[],
  windSpeed: 0,
  testDate: new Date().toISOString().split('T')[0],
  sections: [] as SectionDefinition[],
  pivotSections: [] as PivotSection[],
  operationData: {} as OperationData,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...defaultState,

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
        const v = [...state.volumes];
        v[index] = volume;
        return { volumes: v };
      }),

      setVolumesArray: (volumes) => set({ volumes }),

      setTestConditions: (date, wind) => set({ testDate: date, windSpeed: wind }),

      setSections: (sections) => set({ sections }),

      setPivotSections: (pivotSections) => set({ pivotSections }),

      setOperationData: (data) => set((state) => ({
        operationData: { ...state.operationData, ...data },
      })),

      commitPivotSetup: (pivotSections) => {
        const total = pivotSections
          .filter(s => !s.isExcluded)
          .reduce((sum, s) => sum + s.buckets, 0);
        const sections = sectionsFromPivot(pivotSections);
        set({
          pivotSections,
          sections,
          volumes: Array(total).fill(0),
          plan: { ...get().plan!, bucketCount: total, pivotSections },
        });
      },

      reset: () => set({
        ...defaultState,
        testDate: new Date().toISOString().split('T')[0],
      }),
    }),
    {
      name: 'irrigbucket-draft',
      partialize: (state) => ({
        irrigatorType: state.irrigatorType,
        systemParams: state.systemParams,
        plan: state.plan,
        volumes: state.volumes,
        windSpeed: state.windSpeed,
        testDate: state.testDate,
        sections: state.sections,
        pivotSections: state.pivotSections,
        operationData: state.operationData,
      }),
    },
  ),
);
