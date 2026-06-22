import React, { useState, useMemo } from 'react';
import { CodeBracketIcon, ClipboardIcon, CheckIcon } from './icons';
import { CanvasModule, Connection } from '../types';
import { generateFullPipelineCode } from '../utils/generatePipelineCode';
import { generateScoringCode, inspectScoringPipeline, type ScoringFramework } from '../utils/scoringExport';
import { generateRetrainSnapshotCode, inspectRetrainPipeline } from '../utils/retrainExport';
import { useTheme } from '../contexts/ThemeContext';
import { runPythonWithOutputWorker, cancelWorkerRun, setWorkerStatusCallback } from '../utils/pyodideWorkerBridge';
import { AdvancedOnly, ADVANCED_BTN_DIM, AdvancedLockBadge } from '../contexts/AdvancedFeatureContext';

interface PipelineCodePanelProps {
    modules: CanvasModule[];
    connections: Connection[];
    isVisible: boolean;
    onToggle: () => void;
}

const TIPS = [
    {
        icon: '▶',
        title: '실행 전 준비',
        desc: '캔버스에서 각 모듈을 먼저 실행해주세요. LoadData 모듈이 실행되면 데이터가 코드에 자동 주입되어 Pyodide 환경에서도 실행됩니다.',
    },
    {
        icon: '💻',
        title: 'Jupyter / 스크립트 실행',
        desc: '복사 버튼으로 코드를 복사하여 Jupyter Notebook이나 .py 파일에 붙여넣으면 동일한 결과를 얻을 수 있습니다.',
    },
    {
        icon: '⚡',
        title: '첫 실행 시 초기화',
        desc: 'Python 환경(Pyodide + pandas, scikit-learn)을 처음 로드할 때 30~60초 소요됩니다. 이후 실행은 즉시 처리됩니다.',
    },
    {
        icon: '🔄',
        title: '단계별 실행',
        desc: '전체 파이프라인 대신 각 모듈의 ▶ 버튼을 클릭하면 해당 모듈만 단계적으로 실행하고 결과를 바로 확인할 수 있습니다.',
    },
    {
        icon: '📋',
        title: '코드 구조',
        desc: '각 [모듈 N/전체] 섹션이 하나의 처리 단계입니다. 섹션 사이의 data_xxx 변수가 모듈 간 데이터를 연결합니다.',
    },
];

