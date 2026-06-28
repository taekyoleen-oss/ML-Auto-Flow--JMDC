import { useEffect, useRef } from 'react';
import { CanvasModule, Connection } from '../types';

const AUTO_SAVE_KEY = 'mlAutoFlow_pipeline_autosave';
const LAST_WORK_KEY = 'mlAutoFlow_lastWork';
const LAST_WORK_META_KEY = 'mlAutoFlow_lastWork_meta';
const TTL_SECONDS = 3600;
// localStorage 마지막 작업 1회 저장 상한(문자 수). 초과 시 데이터 본문은 제외하고 구조만 보존.
const LAST_WORK_MAX_CHARS = 4_000_000;

export interface LastWorkSnapshot {
  modules: CanvasModule[];
  connections: Connection[];
  projectName: string;
  savedAt: number;
  dataStripped: boolean;
}

export interface LastWorkMeta {
  savedAt: number;
  moduleCount: number;
  dataStripped: boolean;
}

// 마지막 작업 메타데이터만 조회(버튼 라벨/활성화 판단용, 경량 키 사용 — 본문 파싱 회피).
export function getLastWorkMeta(): LastWorkMeta | null {
  try {
    const raw = localStorage.getItem(LAST_WORK_META_KEY);
    if (!raw) return null;
    const meta = JSON.parse(raw);
    if (!meta || typeof meta.savedAt !== 'number' || !meta.moduleCount) return null;
    return meta as LastWorkMeta;
  } catch (_) {
    return null;
  }
}

// 마지막 작업 전체 스냅샷을 localStorage에서 읽어온다(브라우저를 닫아도 유지).
export function loadLastWork(): LastWorkSnapshot | null {
  try {
    const raw = localStorage.getItem(LAST_WORK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.modules?.length) return null;
    return parsed as LastWorkSnapshot;
  } catch (_) {
    return null;
  }
}

interface UseAutoSaveOptions {
  modules: CanvasModule[];
  connections: Connection[];
  projectName: string;
  onRestore: (modules: CanvasModule[], connections: Connection[], projectName?: string) => void;
  onRestoreLog: (message: string) => void;
}

export function useAutoSave({
  modules,
  connections,
  projectName,
  onRestore,
  onRestoreLog,
}: UseAutoSaveOptions) {
  // 1) 세션 자동저장(새로고침 복원용): 즉시·경량, 데이터 본문 제외
  useEffect(() => {
    if (modules.length === 0 && connections.length === 0) return;
    try {
      const saveable = {
        modules: modules.map((m) => ({
          ...m,
          outputData: undefined,
          executionTime: undefined,
          parameters: {
            ...m.parameters,
            fileContent: m.parameters?.fileContent ? '__FILE_LOADED__' : undefined,
          },
        })),
        connections,
        projectName,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(saveable));
    } catch (_) {
      // sessionStorage 용량 초과 등 실패 시 무시
    }
  }, [modules, connections, projectName]);

  // 2) 마지막 작업 영구저장(localStorage): 디바운스, 데이터 본문 최대한 보존
  //    → 브라우저를 닫아도 '내 작업 > 마지막 작업 불러오기'로 복원 가능.
  //    데이터 제외 시 fileContent를 undefined로 둬(빈 값) 실행 시 source로 자동 재로드되게 한다.
  useEffect(() => {
    if (modules.length === 0 && connections.length === 0) return;
    const timer = setTimeout(() => {
      const buildSnapshot = (stripData: boolean): LastWorkSnapshot => ({
        modules: modules.map((m) => ({
          ...m,
          outputData: undefined,
          executionTime: undefined,
          parameters: stripData
            ? { ...m.parameters, fileContent: undefined }
            : { ...m.parameters },
        })) as CanvasModule[],
        connections,
        projectName,
        savedAt: Date.now(),
        dataStripped: stripData,
      });
      try {
        let snap = buildSnapshot(false);
        let json = JSON.stringify(snap);
        // 너무 크면 데이터 본문 제외(구조·파라미터는 보존 → 실행 시 source로 자동 재로드).
        if (json.length > LAST_WORK_MAX_CHARS) {
          snap = buildSnapshot(true);
          json = JSON.stringify(snap);
        }
        try {
          localStorage.setItem(LAST_WORK_KEY, json);
        } catch (_) {
          // localStorage 용량 초과: 데이터 본문 제외하고 재시도
          snap = buildSnapshot(true);
          localStorage.setItem(LAST_WORK_KEY, JSON.stringify(snap));
        }
        localStorage.setItem(
          LAST_WORK_META_KEY,
          JSON.stringify({
            savedAt: snap.savedAt,
            moduleCount: snap.modules.length,
            dataStripped: snap.dataStripped,
          })
        );
      } catch (_) {
        // 최종 실패(쿼터 등) 시 무시 — 세션 자동저장은 이미 동작 중.
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [modules, connections, projectName]);

  // 3) 마운트 시 1회 세션 복원(기존 동작 유지)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const saved = sessionStorage.getItem(AUTO_SAVE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const ageSec = (Date.now() - (parsed.savedAt || 0)) / 1000;
      if (ageSec > TTL_SECONDS) {
        sessionStorage.removeItem(AUTO_SAVE_KEY);
        return;
      }
      if (parsed.modules?.length > 0) {
        onRestore(parsed.modules, parsed.connections || [], parsed.projectName);
        onRestoreLog(
          `자동 저장된 파이프라인을 복원했습니다 (${parsed.modules.length}개 모듈). LoadData 모듈은 파일을 다시 선택해주세요.`
        );
      }
    } catch (_) {
      // 복원 실패 시 무시
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
