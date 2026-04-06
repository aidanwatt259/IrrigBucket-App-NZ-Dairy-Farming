import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  OperationData,
  Plan,
  SectionDefinition,
  SystemParams,
  calculatePlan,
  sectionsFromPivot,
} from '@/lib/calculations';

const STORAGE_KEY = 'irrigbucket_wizard_state';

export interface WizardState {
  irrigatorType: string | null;
  systemParams: SystemParams;
  operationData: OperationData;
  plan: Plan | null;
  volumes: number[];
  testDate: string;
  windSpeed: number | null;
  sections: SectionDefinition[];
  savedReports: SavedReport[];
}

export interface SavedReport {
  id: string;
  savedAt: string;
  irrigatorType: string | null;
  systemParams: SystemParams;
  plan: Plan;
  volumes: number[];
  testDate: string;
  windSpeed: number | null;
  sections: SectionDefinition[];
  operationData: OperationData;
}

interface WizardContextValue extends WizardState {
  setIrrigatorType: (type: string) => void;
  setSystemParams: (params: Partial<SystemParams>) => void;
  setOperationData: (data: Partial<OperationData>) => void;
  generatePlan: () => void;
  setVolume: (index: number, value: number) => void;
  setTestConditions: (date: string, windSpeed: number | null) => void;
  setSections: (sections: SectionDefinition[]) => void;
  reset: () => void;
  saveCurrentReport: () => SavedReport | null;
  deleteReport: (id: string) => void;
}

const defaultParams: SystemParams = {
  diameter: 250,
  targetDepth: 20,
  armLength: 400,
  spans: 8,
  hasEndGun: 'No',
  machineWidth: 100,
  podSpacing: 15,
  podsPerLateral: 8,
  gunRadius: 40,
  laneSpacing: 60,
  sprinklerSpacing: 18,
  boomWidth: 30,
  nozzleSpacing: 2,
};

const initialState: WizardState = {
  irrigatorType: null,
  systemParams: defaultParams,
  operationData: {},
  plan: null,
  volumes: [],
  testDate: new Date().toISOString().split('T')[0],
  windSpeed: null,
  sections: [],
  savedReports: [],
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WizardState>(initialState);
  const hydrated = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<WizardState>;
          setState(prev => ({
            ...prev,
            savedReports: saved.savedReports || [],
          }));
        } catch {}
      }
      hydrated.current = true;
    });
  }, []);

  const persist = useCallback((nextState: WizardState) => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ savedReports: nextState.savedReports }));
  }, []);

  const setIrrigatorType = useCallback((type: string) => {
    setState(prev => ({ ...prev, irrigatorType: type }));
  }, []);

  const setSystemParams = useCallback((params: Partial<SystemParams>) => {
    setState(prev => ({ ...prev, systemParams: { ...prev.systemParams, ...params } }));
  }, []);

  const setOperationData = useCallback((data: Partial<OperationData>) => {
    setState(prev => ({ ...prev, operationData: { ...prev.operationData, ...data } }));
  }, []);

  const generatePlan = useCallback(() => {
    setState(prev => {
      if (!prev.irrigatorType) return prev;
      const plan = calculatePlan(prev.irrigatorType, prev.systemParams);
      const volumes = Array(plan.bucketCount).fill(0) as number[];
      const sections: SectionDefinition[] = plan.pivotSections
        ? sectionsFromPivot(plan.pivotSections)
        : [{ name: 'All Buckets', fromBucket: 1, toBucket: plan.bucketCount }];
      return { ...prev, plan, volumes, sections };
    });
  }, []);

  const setVolume = useCallback((index: number, value: number) => {
    setState(prev => {
      const next = [...prev.volumes];
      next[index] = value;
      return { ...prev, volumes: next };
    });
  }, []);

  const setTestConditions = useCallback((date: string, windSpeed: number | null) => {
    setState(prev => ({ ...prev, testDate: date, windSpeed }));
  }, []);

  const setSections = useCallback((sections: SectionDefinition[]) => {
    setState(prev => ({ ...prev, sections }));
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({ ...initialState, savedReports: prev.savedReports }));
  }, []);

  const saveCurrentReport = useCallback((): SavedReport | null => {
    let saved: SavedReport | null = null;
    setState(prev => {
      if (!prev.plan) return prev;
      const report: SavedReport = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        savedAt: new Date().toISOString(),
        irrigatorType: prev.irrigatorType,
        systemParams: prev.systemParams,
        plan: prev.plan,
        volumes: prev.volumes,
        testDate: prev.testDate,
        windSpeed: prev.windSpeed,
        sections: prev.sections,
        operationData: prev.operationData,
      };
      saved = report;
      const next = { ...prev, savedReports: [report, ...prev.savedReports] };
      persist(next);
      return next;
    });
    return saved;
  }, [persist]);

  const deleteReport = useCallback((id: string) => {
    setState(prev => {
      const next = { ...prev, savedReports: prev.savedReports.filter(r => r.id !== id) };
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <WizardContext.Provider value={{
      ...state,
      setIrrigatorType,
      setSystemParams,
      setOperationData,
      generatePlan,
      setVolume,
      setTestConditions,
      setSections,
      reset,
      saveCurrentReport,
      deleteReport,
    }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within WizardProvider');
  return ctx;
}
