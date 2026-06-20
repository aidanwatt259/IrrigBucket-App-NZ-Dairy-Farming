import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  OperationData,
  Plan,
  SectionDefinition,
  SystemParams,
  calculatePlan,
  sectionsFromPivot,
} from '@/lib/calculations';
import {
  initSync,
  listSavedReports,
  saveReport as engineSaveReport,
  deleteReport as engineDeleteReport,
} from '@/lib/sync/syncEngine';

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
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshSeq = useRef(0);
  const refreshSavedReports = useCallback(async () => {
    const seq = ++refreshSeq.current;
    const reports = await listSavedReports();
    // Ignore a stale refresh that a newer one has already superseded, so an
    // out-of-order completion can't overwrite fresher state.
    if (seq !== refreshSeq.current) return;
    setState(prev => ({ ...prev, savedReports: reports }));
  }, []);

  useEffect(() => {
    void (async () => {
      await initSync();
      await refreshSavedReports();
    })();
  }, [refreshSavedReports]);

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
    const prev = stateRef.current;
    if (!prev.plan) return null;
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
    // Optimistic insert; durable persistence + enqueue happen asynchronously,
    // then we reconcile from the store to keep ordering authoritative.
    setState(p => ({ ...p, savedReports: [report, ...p.savedReports] }));
    void (async () => {
      await engineSaveReport(report);
      await refreshSavedReports();
    })();
    return report;
  }, [refreshSavedReports]);

  const deleteReport = useCallback((id: string) => {
    setState(p => ({ ...p, savedReports: p.savedReports.filter(r => r.id !== id) }));
    void (async () => {
      await engineDeleteReport(id);
      await refreshSavedReports();
    })();
  }, [refreshSavedReports]);

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