export const PipelineCodePanel: React.FC<PipelineCodePanelProps> = ({
    modules,
    connections,
    isVisible,
    onToggle
}) => {
    const { theme } = useTheme();
    const [copied, setCopied] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [output, setOutput] = useState('');
    const [outputError, setOutputError] = useState<string | null>(null);
    const [showOutput, setShowOutput] = useState(false);
    const [showTips, setShowTips] = useState(false);
    const [tracebackExpanded, setTracebackExpanded] = useState(false);

    // 스코어링 코드 내보내기 (작업 6) — 전체 코드와는 별개의 '추가' 보기
    const [showScoring, setShowScoring] = useState(false);
    const [scoringFramework, setScoringFramework] = useState<ScoringFramework>('fastapi');
    const [scoringCopied, setScoringCopied] = useState(false);
    const scoringInfo = useMemo(
        () => inspectScoringPipeline(modules, connections),
        [modules, connections]
    );
    const scoringCode = useMemo(
        () => generateScoringCode(modules, connections, scoringFramework),
        [modules, connections, scoringFramework]
    );
    const handleCopyScoring = async () => {
        try {
            await navigator.clipboard.writeText(scoringCode);
            setScoringCopied(true);
            setTimeout(() => setScoringCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy scoring code:', err);
        }
    };

    // 모델 버전 스냅샷 내보내기 (재학습/지속학습 3-7) — 가산적 '추가' 보기
    const [showRetrain, setShowRetrain] = useState(false);
    const [versionLabel, setVersionLabel] = useState('v1');
    const [dataSourceRef, setDataSourceRef] = useState('');
    const [retrainCopied, setRetrainCopied] = useState(false);
    const retrainInfo = useMemo(
        () => inspectRetrainPipeline(modules, connections),
        [modules, connections]
    );
    const retrainCode = useMemo(
        () => generateRetrainSnapshotCode(modules, connections, { versionLabel, dataSourceRef }),
        [modules, connections, versionLabel, dataSourceRef]
    );
    const handleCopyRetrain = async () => {
        try {
            await navigator.clipboard.writeText(retrainCode);
            setRetrainCopied(true);
            setTimeout(() => setRetrainCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy retrain snapshot code:', err);
        }
    };

    // 표시용 코드 (pd.read_csv 포함 - 외부 실행 가능한 형태)
    const [codeGenError, setCodeGenError] = React.useState<string | null>(null);
    const fullPipelineCode = useMemo(() => {
        if (modules.length === 0) {
            setCodeGenError(null);
            return '# 파이프라인이 비어있습니다. 모듈을 추가해주세요.';
        }
        try {
            const code = generateFullPipelineCode(modules, connections, false);
            setCodeGenError(null);
            return code;
        } catch (e: any) {
            const msg = e?.message || String(e);
            setCodeGenError(msg);
            return `# ❌ 코드 생성 실패\n# ${msg.split('\n').join('\n# ')}`;
        }
    }, [modules, connections]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(fullPipelineCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    const handleExportNotebook = () => {
        const lines = fullPipelineCode.split('\n');
        const notebook = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {
                kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
                language_info: { name: 'python', version: '3.10.0' },
            },
            cells: [
                {
                    cell_type: 'markdown',
                    metadata: {},
                    source: ['# ML Auto Flow Pipeline\n', '> Generated by ML Auto Flow — edit and run each cell to reproduce results.'],
                },
                {
                    cell_type: 'code',
                    execution_count: null,
                    metadata: {},
                    outputs: [],
                    source: lines.map((l, i) => (i < lines.length - 1 ? l + '\n' : l)),
                },
            ],
        };
        const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pipeline.ipynb';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const [workerStatus, setWorkerStatus] = useState<string>('');

    const handleRun = async () => {
        if (codeGenError) {
            setShowOutput(true);
            setOutputError(`코드 생성 오류로 실행할 수 없습니다:\n${codeGenError}`);
            return;
        }
        setIsRunning(true);
        setOutput('');
        setOutputError(null);
        setShowOutput(true);
        setWorkerStatus('');
        setWorkerStatusCallback((status, _progress) => setWorkerStatus(status));
        try {
            const executionCode = generateFullPipelineCode(modules, connections, true);
            // Worker를 사용해 백그라운드에서 실행 — UI 스레드를 블로킹하지 않음
            const { stdout, error } = await runPythonWithOutputWorker(executionCode);
            setOutput(stdout || '(출력 없음)');
            setOutputError(error);
        } catch (e: any) {
            if (e.message !== '실행이 취소되었습니다.') {
                setOutputError(e.message);
            } else {
                setOutputError('⛔ 실행이 취소되었습니다.');
            }
        } finally {
            setIsRunning(false);
            setWorkerStatus('');
            setWorkerStatusCallback(null);
        }
    };

    const handleCancel = () => {
        cancelWorkerRun();
    };

    const hasUnrunLoadData = modules.some(
        (m) => m.type === 'LoadData' && !m.outputData
    );

    return (
        <div
            className={`absolute top-0 right-0 h-full bg-white dark:bg-gray-800 border-l border-gray-300 dark:border-gray-700 z-10 transition-transform duration-300 ease-in-out flex flex-col ${
                isVisible ? 'translate-x-0' : 'translate-x-full'
            }`}
            style={{ width: '420px' }}
        >
            {/* 헤더 */}
            <div className="flex items-center justify-between p-3 border-b border-gray-300 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <CodeBracketIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">전체 파이프라인 코드</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTips((v) => !v)}
                        className={`p-1.5 rounded-md transition-colors text-xs font-medium ${
                            showTips
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                        title="사용 안내"
                    >
                        ?
                    </button>
                    <button
                        onClick={handleCopy}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                        title="코드 복사 (외부 Python 실행용)"
                    >
                        {copied ? (
                            <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                            <ClipboardIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        )}
                    </button>
                    <button
                        onClick={handleExportNotebook}
                        disabled={modules.length === 0 || !!codeGenError}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Jupyter Notebook (.ipynb)으로 내보내기"
                    >
                        <span>📓</span>
                        <span>.ipynb</span>
                    </button>
                    <AdvancedOnly>
                        <button
                            onClick={() => { setShowScoring((v) => !v); setShowRetrain(false); }}
                            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                showScoring
                                    ? 'bg-teal-600 text-white hover:bg-teal-700'
                                    : 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800/60'
                            } ${ADVANCED_BTN_DIM}`}
                            title="배포용 스코어링 코드(joblib + FastAPI/Flask) 내보내기 (고급기능)"
                        >
                            <AdvancedLockBadge className="text-[10px] leading-none" />
                            <span>🚀</span>
                            <span>스코어링</span>
                        </button>
                    </AdvancedOnly>
                    <AdvancedOnly>
                        <button
                            onClick={() => { setShowRetrain((v) => !v); setShowScoring(false); }}
                            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                showRetrain
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/60'
                            } ${ADVANCED_BTN_DIM}`}
                            title="모델 버전 스냅샷(joblib + 버전 메타 JSON) 내보내기 — 재학습/지속학습 (고급기능)"
                        >
                            <AdvancedLockBadge className="text-[10px] leading-none" />
                            <span>🗂️</span>
                            <span>모델 버전</span>
                        </button>
                    </AdvancedOnly>
                    {isRunning ? (
                        <button
                            onClick={handleCancel}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors"
                            title="실행 취소 (Worker 종료)"
                        >
                            <svg className="w-3 h-3 animate-spin mr-0.5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            취소
                        </button>
                    ) : (
                        <button
                            onClick={handleRun}
                            disabled={modules.length === 0}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-medium rounded-md transition-colors"
                            title="백그라운드 Worker에서 실행 — UI 반응 유지"
                        >
                            ▶ 실행
                        </button>
                    )}
                </div>
            </div>

            {/* 사용 안내 패널 */}
            {showTips && (
                <div className="flex-shrink-0 border-b border-gray-300 dark:border-gray-700 bg-blue-50 dark:bg-blue-950/40 p-3 overflow-y-auto max-h-56">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">사용 안내</p>
                    <div className="space-y-2">
                        {TIPS.map((tip, i) => (
                            <div key={i} className="flex gap-2">
                                <span className="text-xs flex-shrink-0 w-4">{tip.icon}</span>
                                <div>
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{tip.title}: </span>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">{tip.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 코드 생성 오류 배너 (순환 의존성 등) */}
            {codeGenError && (
                <div className="flex-shrink-0 px-3 py-2 bg-red-50 dark:bg-red-900/30 border-b border-red-300 dark:border-red-700">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-0.5">❌ 파이프라인 오류</p>
                    <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{codeGenError}</p>
                </div>
            )}

            {/* LoadData 미실행 경고 */}
            {!codeGenError && hasUnrunLoadData && (
                <div className="flex-shrink-0 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-700">
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        ⚠️ LoadData 모듈을 먼저 실행해야 Pyodide에서 데이터를 읽을 수 있습니다.
                    </p>
                </div>
            )}

            {/* 모델 버전 스냅샷 내보내기 패널 (재학습/지속학습 3-7, 고급기능) */}
            {showRetrain ? (
                <AdvancedOnly>
                    <div className="flex-1 overflow-auto p-3 min-h-0 flex flex-col">
                        <div className="flex-shrink-0 mb-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                    🗂️ 모델 버전 스냅샷
                                </span>
                                <button
                                    onClick={handleCopyRetrain}
                                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    title="모델 버전 스냅샷 코드 복사"
                                >
                                    {retrainCopied ? (
                                        <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    ) : (
                                        <ClipboardIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                    )}
                                </button>
                            </div>
                            {/* 지속학습 워크플로 안내 */}
                            <div className="px-2 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-md mb-2">
                                <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 mb-0.5">지속학습 워크플로</p>
                                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 leading-relaxed">
                                    ① 파이프라인 불러오기 → ② LoadData 소스 교체(파일/URL) → ③ 다시 실행해 재학습 → ④ 아래 코드로 새 모델 버전 저장
                                </p>
                            </div>
                            {/* 버전 라벨 / 데이터 소스 입력 (타임스탬프 자동생성 없음 — 재현성) */}
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">버전</label>
                                <input
                                    type="text"
                                    value={versionLabel}
                                    onChange={(e) => setVersionLabel(e.target.value)}
                                    placeholder="v1"
                                    className="w-20 px-2 py-1 text-[11px] font-mono rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">데이터 소스</label>
                                <input
                                    type="text"
                                    value={dataSourceRef}
                                    onChange={(e) => setDataSourceRef(e.target.value)}
                                    placeholder={retrainInfo.dataSourceRef || '(LoadData 자동 추론)'}
                                    className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            {!retrainInfo.available ? (
                                <div className="px-2 py-1.5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md mb-2">
                                    <p className="text-[11px] text-yellow-700 dark:text-yellow-300">
                                        ⚠️ {retrainInfo.reason}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                                    학습 모델 → joblib 버전 저장 + 버전 메타(JSON) + 로드/비교 코드를 생성합니다. 버전 라벨은 자동 타임스탬프가 아닌 입력값을 사용합니다.
                                </p>
                            )}
                        </div>
                        <pre className="flex-1 bg-gray-100 dark:bg-gray-900 p-3 rounded-md overflow-auto text-xs font-mono text-gray-900 dark:text-gray-200 whitespace-pre-wrap min-h-0">
                            <code>{retrainCode}</code>
                        </pre>
                    </div>
                </AdvancedOnly>
            ) : showScoring ? (
                <AdvancedOnly>
                    <div className="flex-1 overflow-auto p-3 min-h-0 flex flex-col">
                        <div className="flex-shrink-0 mb-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1">
                                    🚀 배포용 스코어링 코드
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex rounded-md overflow-hidden border border-teal-300 dark:border-teal-700">
                                        {(['fastapi', 'flask'] as ScoringFramework[]).map((fw) => (
                                            <button
                                                key={fw}
                                                onClick={() => setScoringFramework(fw)}
                                                className={`px-2 py-1 text-[10px] font-semibold transition-colors ${
                                                    scoringFramework === fw
                                                        ? 'bg-teal-600 text-white'
                                                        : 'bg-white dark:bg-gray-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/40'
                                                }`}
                                            >
                                                {fw === 'fastapi' ? 'FastAPI' : 'Flask'}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleCopyScoring}
                                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                                        title="스코어링 코드 복사"
                                    >
                                        {scoringCopied ? (
                                            <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        ) : (
                                            <ClipboardIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            {!scoringInfo.available ? (
                                <div className="px-2 py-1.5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md mb-2">
                                    <p className="text-[11px] text-yellow-700 dark:text-yellow-300">
                                        ⚠️ {scoringInfo.reason}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                                    학습 모델 → joblib 저장 + {scoringFramework === 'fastapi' ? 'FastAPI' : 'Flask'} 엔드포인트 + 요청/응답 JSON 샘플을 생성합니다.
                                </p>
                            )}
                        </div>
                        <pre className="flex-1 bg-gray-100 dark:bg-gray-900 p-3 rounded-md overflow-auto text-xs font-mono text-gray-900 dark:text-gray-200 whitespace-pre-wrap min-h-0">
                            <code>{scoringCode}</code>
                        </pre>
                    </div>
                </AdvancedOnly>
            ) : (
                /* 코드 영역 */
                <div className="flex-1 overflow-auto p-3 min-h-0">
                    <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-md overflow-x-auto text-xs font-mono text-gray-900 dark:text-gray-200 whitespace-pre-wrap">
                        <code>{fullPipelineCode}</code>
                    </pre>
                </div>
            )}

            {/* 출력 영역 */}
            {showOutput && (
                <div className="flex-shrink-0 border-t border-gray-300 dark:border-gray-700">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-700">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">실행 결과</span>
                        <button
                            onClick={() => setShowOutput(false)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                            지우기
                        </button>
                    </div>
                    <div className="h-48 overflow-auto bg-gray-950 p-3 font-mono text-xs">
                        {isRunning && (
                            <p className="text-yellow-400">
                                {workerStatus || '실행 중... (처음 실행 시 Python 환경 초기화로 30~60초 소요)'}
                                <span className="ml-1 text-gray-500 text-[10px]">— UI는 계속 반응합니다</span>
                            </p>
                        )}
                        {output && (
                            <pre className="text-green-400 whitespace-pre-wrap">{output}</pre>
                        )}
                        {outputError && (() => {
                            // traceback과 에러 메시지 분리 (Traceback 이후가 traceback)
                            const tbIdx = outputError.indexOf('Traceback (most recent call last)');
                            const hasTraceback = tbIdx !== -1;
                            // 마지막 에러 라인 (RuntimeError: ... 같은 부분)
                            const lines = outputError.trimEnd().split('\n');
                            const lastLines = lines.filter(l => l.trim() && !l.startsWith(' '));
                            const summary = hasTraceback
                                ? lines[lines.length - 1]  // 마지막 줄: 에러 요약
                                : outputError;
                            const fullTrace = outputError;
                            return (
                                <div className="mt-2">
                                    <div className="text-red-400 font-semibold text-xs mb-1">❌ {summary}</div>
                                    {hasTraceback && (
                                        <button
                                            onClick={() => setTracebackExpanded(v => !v)}
                                            className="text-xs text-red-300 underline mb-1 hover:text-red-100 transition-colors"
                                        >
                                            {tracebackExpanded ? '▲ Traceback 접기' : '▼ Traceback 펼치기'}
                                        </button>
                                    )}
                                    {(tracebackExpanded || !hasTraceback) && (
                                        <pre className="text-red-300 whitespace-pre-wrap text-xs border-l-2 border-red-700 pl-2">{fullTrace}</pre>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};
