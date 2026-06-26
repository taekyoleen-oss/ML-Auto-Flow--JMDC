/**
 * Supabase autoflow_samples 기반 샘플 API (ML 앱: app_section = "ML")
 */

import { supabase, isSupabaseConfigured } from "../lib/supabase";

export { isSupabaseConfigured };

const APP_SECTION = "ML";
// [JMDC 전용] JMDC 앱 샘플 메뉴는 공유(ML) + JMDC 전용(JMDC) 섹션을 모두 표시한다.
// (베이스 ML 앱은 "ML"만 조회하므로 JMDC 전용 샘플은 ML 메뉴에서 숨겨진다.)
const LIST_SECTIONS = ["ML", "JMDC"];

export interface SampleModelRow {
  id: string;
  name: string;
  file_content: unknown;
  created_at?: string;
}

export interface SampleInputDataRow {
  id: string;
  name: string;
  content: string | null;
  created_at?: string;
}

export interface AutoflowSampleRow {
  id: string;
  app_section: string;
  category: string | null;
  developer_email: string | null;
  model_id: string;
  input_data_id: string | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AutoflowSampleListItem {
  id: string;
  model_id?: string;
  app_section: string;
  category: string | null;
  developer_email: string | null;
  model_name: string;
  input_data_name: string | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AutoflowSampleWithContent {
  id: string;
  app_section: string;
  category: string | null;
  developer_email: string | null;
  model_name: string;
  input_data_name: string | null;
  description: string | null;
  file_content: { modules: unknown[]; connections: unknown[] };
  input_data_content: string | null;
}

/** 목록 조회 (JMDC 앱: 공유 ML + JMDC 전용 섹션 모두) */
export async function fetchAutoflowSamplesList(): Promise<AutoflowSampleListItem[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  let query = supabase
    .from("autoflow_samples")
    .select(
      `
      id,
      model_id,
      app_section,
      category,
      developer_email,
      description,
      created_at,
      updated_at,
      sample_models!inner ( name ),
      sample_input_data ( name )
    `
    )
    .in("app_section", LIST_SECTIONS)
    .order("created_at", { ascending: false });

  const { data: rows, error } = await query;

  if (error) {
    console.error("[Supabase] fetchAutoflowSamplesList error:", error);
    return [];
  }

  return (rows || []).map((r: any) => ({
    id: r.id,
    model_id: r.model_id,
    app_section: r.app_section ?? APP_SECTION,
    category: r.category,
    developer_email: r.developer_email,
    description: r.description,
    created_at: r.created_at,
    updated_at: r.updated_at,
    model_name: r.sample_models?.name ?? "",
    input_data_name: r.sample_input_data?.name ?? null,
  }));
}

/** 단건 조회 (실행용) */
export async function fetchAutoflowSampleById(
  id: string
): Promise<AutoflowSampleWithContent | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data: sample, error: sampleError } = await supabase
    .from("autoflow_samples")
    .select(
      `
      id,
      app_section,
      category,
      developer_email,
      description,
      model_id,
      input_data_id,
      sample_models!inner ( name, file_content ),
      sample_input_data ( name, content )
    `
    )
    .eq("id", id)
    .single();

  if (sampleError || !sample) {
    console.error("[Supabase] fetchAutoflowSampleById error:", sampleError);
    return null;
  }

  const model = (sample as any).sample_models;
  const inputData = (sample as any).sample_input_data;
  const fileContent = model?.file_content;
  const modules = Array.isArray(fileContent?.modules) ? fileContent.modules : [];
  const connections = Array.isArray(fileContent?.connections) ? fileContent.connections : [];

  return {
    id: sample.id,
    app_section: sample.app_section ?? APP_SECTION,
    category: sample.category,
    developer_email: sample.developer_email,
    model_name: model?.name ?? "",
    input_data_name: inputData?.name ?? null,
    description: sample.description,
    file_content: { modules, connections },
    input_data_content: inputData?.content ?? null,
  };
}

export async function createSampleModel(
  name: string,
  file_content: { modules: unknown[]; connections: unknown[] }
): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data, error } = await supabase
    .from("sample_models")
    .insert({ name, file_content })
    .select("id")
    .single();
  if (error) {
    console.error("[Supabase] createSampleModel error:", error);
    return null;
  }
  return data ? { id: data.id } : null;
}

export async function createSampleInputData(
  name: string,
  content: string
): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data, error } = await supabase
    .from("sample_input_data")
    .insert({ name, content })
    .select("id")
    .single();
  if (error) {
    console.error("[Supabase] createSampleInputData error:", error);
    return null;
  }
  return data ? { id: data.id } : null;
}

export async function createAutoflowSample(params: {
  app_section?: string;
  category?: string;
  developer_email?: string;
  model_id: string;
  input_data_id?: string | null;
  description?: string;
}): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data, error } = await supabase
    .from("autoflow_samples")
    .insert({
      app_section: params.app_section ?? APP_SECTION,
      category: params.category ?? null,
      developer_email: params.developer_email ?? null,
      model_id: params.model_id,
      input_data_id: params.input_data_id ?? null,
      description: params.description ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[Supabase] createAutoflowSample error:", error);
    return null;
  }
  return data ? { id: data.id } : null;
}

/** 모델 이름 수정 (sample_models.name) */
export async function updateSampleModel(
  modelId: string,
  updates: { name?: string }
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;
  if (!updates.name?.trim()) return true;
  const { error } = await supabase
    .from("sample_models")
    .update({ name: updates.name.trim() })
    .eq("id", modelId);
  if (error) {
    console.error("[Supabase] updateSampleModel error:", error);
    return false;
  }
  return true;
}

export async function updateAutoflowSample(
  id: string,
  updates: {
    app_section?: string;
    category?: string;
    developer_email?: string;
    description?: string;
    model_id?: string;
    input_data_id?: string | null;
  }
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;
  const { error } = await supabase.from("autoflow_samples").update(updates).eq("id", id);
  if (error) {
    console.error("[Supabase] updateAutoflowSample error:", error);
    return false;
  }
  return true;
}

export async function deleteAutoflowSample(id: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;
  const { error } = await supabase.from("autoflow_samples").delete().eq("id", id);
  if (error) {
    console.error("[Supabase] deleteAutoflowSample error:", error);
    return false;
  }
  return true;
}
