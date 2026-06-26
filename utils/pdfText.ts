// PDF 텍스트 추출 — pdfjs-dist(브라우저)로 페이지별 텍스트를 합쳐 반환.
// 모델 분석보고서 모듈의 사용자 추가정보(PDF) 입력을 위한 유틸.
// 실패 시 절대 throw하지 않고 빈 문자열을 반환한다(보고서 생성이 중단되지 않게).

let workerConfigured = false;

async function loadPdfjs(): Promise<any> {
  // 동적 import로 초기 번들에서 분리(보고서 모듈 사용 시에만 로드).
  const pdfjs: any = await import("pdfjs-dist");
  if (!workerConfigured) {
    try {
      // Vite/번들러가 워커 파일을 자산으로 해석하도록 import.meta.url 기준 URL을 사용한다.
      // (?url 접미사는 tsc가 모르므로 사용하지 않는다.)
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    } catch {
      // 워커 URL 해석 실패 시: workerSrc 미설정으로도 fake worker(메인 스레드)에서 동작 가능.
    }
    workerConfigured = true;
  }
  return pdfjs;
}

/**
 * PDF 파일에서 텍스트를 추출한다. 페이지 사이는 줄바꿈 2개로 구분.
 * @param file 사용자가 업로드한 PDF File 객체
 * @param maxChars 추출 텍스트 상한(과도한 프롬프트 방지). 기본 20000자.
 */
export async function extractPdfText(
  file: File,
  maxChars = 20000
): Promise<string> {
  try {
    const pdfjs = await loadPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const parts: string[] = [];
    let total = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const pageText = (content.items || [])
        .map((it: any) => (typeof it.str === "string" ? it.str : ""))
        .join(" ")
        .replace(/[ \t]+/g, " ")
        .trim();
      if (pageText) {
        parts.push(pageText);
        total += pageText.length;
      }
      if (total >= maxChars) break;
    }
    const text = parts.join("\n\n").slice(0, maxChars);
    return text;
  } catch (err) {
    console.warn("[extractPdfText] PDF 텍스트 추출 실패:", err);
    return "";
  }
}
