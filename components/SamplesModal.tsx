/**
 * Samples 모달 - life matrix flow와 동일: 목록(카드) + 데이터 입력 탭
 * ML: app_section "ML", 모델 파일 .json/.mla
 */
import React from "react";
import { XMarkIcon, PlusCircleIcon, PencilIcon } from "@heroicons/react/24/outline";
import {
  isSupabaseConfigured,
  createSampleModel,
  createSampleInputData,
  createAutoflowSample,
  updateSampleModel,
  updateAutoflowSample,
} from "../utils/supabase-samples";

interface Sample {
  id?: number | string;
  modelId?: string;
  filename: string;
  name: string;
  data: any;
  inputData?: string;
  description?: string;
  category?: string;
  appSection?: string;
  developerEmail?: string;
  // --- 메타데이터 스키마 강화 (추가 필드, 모두 선택적/하위호환) ---
  /** 분류용 태그 (작은 chip으로 표시) */
  tags?: string[];
  /** 입력 데이터 파일 경로/명 (예: verify/datasets/imports-85-hdrs.csv) */
  dataFile?: string;
  /** 사람이 읽을 수 있는 핵심 결과 요약 (예: "R²≈0.76", "Accuracy≈0.83") */
  expectedOutput?: string;
  /** 모델/태스크 요약 (예: "선형회귀 (회귀)", "K-Means (군집)") */
  modelOrTask?: string;
}

interface SamplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  samples: Array<{
    id?: number | string;
    modelId?: string;
    filename: string;
    name: string;
    data: any;
    inputData?: string;
    description?: string;
    category?: string;
    appSection?: string;
    developerEmail?: string;
    tags?: string[];
    dataFile?: string;
    expectedOutput?: string;
    modelOrTask?: string;
  }>;
  onLoadSample: (
    sampleName: string,
    filename: string,
    sampleId?: number | string
  ) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const CATEGORIES = [
  "전체",
  "Regression",
  "Classification",
  "Cluster",
  "ML기타",
] as const;

type TabType = "list" | "register";

const SamplesModal: React.FC<SamplesModalProps> = ({
  isOpen,
  onClose,
  samples,
  onLoadSample,
  onRefresh,
  isLoading = false,
}) => {
  const [selectedCategory, setSelectedCategory] =
    React.useState<string>("전체");
  const [tab, setTab] = React.useState<TabType>("list");
  const [registering, setRegistering] = React.useState(false);
  const [registerError, setRegisterError] = React.useState<string | null>(null);
  const [registerForm, setRegisterForm] = React.useState({
    modelName: "",
    modelFile: null as File | null,
    inputDataName: "",
    inputDataFile: null as File | null,
    app_section: "ML",
    category: "ML기타",
    developer_email: "",
    description: "",
  });
  const [editingSample, setEditingSample] = React.useState<Sample | null>(null);
  const [editForm, setEditForm] = React.useState({
    name: "",
    category: "ML기타",
    description: "",
    developer_email: "",
  });
  const [editSaving, setEditSaving] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setTab("list");
      setEditingSample(null);
    }
  }, [isOpen]);

  const handleEditOpen = (sample: Sample) => {
    setEditingSample(sample);
    setEditForm({
      name: sample.name,
      category: sample.category || "ML기타",
      description: sample.description || "",
      developer_email: sample.developerEmail || "",
    });
  };

  const handleEditSave = async () => {
    if (!editingSample || !editingSample.id || !editingSample.modelId) return;
    setEditSaving(true);
    try {
      await updateSampleModel(editingSample.modelId, { name: editForm.name.trim() });
      await updateAutoflowSample(String(editingSample.id), {
        category: editForm.category || null,
        description: editForm.description.trim() || null,
        developer_email: editForm.developer_email.trim() || null,
      });
      setEditingSample(null);
      onRefresh?.();
    } catch (e) {
      console.error("Edit sample failed:", e);
    } finally {
      setEditSaving(false);
    }
  };

  if (!isOpen) return null;

  const handleClose = () => {
    setTab("list");
    onClose();
  };

  const handleLoad = (sample: Sample) => {
    onLoadSample(sample.name, sample.filename, sample.id);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setRegisterError("Supabase가 설정되지 않았습니다. .env를 확인하세요.");
      return;
    }
    if (!registerForm.modelName.trim()) {
      setRegisterError("모델명을 입력하세요.");
      return;
    }
    if (!registerForm.modelFile) {
      setRegisterError("모델 파일(.json 또는 .mla)을 선택하세요.");
      return;
    }
    setRegisterError(null);
    setRegistering(true);
    try {
      const modelText = await registerForm.modelFile.text();
      let modelData: { modules?: unknown[]; connections?: unknown[] };
      try {
        modelData = JSON.parse(modelText);
      } catch {
        setRegisterError("모델 파일이 올바른 JSON이 아닙니다.");
        setRegistering(false);
        return;
      }
      const modules = Array.isArray(modelData.modules) ? modelData.modules : [];
      const connections = Array.isArray(modelData.connections) ? modelData.connections : [];
      const modelResult = await createSampleModel(registerForm.modelName.trim(), {
        modules,
        connections,
      });
      if (!modelResult) {
        setRegisterError("모델 등록에 실패했습니다.");
        setRegistering(false);
        return;
      }
      let inputDataId: string | null = null;
      if (registerForm.inputDataFile && registerForm.inputDataName.trim()) {
        const content = await registerForm.inputDataFile.text();
        const inputResult = await createSampleInputData(
          registerForm.inputDataName.trim(),
          content
        );
        if (inputResult) inputDataId = inputResult.id;
      }
      const sampleResult = await createAutoflowSample({
        app_section: "ML",
        category: registerForm.category || null,
        developer_email: registerForm.developer_email.trim() || null,
        model_id: modelResult.id,
        input_data_id: inputDataId,
        description: registerForm.description.trim() || null,
      });
      if (!sampleResult) {
        setRegisterError("샘플 등록에 실패했습니다.");
        setRegistering(false);
        return;
      }
      setRegisterForm({
        modelName: "",
        modelFile: null,
        inputDataName: "",
        inputDataFile: null,
        app_section: "ML",
        category: "ML기타",
        developer_email: "",
        description: "",
      });
      setTab("list");
      onRefresh?.();
      alert("샘플이 등록되었습니다.");
    } catch (err: any) {
      setRegisterError(err?.message || "등록 중 오류가 발생했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  const filteredSamples =
    selectedCategory === "전체"
      ? samples
      : samples.filter((sample) => sample.category === selectedCategory);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 z-10">
          <div className="p-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Samples
            </h2>
            <div className="flex items-center gap-2">
              {isSupabaseConfigured() && (
                <button
                  onClick={() => { setTab(tab === "list" ? "register" : "list"); setRegisterError(null); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === "register"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                  title="샘플 등록"
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  {tab === "list" ? "데이터 입력" : "목록 보기"}
                </button>
              )}
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {tab === "list" && (
            <div className="px-4 pb-4 flex gap-2 overflow-x-auto">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "register" && (
          <div className="flex-1 overflow-y-auto p-6">
            {!isSupabaseConfigured() ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Supabase를 설정하면 샘플 등록이 가능합니다.
              </p>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="max-w-2xl mx-auto space-y-4">
                {registerError && (
                  <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
                    {registerError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">모델명 *</label>
                  <input
                    type="text"
                    value={registerForm.modelName}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, modelName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    placeholder="예: ML Pipeline"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">모델 파일 (.json, .mla) *</label>
                  <input
                    type="file"
                    accept=".json,.mla"
                    onChange={(e) => setRegisterForm((f) => ({ ...f, modelFile: e.target.files?.[0] ?? null }))}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-purple-600 file:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">입력 데이터 이름 (선택)</label>
                  <input
                    type="text"
                    value={registerForm.inputDataName}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, inputDataName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    placeholder="예: train_data"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">입력 데이터 파일 (.csv, .txt) (선택)</label>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => setRegisterForm((f) => ({ ...f, inputDataFile: e.target.files?.[0] ?? null }))}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-purple-600 file:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카테고리</label>
                  <select
                    value={registerForm.category}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                  >
                    <option value="Regression">Regression</option>
                    <option value="Classification">Classification</option>
                    <option value="Cluster">Cluster</option>
                    <option value="ML기타">ML기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">개발자 이메일</label>
                  <input
                    type="email"
                    value={registerForm.developer_email}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, developer_email: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    placeholder="developer@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">모델 설명</label>
                  <textarea
                    value={registerForm.description}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    rows={3}
                    placeholder="모델에 대한 설명을 입력하세요"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setTab("list")}
                    className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={registering}
                    className="px-6 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50"
                  >
                    {registering ? "등록 중..." : "DB 등록"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {tab === "list" && (
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-400 text-lg">Loading samples...</div>
              </div>
            ) : !isSupabaseConfigured() ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-400 text-lg text-center max-w-md">
                  Supabase가 설정되지 않았습니다. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하면 Supabase에서 샘플을 불러올 수 있습니다.
                </div>
              </div>
            ) : filteredSamples.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-400 text-lg">
                  {selectedCategory === "전체"
                    ? "No samples available"
                    : `'${selectedCategory}' 카테고리에 샘플이 없습니다.`}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSamples.map((sample) => (
                  <div
                    key={sample.id ?? sample.filename}
                    className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-6 hover:border-purple-500 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/20 flex flex-col relative"
                  >
                    {isSupabaseConfigured() && sample.id && (sample as Sample).modelId && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleEditOpen(sample as Sample); }}
                        className="absolute top-3 right-3 p-1.5 rounded-md text-gray-500 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                        title="편집"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                    )}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 truncate pr-8">
                      {sample.name}
                    </h3>
                    <div className="space-y-3 mb-4 flex-1">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">카테고리: </span>
                        <span className="text-gray-900 dark:text-white text-sm">{sample.category || "ML기타"}</span>
                      </div>
                      {sample.developerEmail && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">개발자: </span>
                          <span className="text-gray-900 dark:text-white text-sm truncate">{sample.developerEmail}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">모델: </span>
                        <span className="text-gray-900 dark:text-white text-sm truncate">{sample.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">입력데이터: </span>
                        <span className="text-gray-900 dark:text-white text-sm">{sample.inputData || "N/A"}</span>
                      </div>
                      {(sample as Sample).modelOrTask && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">모델/태스크: </span>
                          <span className="text-gray-900 dark:text-white text-sm">{(sample as Sample).modelOrTask}</span>
                        </div>
                      )}
                      {(sample as Sample).dataFile && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">데이터 파일: </span>
                          <span className="text-gray-900 dark:text-white text-sm break-all">{(sample as Sample).dataFile}</span>
                        </div>
                      )}
                      {(sample as Sample).expectedOutput && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">예상 결과: </span>
                          <span className="text-gray-900 dark:text-white text-sm font-mono">{(sample as Sample).expectedOutput}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">모델 설명:</span>
                        <p className="text-gray-700 dark:text-gray-300 text-sm mt-1 line-clamp-3">{sample.description || "설명 없음"}</p>
                      </div>
                      {Array.isArray((sample as Sample).tags) && (sample as Sample).tags!.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(sample as Sample).tags!.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleLoad(sample as Sample)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-md transition-colors duration-200 mt-auto"
                    >
                      모델 실행
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {editingSample && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingSample(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">샘플 편집</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                  placeholder="모델명"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카테고리</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                >
                  <option value="Regression">Regression</option>
                  <option value="Classification">Classification</option>
                  <option value="Cluster">Cluster</option>
                  <option value="ML기타">ML기타</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">설명</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="모델 설명"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">개발자 이메일</label>
                <input
                  type="email"
                  value={editForm.developer_email}
                  onChange={(e) => setEditForm((f) => ({ ...f, developer_email: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                  placeholder="developer@example.com"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSample(null)}
                  className="flex-1 px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="flex-1 px-4 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {editSaving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SamplesModal;
