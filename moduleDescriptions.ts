// Static descriptions shown by the 설명(View Details) popup on each module.
// 키워드: 역할(무엇을), 언제 사용, 입력(소비 데이터), 결과(산출물),
//        파라미터, 권장 연결(앞→뒤 모듈), 흔한 오류, 비고.
// 신규 JMDC 모듈(J1~J7)은 상세하게, 기존 모듈은 핵심 + 실용 가이드 위주로 작성.

import { ModuleType } from "./types";

export interface ModuleDescription {
  title: string;
  category?: string;
  /** 🔰 초보자용 쉬운 설명 — 비유·일상어로 이 모듈이 무엇을 하는지(전문용어 최소화).
   *  모달 최상단에 강조 표시된다. 처음 보는 사용자가 한눈에 이해하도록 작성. */
  beginner?: string;
  /** 📊 분석 방법 — 이 모듈이 내부적으로 어떤 분석/계산/알고리즘을 수행하는지 글로 풀어 설명
   *  (라이브러리·수식 언급 가능하되 평이하게). 초보자가 "왜/어떻게"를 이해하도록. */
  analysisMethod?: string;
  role: string;
  input: string;
  output: string;
  parameters?: string;
  /** 언제 이 모듈을 쓰면 좋은지 — 사용 시점/판단 기준 */
  whenToUse?: string;
  /** 권장 연결 — 일반적인 업스트림(앞) → 다운스트림(뒤) 모듈 */
  connections?: string;
  /** 흔한 오류 — 자주 막히는 지점과 해결법 (경고 톤으로 표시) */
  commonErrors?: string;
  notes?: string;
}

export const MODULE_DESCRIPTIONS: Partial<
  Record<ModuleType, ModuleDescription>
> = {
  // ===== Data I/O =====
  [ModuleType.LoadData]: {
    title: "Load Data",
    category: "데이터 입출력",
    beginner:
      "분석에 쓸 데이터를 불러오는 '출발점' 블록입니다. 엑셀 파일을 컴퓨터에서 여는 것처럼, 여기서 CSV/엑셀 파일을 선택하면 표(행과 열) 형태로 앱에 들어옵니다. 모든 분석은 이 블록에서 시작하므로, 파이프라인 맨 앞에 두고 ▶ 버튼으로 먼저 실행해 데이터를 메모리에 올려두세요.",
    analysisMethod:
      "선택한 파일을 읽어 첫 줄을 '열 이름'으로, 나머지를 데이터 행으로 해석해 표(판다스 DataFrame)로 만듭니다. 엑셀 파일은 첫 시트를 자동으로 CSV처럼 변환합니다. 이 단계는 계산을 하지 않고 '데이터를 표로 정리'만 하며, 이후 모든 모듈이 이 표를 이어받아 분석합니다.",
    role: "CSV/Excel 파일을 업로드해 분석 파이프라인의 시작점으로 삼습니다. 파일은 브라우저에 업로드되어 Pyodide의 메모리에 DataFrame으로 로드됩니다.",
    input: "사용자가 선택한 로컬 .csv / .xlsx / .xls 파일. 헤더 행 1줄 + 데이터 행 N줄.",
    output: "전체 DataFrame. 후속 모듈(Statistics, SelectData, SplitData 등)에 그대로 연결합니다.",
    parameters: "fileContent: 파일 내용(브라우저가 자동 채움). source: 표시용 파일 경로.",
    whenToUse: "모든 파이프라인의 첫 모듈. 분석할 원본 데이터를 가져올 때 가장 먼저 배치합니다.",
    connections: "(시작점, 입력 없음) → Statistics · SelectData · HandleMissingValues · SplitData 등.",
    commonErrors: "파일 미실행 상태에서 하위 모듈을 돌리면 'LoadData를 먼저 실행' 오류. ▶로 먼저 실행하세요. 인코딩이 깨지면 UTF-8로 저장 후 재업로드.",
    notes: "파일 크기 20MB 이상이면 Pyodide 메모리 한계로 실행이 중단됩니다. 10MB 이상은 경고만 표시.",
  },
  [ModuleType.Statistics]: {
    title: "Statistics",
    category: "탐색적 분석",
    beginner:
      "데이터의 '건강검진 요약표'를 만들어 주는 블록입니다. 각 열이 평균은 얼마인지, 빠진 값(결측)은 없는지, 값들이 서로 얼마나 함께 움직이는지(상관관계)를 한눈에 보여줍니다. 본격적인 모델을 만들기 전에 '내 데이터가 어떻게 생겼는지' 먼저 살펴볼 때 씁니다.",
    analysisMethod:
      "각 수치형 열의 평균·중앙값·표준편차·최소/최대·결측 비율을 계산하고, 열들 사이의 상관계수(−1~+1, 함께 커지면 +, 반대로 움직이면 −)를 행렬로 구해 히트맵으로 색칠해 보여줍니다. 데이터를 바꾸지 않고 '요약 정보'만 산출하므로, 본류 흐름에서 곁가지로 붙여 확인용으로 씁니다.",
    role: "수치형/범주형 컬럼별 기술통계(평균, 중앙값, 분산, 결측 비율), 상관행렬, 히트맵을 생성합니다.",
    input: "DataFrame 1개.",
    output: "기술통계표 + 상관계수 행렬 + 시각화. '결과 보기'로 모달에서 확인.",
    whenToUse: "분석 초반 데이터의 분포·결측·상관 구조를 한눈에 파악하고 싶을 때(EDA 첫 단계).",
    connections: "LoadData → Statistics. (분기 모듈 — 데이터를 변형하지 않으므로 결과 확인용으로 곁가지로 둡니다.)",
    commonErrors: "범주형이 많으면 상관행렬이 비어 보일 수 있습니다 — 수치형 컬럼이 2개 이상 필요.",
  },
  [ModuleType.ModelAnalysisReport]: {
    title: "모델 분석보고서",
    category: "문서화",
    beginner:
      "내가 만든 분석 파이프라인을 '보고서 한 장'으로 깔끔하게 정리해 주는 마무리 블록입니다. 데이터가 무엇이고, 어떤 모델을 어떻게 학습·평가했는지, 결과가 어땠는지를 표·그래프 없이도 읽기 쉬운 HTML 문서로 만들어 줍니다. 파이프라인 맨 끝에 연결해 두고 실행하면, 위쪽 모듈들의 정보를 자동으로 모아 보고서를 완성합니다.",
    analysisMethod:
      "이 모듈은 데이터를 계산하는 분석 모듈이 아니라 '문서화(메타)' 모듈입니다. 연결된 곳에서 위로 거슬러 올라가며 LoadData(데이터·컬럼)·SplitData(분할 설정)·모델 정의(하이퍼파라미터)·TrainModel(특성/타깃)·EvaluateModel(정확도·혼동행렬·임계값) 등 실행 결과 메타데이터를 모읍니다. 여기에 사용자가 넣은 추가 설명·PDF 텍스트를 합쳐, Gemini AI가 자기완결 HTML 보고서를 작성합니다(API 키가 없으면 메타데이터만으로 동일 양식의 결정적 보고서를 만듭니다). 모든 수치는 실제 실행 결과에서 가져오며 지어내지 않습니다.",
    role: "파이프라인 말단에 두는 문서화 모듈. 업스트림 메타데이터+추가정보로 자기완결 HTML 분석보고서를 생성·저장합니다.",
    input: "report_in(앞 모듈의 데이터/모델/평가 출력). 실제 메타데이터는 전체 업스트림 그래프에서 자동 수집됩니다.",
    output: "ModelReportOutput(자기완결 HTML 문자열). '결과 보기'로 열람, 모달에서 HTML 다운로드·인쇄 가능.",
    parameters:
      "title(제목, 선택) · extra_info(추가 설명) · 참고 PDF(텍스트 추출) · use_web_research(입력 없을 때 AI 일반지식 배경 보강).",
    whenToUse: "모델 개발을 마친 뒤 데이터·과정·결과를 문서로 남기고 싶을 때. 파이프라인 가장 마지막에 배치합니다.",
    connections: "EvaluateModel · ScoreModel · ClusteringData 등 종단 모듈 → 모델 분석보고서. (출력 없음 = 말단)",
    commonErrors:
      "‘보고서 생성(실행)’은 고급기능입니다 — 상단 ‘고급기능 실행’으로 해제해야 실행됩니다(열람은 누구나 가능). 업스트림 모듈을 먼저 실행해 결과가 있어야 풍부한 보고서가 됩니다.",
    notes:
      "데이터 분석이 아닌 문서화 모듈이라 ‘전체 코드 보기(Python export)’·재현성 검증(verify) 대상이 아닙니다. 인용 수치는 업스트림의 결정적 결과에서 가져옵니다.",
  },
  [ModuleType.SelectData]: {
    title: "Select Data",
    category: "데이터 가공",
    beginner:
      "표에서 '필요한 열만 골라 담는' 블록입니다. 마치 큰 설문지에서 분석에 쓸 문항만 체크하듯, 여러 열 중 사용할 것만 선택하고 나머지는 버립니다. 더불어 각 열이 '예측에 쓸 입력(피처)'인지 '맞히려는 정답(타깃)'인지 같은 역할도 미리 지정해 둘 수 있어요.",
    analysisMethod:
      "선택한 컬럼명만 남기고 DataFrame을 잘라내며(df[선택열]), 각 컬럼에 지정한 역할(피처/타깃/시간)과 자료형(수치/범주) 정보를 메타데이터로 함께 전달합니다. 값 자체를 바꾸는 계산은 하지 않고 '어떤 열을, 어떤 의미로 쓸지'를 정리하는 단계라, 뒤의 모델링이 무엇을 입력·정답으로 삼을지 분명해집니다.",
    role: "분석에 사용할 컬럼만 골라내고, 각 컬럼의 역할(피처/타깃/시간)이나 자료형(수치/범주)을 지정합니다.",
    input: "DataFrame 1개.",
    output: "선택된 컬럼만 남은 DataFrame + 컬럼 메타데이터.",
    parameters: "columnSelections: {컬럼명: {selected, type, role}}",
    whenToUse: "불필요한 컬럼을 떼어내거나, 피처/타깃 역할을 명시해 후속 모델링을 단순화하고 싶을 때.",
    connections: "LoadData → SelectData → 전처리(HandleMissingValues/Encode) 또는 SplitData.",
    commonErrors: "타깃 컬럼을 실수로 제외하면 모델 모듈에서 라벨을 찾지 못합니다.",
  },
  [ModuleType.DataFiltering]: {
    title: "Data Filtering",
    category: "데이터 가공",
    beginner:
      "표에서 '조건에 맞는 행만 걸러내는' 블록입니다. 엑셀의 '필터' 기능처럼, 예를 들어 '나이가 30 이상' 또는 '지역이 서울인' 행만 남기고 나머지는 숨깁니다. 분석 대상을 특정 집단·기간·값 범위로 좁히고 싶을 때 사용합니다.",
    analysisMethod:
      "지정한 조건식(예: 컬럼 > 값, == 값, in 목록, between 범위, 분위수 기준 등)으로 참/거짓 마스크를 만들어 참인 행만 골라냅니다(df[조건]). 여러 조건은 AND(모두 만족)/OR(하나라도 만족)로 묶을 수 있고, 분위수 연산자는 df[열].quantile(비율) 값을 경계로 삼아 상·하위 극단값을 잘라냅니다. 열은 그대로 두고 행 수만 줄이는 결정적 연산입니다.",
    role: "조건식(>, <, ==, in, between 등)으로 행을 부분 추출합니다. AND/OR 결합 가능.",
    input: "DataFrame 1개.",
    output: "필터 조건을 통과한 행만 남은 DataFrame.",
    whenToUse: "특정 기간·집단·값 범위로 분석 대상을 좁힐 때.",
    connections: "LoadData/SelectData → DataFiltering → 후속 분석/모델링.",
    commonErrors: "조건이 너무 엄격하면 0행이 남아 하위 모듈이 실패합니다 — 필터 후 행 수를 확인하세요. 문자열 비교는 정확한 값(대소문자 포함)이어야 합니다.",
  },
  [ModuleType.ColumnPlot]: {
    title: "Column Plot",
    category: "시각화",
    beginner:
      "한 열의 값들이 '어떻게 퍼져 있는지' 그림으로 보여 주는 블록입니다. 숫자들이 어디에 몰려 있는지, 한쪽으로 치우쳤는지, 유난히 동떨어진 값(이상치)은 없는지를 막대그래프나 상자그림으로 한눈에 확인합니다. 변환이 필요한지 눈으로 판단할 때 유용합니다.",
    analysisMethod:
      "선택한 컬럼의 값 분포를 히스토그램(구간별 빈도)·KDE(부드러운 밀도 곡선)·박스플롯(사분위수와 이상치)으로 그려 matplotlib PNG 이미지로 내보내고, 평균·중앙값·결측 비율 같은 요약 통계도 함께 계산합니다. 데이터를 바꾸지 않는 확인용 시각화 단계입니다.",
    role: "단일 컬럼의 분포(히스토그램, KDE, 박스플롯)와 결측 패턴을 시각화합니다.",
    input: "DataFrame 1개 + 시각화할 컬럼명.",
    output: "PNG 이미지 + 컬럼 통계 요약.",
    whenToUse: "특정 변수의 분포 모양·치우침·이상치를 눈으로 확인하고 변환 필요성을 판단할 때.",
    connections: "어느 데이터 모듈 뒤든 곁가지로 연결. (변형하지 않는 확인용 모듈.)",
    commonErrors: "범주형 컬럼에 히스토그램을 적용하면 의미가 없을 수 있습니다 — 막대/빈도 플롯을 선택하세요.",
  },
  [ModuleType.OutlierDetector]: {
    title: "Outlier Detector",
    category: "데이터 품질",
    beginner:
      "다른 값들과 유난히 동떨어진 '튀는 값(이상치)'을 찾아내는 블록입니다. 반에서 키가 혼자만 2미터인 학생을 골라내듯, 평범한 범위를 크게 벗어난 데이터를 표시해 줍니다. 입력 실수인지 진짜 특이 케이스인지 점검하고, 필요하면 빼낼 수 있습니다.",
    analysisMethod:
      "IQR 방식은 1사분위~3사분위 폭(IQR)의 보통 1.5배를 벗어난 값을, Z-score 방식은 평균에서 표준편차의 몇 배 이상 떨어진 값을, Isolation Forest는 무작위 분할로 빨리 고립되는 점을 이상치로 판정합니다. 각 행에 이상치 여부 플래그를 붙이고 개수·비율 리포트를 만들며, 옵션에 따라 해당 행을 제거할 수 있습니다.",
    role: "IQR, Z-score, Isolation Forest 등으로 이상치를 탐지하고 표시/제거 옵션을 제공합니다.",
    input: "DataFrame 1개.",
    output: "이상치 플래그가 추가된 DataFrame + 이상치 통계 리포트.",
    parameters: "method: IQR / Z-score / Isolation Forest · threshold · 컬럼 선택",
    whenToUse: "모델 학습 전 극단값이 결과를 왜곡할 우려가 있을 때, 또는 데이터 품질을 점검할 때.",
    connections: "LoadData/SelectData → OutlierDetector → HandleMissingValues 또는 모델링.",
    commonErrors: "이상치를 무조건 제거하면 실제 신호(예: 고액 클레임)를 잃을 수 있습니다 — 도메인 판단 후 제거.",
  },
  [ModuleType.HypothesisTesting]: {
    title: "Hypothesis Testing",
    category: "통계 검정",
    beginner:
      "두 집단(또는 여러 집단)의 차이가 '진짜 의미 있는 차이인지, 아니면 그냥 우연인지'를 통계로 판정해 주는 블록입니다. 예를 들어 'A약 먹은 그룹과 B약 먹은 그룹의 평균이 다른데, 이게 우연일 확률이 얼마인가?'를 숫자(p-value)로 답해 줍니다. p-value가 작을수록(보통 0.05 미만) '우연이라 보기 어렵다'고 판단합니다.",
    analysisMethod:
      "선택한 검정에 따라 scipy로 계산합니다: 두 집단 평균 비교는 t-검정, 셋 이상은 ANOVA(F-검정), 범주형 빈도 차이는 카이제곱(χ²), 정규성은 Shapiro/K-S, 등분산은 Levene 등입니다. 각 검정은 통계량과 p-value를 산출하며, 인앱과 내보낸 Python이 동일한 검정 디스패치 로직을 써서 같은 결과를 재현합니다.",
    role: "t-검정, ANOVA, χ², Mann-Whitney 등 가설검정을 수행해 p-value와 효과크기를 산출합니다.",
    input: "DataFrame 1개 + 검정 대상 컬럼.",
    output: "검정 결과 테이블(statistic, p-value, 결론).",
    parameters: "test: t-test / ANOVA / chi-square / Mann-Whitney · 그룹·대상 컬럼",
    whenToUse: "두 집단(또는 그 이상)의 차이가 우연인지 통계적으로 유의한지 판정할 때.",
    connections: "전처리된 DataFrame → HypothesisTesting. (결과 확인용 분기.)",
    commonErrors: "정규성·등분산 가정을 어기면 t/ANOVA 결과가 왜곡됩니다 — 먼저 NormalityChecker로 점검하고 비모수(Mann-Whitney)를 고려하세요.",
  },
  [ModuleType.NormalityChecker]: {
    title: "Normality Checker",
    category: "데이터 품질",
    beginner:
      "어떤 변수의 값들이 '종 모양(정규분포)에 가까운지'를 검사하는 블록입니다. 많은 통계 기법(t-검정, 선형회귀)은 데이터가 종 모양일 때 잘 작동하므로, 먼저 그 가정이 맞는지 확인하는 건강검진 같은 역할입니다. 어긋나면 변환(log 등)이나 비모수 방법으로 바꾸라고 알려 줍니다.",
    analysisMethod:
      "Shapiro-Wilk, Kolmogorov-Smirnov, Anderson-Darling 같은 정규성 검정으로 '정규분포와 다르지 않다'는 가설의 p-value를 구하고, Q-Q plot(실제 분위수 vs 정규 분위수)을 그려 직선에서 얼마나 벗어나는지 시각적으로 보여 줍니다. 치우침이 있으면 log·sqrt 같은 변환을 권장으로 제시합니다.",
    role: "Shapiro-Wilk, K-S, Anderson-Darling 검정 + Q-Q plot으로 정규성을 평가합니다.",
    input: "DataFrame 1개 + 평가 대상 컬럼.",
    output: "검정 결과 + Q-Q plot + 권장 변환(log, sqrt 등).",
    whenToUse: "모수 검정(t/ANOVA)이나 선형회귀 가정을 확인하기 전, 변수의 정규성을 점검할 때.",
    connections: "수치형 DataFrame → NormalityChecker → (필요 시) TransformData → 검정/모델링.",
    commonErrors: "표본이 매우 크면 Shapiro-Wilk가 사소한 비정규도 '유의'로 판정합니다 — Q-Q plot을 함께 보세요.",
  },
  [ModuleType.Correlation]: {
    title: "Correlation",
    category: "탐색적 분석",
    beginner:
      "두 변수가 '함께 움직이는 정도'를 숫자로 보여 주는 블록입니다. 키가 클수록 몸무게도 느는 것처럼, 한쪽이 커질 때 다른 쪽도 커지면 양(+), 반대로 줄면 음(−)입니다. −1에서 +1 사이 값으로 관계의 방향과 세기를 보여 주고, 색칠된 표(히트맵)로 한눈에 비교합니다.",
    analysisMethod:
      "수치형 컬럼들 사이의 상관계수 행렬을 계산합니다(df.corr). Pearson은 직선 관계, Spearman은 순위 기반(곡선 관계에 강함), Kendall은 순위 일치도를 측정합니다. 값이 1·−1에 가까울수록 강한 관계, 0에 가까우면 약한 관계이며, 결과 행렬을 히트맵으로 색칠해 중복·다중공선성 후보를 찾습니다.",
    role: "Pearson/Spearman/Kendall 상관계수 행렬과 히트맵을 생성합니다.",
    input: "DataFrame 1개.",
    output: "상관행렬 + p-value + 히트맵.",
    parameters: "method: pearson(선형) / spearman(순위) / kendall · cramers_v(범주형)",
    whenToUse: "변수 간 관계를 탐색하거나 다중공선성·중복 피처를 사전에 발견할 때.",
    connections: "수치형 DataFrame → Correlation. 강한 상관 발견 시 → VIFChecker로 다중공선성 정량화.",
    commonErrors: "상관은 인과가 아닙니다. 비선형 관계는 Pearson에서 0에 가깝게 나올 수 있어 Spearman과 비교하세요.",
  },
  [ModuleType.HandleMissingValues]: {
    title: "Handle Missing Values",
    category: "데이터 전처리",
    beginner:
      "표에서 '비어 있는 칸(결측값)'을 채우거나 정리하는 블록입니다. 설문지에서 답을 안 쓴 칸을 그냥 두면 계산이 안 되듯, 빈칸이 있으면 대부분의 모델이 오류를 냅니다. 그래서 빈칸을 평균값 등으로 메우거나, 빈칸이 있는 행을 빼서 깨끗한 표로 만듭니다.",
    analysisMethod:
      "결측 처리 방식에 따라 다르게 채웁니다: 수치형은 평균·중앙값, 범주형은 최빈값으로 대체(impute)하거나, KNN 방식은 비슷한 행들의 값을 참고해 채웁니다. 또는 결측이 있는 행 자체를 삭제(dropna)합니다. 어느 방식이든 어떤 값으로 얼마나 채웠는지 처리 로그를 남깁니다.",
    role: "결측치를 평균/중앙값/최빈값으로 대체하거나, KNN/회귀 보간, 또는 행 삭제를 적용합니다.",
    input: "DataFrame 1개.",
    output: "결측 처리된 DataFrame + 처리 로그.",
    parameters: "method: remove_row / impute(mean·median·mode) / knn",
    whenToUse: "모델·클러스터링·검정 대부분이 결측을 허용하지 않으므로, 모델링 전 거의 항상 거칩니다.",
    connections: "LoadData/SelectData → HandleMissingValues → EncodeCategorical/ScalingTransform → 모델링.",
    commonErrors: "결측을 처리하지 않고 모델/클러스터링을 돌리면 'null 값' 오류가 납니다. 행 삭제는 표본이 크게 줄 수 있으니 비율을 확인하세요.",
  },
  [ModuleType.EncodeCategorical]: {
    title: "Encode Categorical",
    category: "데이터 전처리",
    beginner:
      "'서울/부산/대구' 같은 글자 범주를 모델이 알아듣는 '숫자'로 바꿔 주는 블록입니다. 대부분의 모델은 글자를 직접 계산하지 못해서, 각 범주를 0/1 또는 정수로 번역해 줘야 합니다. 마치 외국어 단어를 숫자 코드로 사전 등록하는 것과 같습니다.",
    analysisMethod:
      "One-Hot은 범주마다 0/1 열을 새로 만들고(서울=[1,0,0] 등), Label/Ordinal은 각 범주에 정수를 매깁니다(순서가 의미 있을 때 Ordinal), Target은 범주별 타깃 평균으로 치환합니다. 학습 때 만든 매핑(어느 범주가 어느 숫자인지)을 저장해 추론 때 똑같이 적용해야 일관됩니다.",
    role: "범주형 변수를 One-Hot, Label, Ordinal, Target Encoding 등으로 수치화합니다.",
    input: "DataFrame 1개.",
    output: "인코딩된 DataFrame + 인코더 매핑 정보(추론 시 재사용).",
    parameters: "method: one_hot / label / ordinal / target · 대상 컬럼",
    whenToUse: "문자열 범주형을 수치만 받는 모델(회귀, 신경망, 거리 기반)에 넣기 전.",
    connections: "HandleMissingValues → EncodeCategorical → ScalingTransform → SplitData/모델링.",
    commonErrors: "고유값이 매우 많은 컬럼에 One-Hot을 쓰면 컬럼이 폭증합니다 — Target/Ordinal을 고려. 학습·추론에서 동일 매핑을 써야 합니다.",
  },
  [ModuleType.ScalingTransform]: {
    title: "Scaling Transform",
    category: "데이터 전처리",
    beginner:
      "단위가 제각각인 숫자 열들을 '같은 눈금'으로 맞춰 주는 블록입니다. 예컨대 나이(0~100)와 연봉(수천만 단위)을 그대로 쓰면 연봉이 계산을 압도해 버립니다. 모든 변수를 비슷한 크기로 줄여서, 거리·경사를 쓰는 모델이 어느 한 변수에 휘둘리지 않게 합니다.",
    analysisMethod:
      "MinMax는 최솟값~최댓값을 0~1로 늘리고, StandardScaler는 (값−평균)/표준편차로 평균0·분산1로 표준화하며, RobustScaler는 중앙값과 IQR을 써서 이상치에 덜 민감하게 변환합니다. 학습 데이터로 계산한 변환 기준(스케일러)을 저장해 테스트·신규 데이터에 동일하게 적용해야 합니다.",
    role: "수치형 변수를 MinMax / StandardScaler / RobustScaler로 변환합니다.",
    input: "DataFrame 1개.",
    output: "스케일링된 DataFrame + 스케일러 객체.",
    parameters: "method: MinMax(0~1) / StandardScaler(평균0,분산1) / RobustScaler(중앙값,IQR)",
    whenToUse: "거리/경사 기반 알고리즘(KMeans, KNN, SVM, 신경망, PCA) 전에는 거의 필수.",
    connections: "EncodeCategorical → ScalingTransform → KMeans/PCA/SVM/NeuralNetwork 등.",
    commonErrors: "트리 계열(DecisionTree, RandomForest)에는 효과가 없습니다. 이상치가 많으면 MinMax가 왜곡되니 RobustScaler를 고려.",
  },
  [ModuleType.TransformData]: {
    title: "Transform Data",
    category: "데이터 전처리",
    beginner:
      "한쪽으로 길게 치우친(꼬리가 긴) 데이터를 '종 모양에 가깝게 펴 주는' 블록입니다. 소득처럼 소수의 큰 값이 분포를 끌고 가는 경우, log 같은 변환으로 큰 값을 눌러 균형을 맞춥니다. 그러면 선형모델·통계검정의 가정이 더 잘 맞습니다.",
    analysisMethod:
      "선택한 변환식을 컬럼에 적용합니다: log/sqrt는 큰 값을 압축해 오른쪽 꼬리를 줄이고, Box-Cox·Yeo-Johnson은 데이터에 가장 잘 맞는 변환 모수를 자동으로 찾아 정규성에 가깝게 만듭니다(Yeo-Johnson은 0 이하 값도 처리 가능). 변환된 값으로 새 컬럼을 만들거나 기존 값을 대체합니다.",
    role: "로그/제곱근/Box-Cox/Yeo-Johnson 등 분포 변환을 적용합니다.",
    input: "DataFrame 1개 + 변환할 컬럼.",
    output: "변환된 DataFrame.",
    parameters: "transform: log / sqrt / box-cox / yeo-johnson · 대상 컬럼",
    whenToUse: "치우친(skewed) 분포를 정규에 가깝게 펴서 선형모델·검정 가정을 만족시키고 싶을 때.",
    connections: "NormalityChecker(진단) → TransformData → 검정/선형모델.",
    commonErrors: "log/Box-Cox는 0 이하 값에서 실패합니다 — 양수만 있거나 Yeo-Johnson을 사용하세요.",
  },
  [ModuleType.SplitData]: {
    title: "Split Data",
    category: "데이터 가공",
    beginner:
      "데이터를 '연습 문제'와 '실전 시험'으로 나누는 블록입니다. 모델을 모든 데이터로 학습시킨 뒤 같은 데이터로 평가하면 '본 문제만 잘 푸는' 착시가 생깁니다. 그래서 일부(학습셋)로만 공부시키고, 따로 떼어 둔 나머지(테스트셋)로 진짜 실력을 채점합니다.",
    analysisMethod:
      "scikit-learn의 train_test_split으로 행을 무작위로 학습/테스트 두 묶음으로 나눕니다(예: 80%/20%). 층화(stratify) 모드는 클래스 비율을 양쪽에 똑같이 유지하고, 시간 기반 모드는 시간 순서를 지킵니다. random_state(기본 42)를 고정해 매번 같은 분할이 나오도록 재현성을 보장하며, train_data_out·test_data_out 두 포트로 나눠 내보냅니다.",
    role: "데이터를 학습/검증/테스트로 분할합니다. 무작위, 층화, 시간기반 모드 지원.",
    input: "DataFrame 1개 + 타깃 컬럼(층화 시).",
    output: "train_data_out, test_data_out 두 포트로 분리 출력.",
    parameters: "train_size · shuffle · stratify · stratify_column · random_state(기본 42, 재현성)",
    whenToUse: "지도학습에서 과적합을 막고 일반화 성능을 정직하게 평가하려 할 때.",
    connections: "전처리 완료 DataFrame → SplitData → (train_data_out)TrainModel · (test_data_out)ScoreModel/EvaluateModel.",
    commonErrors: "train·test 포트를 바꿔 연결하면 평가가 왜곡됩니다. 분류 불균형 시 stratify=True 권장. random_state를 비우면 매 실행 결과가 달라집니다(기본 42 유지 권장).",
  },
  [ModuleType.Concat]: {
    title: "Concat",
    category: "데이터 가공",
    beginner:
      "표 두 개를 단순히 '이어 붙이는' 블록입니다. 같은 형식의 1월 데이터와 2월 데이터를 위아래로 쌓거나(행), 같은 행에 대한 추가 정보를 옆에 나란히 붙입니다(열). 키로 짝을 맞추는 게 아니라, 순서대로 그냥 붙이는 점이 Join과 다릅니다.",
    analysisMethod:
      "pandas.concat으로 두 DataFrame을 결합합니다. axis=0이면 행 방향으로 쌓아(컬럼명이 같아야 함) 행 수가 늘고, axis=1이면 열 방향으로 붙여(행 순서·개수가 같아야 함) 열 수가 늡니다. 키 매칭 없이 위치 기준으로 단순 연결하는 결정적 연산입니다.",
    role: "동일 스키마 DataFrame 2개를 행(axis=0) 또는 열(axis=1) 방향으로 결합합니다.",
    input: "DataFrame 2개 (data_in, data_in2).",
    output: "결합된 DataFrame.",
    parameters: "axis: 0(행 누적) / 1(열 붙이기)",
    whenToUse: "분할 저장된 같은 형식의 데이터를 합치거나(행), 별도로 만든 피처를 붙일 때(열).",
    connections: "두 데이터 소스 → Concat → 후속 분석/모델링.",
    commonErrors: "행 결합은 컬럼명이, 열 결합은 행 수가 일치해야 합니다. 두 번째 데이터 포트(data_in2) 연결을 빠뜨리기 쉽습니다.",
  },
  [ModuleType.Join]: {
    title: "Join",
    category: "데이터 가공",
    beginner:
      "공통 열쇠(예: 회원ID)를 기준으로 서로 다른 두 표의 정보를 '한 줄로 합치는' 블록입니다. '회원 명단' 표와 '구매 내역' 표를 회원ID로 짝지어, 한 사람의 이름과 구매액을 같은 행에 모읍니다. 엑셀의 VLOOKUP과 비슷합니다.",
    analysisMethod:
      "pandas.merge로 지정한 키(on) 값이 같은 행끼리 짝지어 합칩니다. inner는 양쪽에 모두 있는 키만, left/right는 한쪽 표를 모두 살리고, outer는 양쪽 전부를 남기되 빈 곳은 결측으로 채웁니다. 키 컬럼명·자료형이 양쪽에서 일치해야 매칭됩니다.",
    role: "키 컬럼을 기준으로 두 DataFrame을 inner/left/right/outer 조인합니다.",
    input: "DataFrame 2개 (data_in, data_in2) + join key.",
    output: "조인된 DataFrame.",
    parameters: "how: inner / left / right / outer · on(키 컬럼)",
    whenToUse: "공통 키(회원ID 등)로 서로 다른 테이블의 정보를 한 행에 합칠 때.",
    connections: "두 데이터 소스 → Join → 후속 분석/모델링.",
    commonErrors: "키 컬럼명이 양쪽에서 다르거나 자료형이 다르면 매칭 실패. inner 조인은 매칭 안 된 행이 사라지니 결과 행 수를 확인하세요.",
  },
  [ModuleType.TransitionData]: {
    title: "Transition Data",
    category: "데이터 가공",
    beginner:
      "표의 '모양(세로형↔가로형)'을 바꿔 주는 블록입니다. '연도-지표-값'처럼 길게 늘어선 표를, 연도를 열로 펼쳐 표 형태로 만들거나(가로형) 그 반대로 녹입니다(세로형). 사망률 행렬(연령×연도)처럼 분석에 맞는 표 모양으로 다시 짤 때 씁니다.",
    analysisMethod:
      "pandas의 pivot(세로형→가로형: 한 열의 값들을 새 열 머리로 펼침)과 melt(가로형→세로형: 여러 열을 하나의 '변수-값' 쌍으로 녹임)를 수행합니다. 값을 새로 계산하지 않고 같은 데이터를 다른 행·열 배치로 재구조화하는 결정적 변환입니다.",
    role: "장형(long) ↔ 광형(wide) 변환(pivot/melt)을 수행합니다.",
    input: "DataFrame 1개.",
    output: "재구조화된 DataFrame.",
    whenToUse: "시계열을 연도×지표 표로 펼치거나(wide), 모델 입력용으로 다시 녹일(long) 때.",
    connections: "LoadData → TransitionData → 사망률 모델(연령×연도 행렬) 등.",
    commonErrors: "pivot 시 인덱스+컬럼 조합이 중복되면 집계 함수가 필요합니다.",
  },
  [ModuleType.ResampleData]: {
    title: "Resample Data",
    category: "데이터 가공",
    beginner:
      "데이터의 '개수 균형'이나 '시간 간격'을 다시 맞추는 블록입니다. 예를 들어 '정상 9,900건 vs 사기 100건'처럼 한쪽이 극단적으로 적으면 모델이 드문 쪽을 무시하기 쉬운데, 드문 쪽을 늘려 균형을 맞춥니다. 또는 분 단위 시계열을 일·월 단위로 묶어 주기를 통일합니다.",
    analysisMethod:
      "클래스 균형 모드는 imbalanced-learn으로 소수 클래스를 합성 생성(SMOTE)하거나 다수 클래스를 줄여(언더샘플링) 비율을 맞춥니다. 시간 리샘플 모드는 pandas resample로 지정 주기(일/주/월)로 집계합니다. 균형 보정은 데이터 누수를 막기 위해 반드시 학습셋에만 적용해야 하며, 결정성을 위해 시드를 고정합니다.",
    role: "시계열 데이터를 일/주/월 단위로 리샘플링하거나 클래스 불균형을 SMOTE/언더샘플링으로 보정합니다.",
    input: "DataFrame 1개.",
    output: "리샘플링된 DataFrame.",
    parameters: "mode: 시간 리샘플(freq) / 클래스 균형(SMOTE·under·over)",
    whenToUse: "희귀 클래스 비율을 높여 분류 성능을 개선하거나, 시계열 주기를 통일할 때.",
    connections: "SplitData(train만) → ResampleData → 모델링. (불균형 보정은 train에만 적용.)",
    commonErrors: "SMOTE를 test에도 적용하면 성능이 부풀려집니다 — 학습 데이터에만 쓰세요. SMOTE는 수치형 피처를 요구합니다.",
  },

  // ===== Supervised Learning =====
  [ModuleType.LinearRegression]: {
    title: "Linear Regression",
    category: "지도학습 (회귀)",
    beginner:
      "여러 입력값을 조합해 '숫자(가격·점수 등)'를 예측하는 가장 기본적인 블록입니다. 면적이 넓을수록 집값이 오르듯, 각 입력이 결과에 얼마씩 기여하는지를 직선 식으로 학습합니다. 결과 해석이 쉬워 가장 먼저 시도하는 출발 모델로 좋습니다.",
    analysisMethod:
      "타깃 = a + b1·x1 + b2·x2 + … 꼴의 직선식 계수를 최소제곱법(예측 오차의 제곱합 최소화)으로 찾습니다. Lasso(L1)·Ridge(L2)·ElasticNet은 계수에 벌점을 더해 과적합을 누르고 불필요한 변수의 영향을 줄입니다. 이 모듈은 모델 정의만 만들고 실제 적합은 TrainModel에서 수행합니다.",
    role: "연속형 타깃을 선형 결합으로 예측합니다. 해석성 우선 시 첫 베이스라인.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainModel에서 X_train·y_train으로 수행.",
    output: "학습되지 않은 모델 객체(model). TrainModel로 연결.",
    parameters: "model_type: LinearRegression/Lasso/Ridge/ElasticNet · fit_intercept · alpha · l1_ratio",
    whenToUse: "타깃이 연속형이고 해석 가능한 베이스라인이 필요할 때. 정규화(Lasso/Ridge)로 과적합 억제.",
    connections: "(model_in)→ TrainModel ←(data_in)SplitData.train → ScoreModel → EvaluateModel.",
    commonErrors: "이 모듈만으로는 학습되지 않습니다 — 반드시 TrainModel에 연결하세요. 강한 다중공선성은 계수를 불안정하게 합니다(Ridge 권장).",
  },
  [ModuleType.LogisticRegression]: {
    title: "Logistic Regression",
    category: "지도학습 (분류)",
    beginner:
      "'예/아니오' 또는 여러 부류 중 하나를 맞히는 분류의 기본 블록입니다. 이름은 회귀지만 실제로는 '이 메일이 스팸일 확률은 몇 %인가'처럼 확률을 계산해 분류합니다. 결과 해석이 쉬워 분류 문제의 첫 출발 모델로 많이 씁니다.",
    analysisMethod:
      "입력의 선형 결합을 시그모이드(로지스틱) 함수에 넣어 0~1 확률로 변환하고, 보통 0.5를 넘으면 양성으로 분류합니다. 각 변수의 계수는 log-odds(오즈의 로그) 변화로 해석되며, L1/L2 정규화로 과적합을 억제합니다. 모델 정의만 만들고 적합은 TrainModel에서 수행합니다.",
    role: "이진/다항 분류기. log-odds 해석 가능, 정규화(L1/L2) 지원.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainModel.",
    output: "학습되지 않은 분류 모델(model).",
    whenToUse: "분류의 해석 가능한 베이스라인이 필요하거나, 변수 영향(odds)을 보고 싶을 때.",
    connections: "→ TrainModel → ScoreModel → EvaluateModel(분류 지표).",
    commonErrors: "라벨이 연속형이면 분류가 되지 않습니다. 클래스 불균형 시 지표 해석에 주의(AUC·F1 병행).",
  },
  [ModuleType.PoissonRegression]: {
    title: "Poisson Regression",
    category: "지도학습 (카운트)",
    beginner:
      "'몇 번 일어났는가(건수)'를 예측하는 블록입니다. 한 달 동안의 보험 청구 횟수, 사고 건수처럼 0,1,2…로 세는 값에 맞춰진 모델입니다. 일반 회귀와 달리 음수가 나오지 않게 설계돼 있어 횟수 예측에 적합합니다.",
    analysisMethod:
      "카운트의 로그 평균을 입력의 선형 결합으로 모델링하는 Poisson GLM입니다(log link). '평균=분산'을 가정하며, 관측 기간·규모가 다르면 exposure(노출량)를 offset으로 반영해 발생률로 비교합니다. 분산이 평균보다 크게 크면(과대분산) 음이항(NB)으로 바꾸는 게 좋습니다.",
    role: "건수 데이터(클레임 횟수, 사건 수) 예측. 평균=분산 가정.",
    input: "(모델 정의) 하이퍼파라미터만 + (학습 시) X_train, y_train(count) + exposure(option).",
    output: "학습되지 않은 GLM 모델.",
    whenToUse: "타깃이 음이 아닌 정수(횟수)이고 노출량(exposure)을 반영하고 싶을 때.",
    connections: "→ TrainModel → ScoreModel/EvaluateModel. 과대분산이면 NegativeBinomial로 교체.",
    commonErrors: "분산이 평균보다 크게 크면(과대분산) 표준오차가 과소추정됩니다 — NB를 고려하세요.",
  },
  [ModuleType.NegativeBinomialRegression]: {
    title: "Negative Binomial Regression",
    category: "지도학습 (카운트)",
    beginner:
      "건수를 예측하되, 값이 '들쭉날쭉 심하게 흩어진' 경우에 쓰는 블록입니다. 보통의 카운트 모델(Poisson)은 평균과 흩어짐이 비슷하다고 보지만, 실제로는 흩어짐이 훨씬 큰 경우가 많은데 이를 더 유연하게 다룹니다.",
    analysisMethod:
      "Poisson에 분산을 추가로 키우는 모수(α)를 더한 음이항 GLM입니다. 분산이 평균보다 큰 과대분산을 흡수해 표준오차를 더 정확히 추정하므로, p-value가 과소추정되는 문제를 줄입니다. 과대분산이 없으면 더 단순한 Poisson이 안정적입니다.",
    role: "과대분산 카운트 데이터에 사용. Poisson보다 분산 모수가 자유로움.",
    input: "(모델 정의) 하이퍼파라미터만 + (학습 시) X_train, y_train(count).",
    output: "학습되지 않은 NB GLM 모델.",
    whenToUse: "카운트 타깃의 분산이 평균보다 뚜렷이 클 때(과대분산).",
    connections: "→ TrainModel → ScoreModel/EvaluateModel.",
    commonErrors: "과대분산이 없으면 Poisson이 더 단순·안정적입니다.",
  },
  [ModuleType.DecisionTree]: {
    title: "Decision Tree",
    category: "지도학습",
    beginner:
      "'스무고개'처럼 질문을 가지치며 결론에 도달하는 블록입니다. '나이>30?' → '예' → '연봉>5천?' 식으로 데이터를 갈래로 나눠 예측합니다. 규칙이 그림으로 보여 사람이 이해하기 쉽지만, 너무 깊어지면 본 데이터만 외우는 과적합에 빠집니다.",
    analysisMethod:
      "각 단계에서 데이터를 가장 잘 갈라 주는 컬럼·기준값을 골라(분류는 지니/엔트로피 불순도, 회귀는 분산 감소가 최대가 되도록) 가지를 뻗습니다. max_depth·min_samples 등으로 가지치기를 제한해 과적합을 막습니다. classification/regression 목적에 따라 분류·회귀 트리로 동작합니다.",
    role: "단일 의사결정 트리. 시각화/해석성 강점, 단일 트리는 과적합 경향.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainModel.",
    output: "학습되지 않은 트리 모델(model).",
    parameters: "model_purpose(classification/regression) · criterion · max_depth · min_samples_split/leaf · class_weight",
    whenToUse: "규칙 기반의 해석 가능한 모델이 필요하거나, 앙상블(RF)의 베이스라인으로.",
    connections: "→ TrainModel → ScoreModel → EvaluateModel.",
    commonErrors: "max_depth를 제한하지 않으면 쉽게 과적합합니다 — 깊이/리프 최소 표본을 설정하세요.",
  },
  [ModuleType.RandomForest]: {
    title: "Random Forest",
    category: "지도학습 (앙상블)",
    beginner:
      "'여러 명의 전문가에게 물어 다수결로 결정하는' 블록입니다. 조금씩 다른 의사결정 트리를 수백 그루 만들어, 분류는 투표로 회귀는 평균으로 합칩니다. 한 그루보다 훨씬 안정적이고, 큰 손질 없이도 표 형식 데이터에서 좋은 성능을 냅니다.",
    analysisMethod:
      "데이터·변수를 무작위로 조금씩 다르게 뽑아 많은 트리를 학습하고(bagging) 그 예측을 평균/투표로 모읍니다(sklearn RandomForest, random_state=42로 결정적). 각 변수가 예측에 기여한 정도를 feature importance로 제공합니다. 모델 정의만 만들고 적합은 TrainModel에서 실제 sklearn 모델로 수행합니다.",
    role: "다수 트리의 평균/투표. 강건한 일반화 + feature importance.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainModel.",
    output: "학습되지 않은 RF 모델 + (학습 후) 변수중요도.",
    whenToUse: "표 형식 데이터에서 튜닝 없이 좋은 성능이 필요한 기본 선택지.",
    connections: "→ TrainModel → ScoreModel → EvaluateModel. 중요도 확인은 ResultModel.",
    commonErrors: "트리가 많으면 학습이 느려집니다(Pyodide). feature importance는 상관 피처 간 분산될 수 있습니다.",
  },
  [ModuleType.GradientBoosting]: {
    title: "Gradient Boosting",
    category: "지도학습 (앙상블)",
    beginner:
      "'앞 사람의 실수를 다음 사람이 고쳐 나가는' 방식으로 점점 똑똑해지는 블록입니다. 작은 트리를 하나 만들고, 그 트리가 틀린 부분을 메우는 다음 트리를 더하는 식으로 차례차례 쌓습니다. 표 형식 데이터에서 종종 가장 높은 정확도를 냅니다.",
    analysisMethod:
      "앞선 트리들의 예측 오차(잔차)를 줄이는 방향으로 새 약한 트리를 순차적으로 더해 가는 부스팅 기법입니다(sklearn GradientBoosting, random_state=42로 결정적). learning_rate가 각 트리의 반영 정도를, n_estimators가 트리 수를 정합니다. 순차 학습이라 RandomForest보다 느릴 수 있으며, 적합은 TrainModel에서 실제 모델로 수행합니다.",
    role: "약한 트리를 순차적으로 부스팅. 표 형식 데이터에서 강력한 예측 성능.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainModel.",
    output: "학습되지 않은 GBM 모델 + (학습 후) 변수중요도.",
    parameters: "model_purpose(classification/regression) · n_estimators(기본 100) · learning_rate(기본 0.1) · max_depth(기본 3) · random_state=42(고정)",
    whenToUse: "책 Ch3의 Boosted Decision Tree처럼 정확도가 중요한 분류·회귀에. RandomForest보다 종종 더 높은 성능.",
    connections: "→ TrainModel → ScoreModel → EvaluateModel. 중요도 확인은 ResultModel.",
    commonErrors: "learning_rate가 크면 과적합·불안정. n_estimators가 많으면 학습이 느려집니다(Pyodide). 부스팅은 순차적이라 RF보다 느릴 수 있습니다.",
  },
  [ModuleType.NeuralNetwork]: {
    title: "Neural Network",
    category: "지도학습",
    beginner:
      "뇌의 신경망을 흉내 낸 블록으로, 복잡하고 구불구불한 패턴을 학습합니다. 여러 층의 '뉴런'이 입력을 단계적으로 변형해 가며 정답에 가까워지도록 스스로 조정합니다. 관계가 단순하지 않고 데이터가 충분할 때 위력을 발휘합니다.",
    analysisMethod:
      "다층 퍼셉트론(MLP)으로, 입력→은닉층→출력으로 가중치를 곱하고 활성화 함수(비선형)를 통과시키며 신호를 전달합니다. 예측 오차를 역전파로 되돌려 가중치를 조금씩 갱신하는 과정을 max_iter만큼 반복합니다(random_state=42로 결정적). 입력 스케일에 민감해 학습 전 스케일링이 사실상 필수입니다.",
    role: "다층 퍼셉트론(MLP). 비선형/복잡 패턴 학습.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainModel.",
    output: "학습되지 않은 NN 모델(model).",
    parameters: "model_purpose · hidden_layer_sizes(예: '100,50') · activation · max_iter · random_state(기본 42)",
    whenToUse: "비선형 관계가 강하고 표본이 충분할 때. 스케일링이 사실상 필수.",
    connections: "ScalingTransform → SplitData → TrainModel(+NN) → ScoreModel → EvaluateModel.",
    commonErrors: "스케일링 없이 쓰면 수렴이 느리거나 실패합니다. max_iter가 작으면 미수렴 경고가 납니다.",
  },
  [ModuleType.SVM]: {
    title: "Support Vector Machine",
    category: "지도학습",
    beginner:
      "두 집단 사이에 '가장 넓은 안전 간격을 두는 경계선'을 긋는 블록입니다. 마치 두 무리 사이로 가능한 한 폭이 넓은 길을 내듯, 양쪽에서 가장 가까운 점들에서 멀리 떨어진 최적의 경계를 찾습니다. 경계가 직선이 아니어도 커널로 휘어진 경계를 만들 수 있습니다.",
    analysisMethod:
      "두 클래스를 가르는 초평면 중 마진(가장 가까운 점들까지의 거리)이 최대가 되는 것을 찾습니다. 커널(rbf 등)로 데이터를 고차원에 매핑해 비선형 경계도 표현합니다(sklearn SVC/SVR, probability·random_state=42로 결정적). 거리 기반이라 스케일링이 필수이고, 표본이 크면 학습이 느립니다.",
    role: "마진 최대화 기반 분류/회귀. 커널로 비선형 확장.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainModel.",
    output: "학습되지 않은 SVM 모델(model).",
    whenToUse: "표본이 크지 않고 경계가 복잡할 때(커널). 스케일링 필수.",
    connections: "ScalingTransform → SplitData → TrainModel(+SVM) → ScoreModel → EvaluateModel.",
    commonErrors: "대용량에서 매우 느립니다. 스케일링을 빠뜨리면 성능이 급락합니다.",
  },
  [ModuleType.LDA]: {
    title: "Linear Discriminant Analysis",
    category: "지도학습 (분류)",
    beginner:
      "여러 부류를 '가장 잘 갈라 보이는 방향'을 찾아 분류하는 블록입니다. 데이터를 한 축에 투영했을 때 집단끼리는 멀리, 같은 집단 안에서는 모이도록 하는 방향을 고릅니다. 분류와 동시에 차원을 줄여 시각화하는 데도 쓸 수 있습니다.",
    analysisMethod:
      "모든 클래스의 공분산이 같다는 가정 아래, 집단 간 분산은 키우고 집단 내 분산은 줄이는 선형 판별 방향을 구해 결정경계를 만듭니다(sklearn LDA). 그 방향으로 투영하면 저차원 표현도 얻습니다. 클래스별 산포가 크게 다르면 가정이 깨져 QDA가 더 적합합니다.",
    role: "클래스별 공분산이 같다는 가정 하에 선형 결정경계 학습 + 차원축소.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainModel.",
    output: "학습되지 않은 LDA 모델 + (학습 후) 변환 행렬.",
    whenToUse: "분류 + 시각화용 저차원 투영을 동시에 원할 때.",
    connections: "→ TrainModel → ScoreModel → EvaluateModel.",
    commonErrors: "클래스별 공분산이 크게 다르면 가정이 깨집니다(QDA 고려). 피처 수>표본이면 불안정.",
  },
  [ModuleType.NaiveBayes]: {
    title: "Naive Bayes",
    category: "지도학습 (분류)",
    beginner:
      "확률을 이용해 '가장 그럴듯한 부류'를 빠르게 고르는 블록입니다. 각 단서를 따로따로 본 뒤 확률을 곱해 합산하는 단순한 방식이라 매우 빠릅니다. 스팸 메일 분류처럼 단어 빈도 같은 희소·고차원 데이터에서 특히 잘 통하는 베이스라인입니다.",
    analysisMethod:
      "베이즈 정리를 써서, 각 특징이 서로 독립이라는('순진한') 가정 아래 클래스별 사후확률을 계산하고 가장 높은 클래스로 분류합니다(sklearn GaussianNB 등). 가정이 단순해 학습·예측이 빠르지만, 특징 간 상관이 강하면 확률 보정이 부정확해질 수 있습니다.",
    role: "독립 가정 기반 베이즈 분류. 텍스트/희소 데이터에 강함.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainModel.",
    output: "학습되지 않은 NB 모델(model).",
    whenToUse: "빠른 베이스라인이 필요하거나 고차원 희소 피처(텍스트 빈도)일 때.",
    connections: "→ TrainModel → ScoreModel → EvaluateModel.",
    commonErrors: "강한 피처 상관이 있으면 독립 가정 위반으로 확률 보정이 나빠집니다.",
  },
  [ModuleType.KNN]: {
    title: "K-Nearest Neighbors",
    category: "지도학습",
    beginner:
      "'주변에서 나와 가장 비슷한 K명에게 물어보고 따라가는' 블록입니다. 새 데이터가 들어오면 가장 가까운 이웃 K개를 찾아, 분류는 다수결로 회귀는 평균으로 답을 정합니다. 별도 학습 과정 없이 '비슷한 것끼리 비슷하다'는 직관을 그대로 씁니다.",
    analysisMethod:
      "예측할 점에서 모든 학습 데이터까지의 거리를 재 가장 가까운 K개 이웃을 고른 뒤, 그들의 라벨을 다수결(분류)/평균(회귀)으로 모읍니다(sklearn KNeighbors). 거리 기반이라 스케일링이 없으면 단위 큰 변수가 거리를 지배하고, 표본이 크면 매 예측마다 거리를 계산해 느려집니다.",
    role: "가까운 K개 이웃의 다수결/평균으로 예측. 학습 없음, 추론 비용 높음.",
    input: "(모델 정의) 하이퍼파라미터만 + (추론 시) 학습 데이터 보유.",
    output: "학습 데이터를 보유한 KNN 모델.",
    parameters: "n_neighbors(K) · weights · 거리 척도",
    whenToUse: "경계가 비선형이고 표본이 작을 때의 간단한 비모수 베이스라인.",
    connections: "ScalingTransform → SplitData → TrainModel(+KNN) → ScoreModel → EvaluateModel.",
    commonErrors: "스케일링이 없으면 단위 큰 변수가 거리를 지배합니다. 표본이 크면 추론이 느립니다.",
  },

  // ===== Model Operations =====
  [ModuleType.TrainModel]: {
    title: "Train Model",
    category: "모델 연산",
    beginner:
      "모델에게 '예제 문제와 정답을 보여 주며 공부시키는' 블록입니다. 앞에서 고른 모델 종류(회귀·트리 등)와 학습 데이터를 받아, 입력과 정답의 관계를 익히게 합니다. 이 과정을 거쳐야 비로소 '예측할 줄 아는' 모델이 됩니다.",
    analysisMethod:
      "model_in으로 들어온 모델 정의에 학습 데이터를 넣어 model.fit(X_train, y_train)을 실행합니다. feature_columns로 입력 열을, label_column으로 정답 열을 지정하며, RandomForest·GradientBoosting 등은 실제 sklearn 모델로 결정적으로 적합됩니다. 결과로 학습 완료된 모델(trained_model)을 내보내 Score/Evaluate로 잇습니다.",
    role: "모델 정의 모듈(model)과 학습 데이터를 받아 model.fit(X, y)를 실행합니다.",
    input: "model_in: 모델 객체 + data_in: X_train·y_train (SplitData.train).",
    output: "학습된 모델(trained_model).",
    parameters: "feature_columns · label_column",
    whenToUse: "지도학습 모델 정의(LinearRegression/DecisionTree 등)를 실제로 적합시킬 때.",
    connections: "(model_in)모델정의 · (data_in)SplitData.train → TrainModel → ScoreModel/EvaluateModel.",
    commonErrors: "model_in·data_in 둘 다 연결해야 합니다. label_column 미지정 시 학습 실패. 피처에 결측·문자열이 남아 있으면 fit 오류.",
  },
  [ModuleType.SweepParameters]: {
    title: "Sweep Parameters",
    category: "모델 연산",
    beginner:
      "모델의 '설정값(하이퍼파라미터)'을 여러 조합으로 자동 시험해 가장 좋은 조합을 골라 주는 블록입니다. 트리 깊이를 3·5·10 중 무엇으로 할지 사람이 일일이 바꿔 보는 대신, 한꺼번에 여러 후보를 돌려 성능이 가장 좋은 설정을 찾아 그 모델을 내보냅니다.",
    analysisMethod:
      "GridSearchCV는 지정한 param_grid의 모든 조합을, RandomizedSearchCV는 그중 일부를 무작위로 시험하되, 각 조합을 교차검증(cv 등분)으로 평가해 평균 성능이 가장 높은 설정을 고릅니다. 최적 조합으로 전체 학습 데이터에 다시 적합한 best_estimator_를 내보내며(RandomizedSearch는 random_state=42로 고정), TrainModel과 동일하게 Score/Evaluate로 잇습니다.",
    role: "모델 정의와 학습 데이터를 받아 GridSearchCV(기본·완전 결정적)로 하이퍼파라미터를 탐색하고, 최적 적합 추정기를 출력합니다(TrainModel 출력과 동일하게 Score/Evaluate로 연결).",
    input: "model_in: 미적합 모델 객체 + data_in: X_train·y_train (SplitData.train).",
    output: "최적 적합 모델(trained_model = best_estimator_) + best_params_ · best_score_.",
    parameters: "feature_columns · label_column · search_strategy(GridSearchCV/RandomizedSearchCV) · param_grid(JSON) · cv(정수) · scoring · n_iter",
    whenToUse: "단일 파라미터 학습 대신 교차검증으로 하이퍼파라미터를 자동 튜닝할 때.",
    connections: "(model_in)모델정의 · (data_in)SplitData.train → SweepParameters → ScoreModel/EvaluateModel.",
    commonErrors: "model_in·data_in 둘 다 연결해야 합니다. param_grid는 추정기 파라미터명 키를 가진 JSON이어야 합니다. cv는 2 이상 정수(결정성 보장). RandomizedSearchCV는 random_state=42로 고정됩니다.",
  },
  [ModuleType.ScoreModel]: {
    title: "Score Model",
    category: "모델 연산",
    beginner:
      "공부를 마친 모델에게 '실제 문제를 풀게 해' 답안을 받아 오는 블록입니다. 학습된 모델과 새 데이터를 넣으면, 각 행에 대한 예측값(또는 확률)을 계산해 원본 표 옆에 'Predict' 열로 붙여 줍니다.",
    analysisMethod:
      "학습된 모델로 입력 데이터에 model.predict(X)(분류는 필요 시 predict_proba로 확률)를 적용해 예측을 산출합니다. 학습 때 쓴 피처 컬럼·인코딩·스케일링 기준이 입력 데이터에도 동일해야 결과가 맞습니다. 예측 결과를 원본에 합쳐 EvaluateModel 등으로 넘깁니다.",
    role: "학습된 모델로 새 데이터의 예측값/확률을 계산합니다.",
    input: "학습된 모델(trained_model) + X_test (또는 신규 데이터).",
    output: "예측 결과 DataFrame (원본 + Predict 컬럼).",
    whenToUse: "학습된 모델로 테스트셋/실데이터를 예측해 결과를 산출할 때.",
    connections: "TrainModel → ScoreModel ←(data) SplitData.test → EvaluateModel.",
    commonErrors: "학습에 쓰인 피처 컬럼과 추론 데이터의 컬럼이 일치해야 합니다. 인코딩/스케일링 기준도 동일해야 합니다.",
  },
  [ModuleType.EvaluateModel]: {
    title: "Evaluate Model",
    category: "모델 연산",
    beginner:
      "모델의 '시험 성적표'를 만들어 주는 블록입니다. 예측값과 실제 정답을 맞대어, 얼마나 잘 맞혔는지를 여러 점수로 보여 줍니다. 모델을 골라야 할 때 이 성적표로 어느 쪽이 더 나은지 객관적으로 비교합니다.",
    analysisMethod:
      "분류는 정확도·정밀도·재현율·F1과 혼동행렬, 확률이 있으면 ROC-AUC·Average Precision을, 회귀는 MSE·RMSE·MAE·R²와 상대오차(RSE/RAE)·잔차 요약을 계산합니다(모두 .6f로 고정 출력해 결정적). 고정된 예측·정답으로 계산하므로 같은 입력이면 같은 점수가 재현됩니다.",
    role: "분류는 Accuracy/Precision/Recall/F1/AUC, 회귀는 MSE/RMSE/MAE/R² 등을 산출합니다.",
    input: "예측 결과(scored_data) + 실제값(label).",
    output: "지표 표 + 혼동행렬 / 잔차 plot.",
    parameters: "model_type(classification/regression) · label_column · prediction_column",
    whenToUse: "모델 성능을 정량 지표로 확인하고 모델 간 비교를 할 때.",
    connections: "ScoreModel → EvaluateModel. 또는 TrainModel→(model_in) + SplitData.test→(data_in).",
    commonErrors: "model_type(분류/회귀)을 실제 타깃과 맞춰야 지표가 맞습니다. 라벨/예측 컬럼명을 정확히 지정하세요.",
  },

  // ===== Unsupervised: Clustering / Dimensionality Reduction =====
  [ModuleType.KMeans]: {
    title: "K-Means Clustering",
    category: "비지도학습",
    beginner:
      "정답 없이 '비슷한 것끼리 K개 무리로 묶는' 블록입니다. 손님들을 구매 패턴이 닮은 K개 그룹으로 나누듯, 가까이 모인 점들을 같은 군집으로 자동 분류합니다. 미리 몇 개 그룹으로 나눌지(K)를 정해 줘야 합니다.",
    analysisMethod:
      "K개의 중심점을 잡고, 각 점을 가장 가까운 중심에 배정한 뒤 그 무리의 평균으로 중심을 옮기는 과정을 변화가 멈출 때까지 반복합니다(sklearn KMeans, random_state=42로 결정적). 거리 기반이라 스케일링이 중요하고, 구형(둥근)·크기가 비슷한 군집에 잘 맞습니다. 적합은 TrainClusteringModel에서 수행합니다.",
    role: "K개 중심으로 데이터를 군집화합니다. 구형(등방) 클러스터에 적합.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainClusteringModel.",
    output: "학습되지 않은 KMeans 추정기(model).",
    parameters: "n_clusters(3) · init(k-means++) · n_init(10) · max_iter(300) · random_state(42)",
    whenToUse: "군집 개수를 대략 알고 있고, 크기가 비슷한 둥근 군집을 빠르게 나누고 싶을 때.",
    connections: "(model_in)KMeans · (data_in)데이터 → TrainClusteringModel → ClusteringData(cluster 라벨).",
    commonErrors: "스케일링을 빠뜨리면 단위 큰 변수가 거리를 지배합니다. K는 Elbow/Silhouette로 선택. 비구형/밀도 군집엔 DBSCAN을 쓰세요.",
  },
  [ModuleType.PCA]: {
    title: "Principal Component Analysis",
    category: "비지도학습 (차원축소)",
    beginner:
      "열이 너무 많은 데이터를 '핵심 몇 개 축으로 압축'하는 블록입니다. 비슷비슷한 정보를 담은 여러 변수를, 정보 손실을 최소화하며 2~3개의 새 축으로 요약합니다. 고차원 데이터를 그래프로 그려 보거나, 중복 변수를 줄일 때 씁니다.",
    analysisMethod:
      "데이터의 분산이 가장 큰(정보가 가장 많은) 직교 방향들을 차례로 찾아 그 축으로 좌표를 다시 매깁니다(sklearn PCA). 첫 주성분에 가장 많은 분산이, 다음 주성분에 그 다음이 담깁니다. 분산 기준이라 스케일링이 없으면 단위 큰 변수에 축이 쏠립니다. 적합은 TrainClusteringModel에서 수행합니다.",
    role: "분산이 최대인 직교 방향(주성분)으로 데이터를 변환합니다. 시각화/잡음 제거/특성 추출.",
    input: "(모델 정의) 하이퍼파라미터만. 적합은 TrainClusteringModel.",
    output: "학습되지 않은 PCA 추정기(model).",
    parameters: "n_components(2)",
    whenToUse: "고차원 데이터를 2~3차원으로 시각화하거나, 상관된 피처를 압축할 때.",
    connections: "ScalingTransform → (model_in)PCA → TrainClusteringModel → ClusteringData(PC1, PC2…).",
    commonErrors: "스케일링이 없으면 분산 큰 변수에 주성분이 쏠립니다. 주성분은 해석이 어려울 수 있습니다.",
  },
  [ModuleType.DBSCAN]: {
    title: "DBSCAN Clustering",
    category: "비지도학습",
    beginner:
      "'빽빽하게 모인 곳'을 군집으로 보고, 외딴 점은 노이즈로 걸러 내는 블록입니다. 별이 촘촘한 영역을 하나의 별자리로 묶듯, 밀도가 높은 덩어리를 자동으로 찾습니다. 군집 수를 미리 정하지 않아도 되고, 길쭉하거나 휘어진 모양의 군집도 잡아냅니다.",
    analysisMethod:
      "각 점 주변 반경(eps) 안의 이웃 수가 min_samples 이상이면 '핵심점'으로 보고, 핵심점끼리 밀도로 연결된 점들을 한 군집으로 묶습니다(sklearn DBSCAN). 어디에도 속하지 못한 점은 노이즈(-1)로 표시합니다. 새 데이터를 예측하지 못하는(transductive) 알고리즘이라 fit 시점의 labels_를 그대로 씁니다.",
    role: "밀도 기반 군집화. 임의 모양의 군집을 찾고 밀도가 낮은 점은 노이즈(-1)로 표시합니다. 군집 수를 미리 정하지 않습니다.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainClusteringModel.",
    output: "학습되지 않은 DBSCAN 추정기(model). 적합 시 각 점에 cluster 라벨(-1=노이즈) 부여.",
    parameters: "eps(이웃 반경, 0.5) · min_samples(핵심점 최소 이웃 수, 5)",
    whenToUse: "군집 개수를 모르거나, 비구형 군집·이상치 검출이 필요할 때. KMeans가 잘 안 되는 경우의 대안.",
    connections: "ScalingTransform → (model_in)DBSCAN · (data_in)데이터 → TrainClusteringModel → ClusteringData.",
    commonErrors: "eps가 너무 작으면 대부분 노이즈(-1), 크면 한 덩어리가 됩니다 — 스케일링 후 조정하세요. transductive라 새 데이터 예측 불가: ClusteringData에는 학습과 동일한 데이터를 연결해야 합니다.",
    notes: "transductive 알고리즘 — .predict가 없어 .fit으로 계산한 labels_를 그대로 사용합니다.",
  },
  [ModuleType.HierarchicalClustering]: {
    title: "Hierarchical Clustering",
    category: "비지도학습",
    beginner:
      "가까운 것끼리 차례차례 합쳐 가며 '가계도 같은 군집 나무'를 만드는 블록입니다. 가장 비슷한 두 점을 묶고, 그 묶음을 또 다른 묶음과 합치는 식으로 위로 쌓아 올린 뒤, 원하는 군집 수에서 나무를 잘라 그룹을 정합니다.",
    analysisMethod:
      "각 점을 하나의 군집으로 시작해, linkage 기준(ward·complete·average·single)에 따라 가장 가까운 두 군집을 반복 병합하는 병합형(agglomerative) 방식입니다(sklearn AgglomerativeClustering). 지정한 n_clusters에서 멈춰 라벨을 부여하며, ward는 euclidean 거리만 지원합니다. transductive라 fit 시점 라벨을 그대로 씁니다.",
    role: "점들을 아래에서 위로 병합(Agglomerative)해 군집 트리를 만든 뒤, 지정한 군집 수로 자릅니다.",
    input: "(모델 정의) 하이퍼파라미터만. 학습은 TrainClusteringModel.",
    output: "학습되지 않은 AgglomerativeClustering 추정기(model). 적합 시 cluster 라벨 부여.",
    parameters: "n_clusters(3) · linkage(ward/complete/average/single) · metric(euclidean; ward는 euclidean 강제)",
    whenToUse: "군집 간 계층 구조를 보고 싶거나, 군집 수를 사후에 조정하며 탐색할 때.",
    connections: "ScalingTransform → (model_in)Hierarchical · (data_in)데이터 → TrainClusteringModel → ClusteringData.",
    commonErrors: "transductive라 새 데이터 예측 불가: ClusteringData에 학습과 동일한 데이터를 연결하세요. 표본이 크면 메모리·시간이 급증합니다.",
    notes: "transductive 알고리즘 — .labels_를 그대로 사용. ward linkage는 euclidean metric만 지원합니다.",
  },
  [ModuleType.TrainClusteringModel]: {
    title: "Train Clustering Model",
    category: "비지도학습",
    beginner:
      "비지도 모델(군집·차원축소)을 실제 데이터에 '학습시키는' 블록입니다. 지도학습의 Train Model과 같은 역할로, 앞에서 고른 KMeans/PCA/DBSCAN/Hierarchical 정의에 데이터를 넣어 패턴을 익히게 합니다.",
    analysisMethod:
      "model_in으로 들어온 추정기에 수치형 데이터를 넣어 model.fit(X)를 실행합니다. feature_columns를 비우면 모든 수치형 컬럼을 자동으로 사용합니다. KMeans/PCA는 새 데이터에도 적용 가능한 학습된 모델을, DBSCAN/Hierarchical은 fit 시점 라벨을 산출하며, 결과를 ClusteringData로 넘깁니다.",
    role: "클러스터링/차원축소 모델 정의(KMeans/PCA/DBSCAN/Hierarchical)를 데이터에 적합(fit)시킵니다.",
    input: "model_in: 추정기 정의 + data_in: DataFrame(수치형).",
    output: "학습된(적합된) 모델. ClusteringData로 연결.",
    parameters: "feature_columns(비우면 모든 수치형 컬럼 자동 사용)",
    whenToUse: "비지도 추정기를 실제 데이터에 학습시킬 때(지도학습의 TrainModel에 해당).",
    connections: "(model_in)KMeans/PCA/DBSCAN/Hierarchical · (data_in)전처리 데이터 → TrainClusteringModel → ClusteringData.",
    commonErrors: "model_in·data_in 둘 다 연결 필수. 수치형 컬럼이 없으면 실패 — 인코딩/스케일링을 먼저 적용하세요.",
  },
  [ModuleType.ClusteringData]: {
    title: "Clustering Data",
    category: "비지도학습",
    beginner:
      "학습된 비지도 모델의 결과를 '데이터 표에 적어 넣는' 블록입니다. 각 행이 몇 번 군집에 속하는지(군집 번호)나, 압축된 새 좌표(주성분)를 원본 표에 새 열로 붙여 줍니다. 이렇게 만든 결과를 그래프나 후속 분석에 씁니다.",
    analysisMethod:
      "학습된 모델 종류에 따라 결과를 부여합니다: KMeans는 model.predict로 각 행에 cluster 번호를, PCA는 transform으로 주성분(PC1, PC2…) 값을, DBSCAN/Hierarchical은 fit 시점의 labels_(노이즈 -1 포함)를 그대로 붙입니다. 후자는 새 데이터 예측이 안 되므로 학습에 쓴 동일 데이터를 연결해야 합니다.",
    role: "학습된 모델로 데이터에 결과를 부여합니다. 군집(KMeans)은 cluster 라벨, PCA는 주성분(PC1,PC2…), 밀도/계층(DBSCAN/Hierarchical)은 fit 시점 라벨.",
    input: "model_in: 학습된 모델 + data_in: DataFrame.",
    output: "cluster 라벨 또는 주성분 컬럼이 추가된 DataFrame.",
    whenToUse: "학습된 클러스터링/PCA 결과를 실제 데이터에 적용해 산출물을 만들 때.",
    connections: "TrainClusteringModel → ClusteringData ←(data_in)데이터 → (시각화/후속 분석).",
    commonErrors: "DBSCAN·Hierarchical(transductive)은 새 데이터를 예측할 수 없어, 학습에 쓴 동일 데이터를 data_in에 연결해야 합니다(행 수 불일치 시 오류). KMeans/PCA는 새 데이터도 가능.",
  },
  [ModuleType.Recommender]: {
    title: "Recommender",
    category: "추천 (협업 필터링)",
    beginner:
      "'나와 취향이 비슷한 사람들이 좋아한 것'을 골라 추천해 주는 블록입니다. 넷플릭스·쇼핑몰의 '이런 상품 어때요?'처럼, 사용자-아이템 평점 기록에서 아직 안 본 항목 중 좋아할 만한 것을 사용자별로 골라 줍니다.",
    analysisMethod:
      "긴 형태(사용자-아이템-평점) 표를 사용자×아이템 행렬로 펼친 뒤, NMF(비음수 행렬분해, random_state=42로 결정적)로 숨은 취향 요인을 찾아 빈칸(아직 평가 안 한 아이템)의 점수를 복원합니다. 그 복원 점수가 높은 순으로 사용자마다 Top-N 아이템을 추천합니다(Pyodide 미지원 surprise 대신 sklearn NMF 사용).",
    role: "long-format 평점 테이블에서 user×item 행렬을 만들고 NMF 행렬분해(random_state=42)로 미관측 평점을 복원해 사용자별 Top-N 아이템을 추천합니다. (책 Ch7 Matchbox Recommender 대응 — Pyodide 미지원 'surprise' 대신 sklearn NMF 사용)",
    input: "data_in: long-format 평점 테이블(한 행 = 한 사용자의 한 아이템 평점).",
    output: "추천 결과 DataFrame(user_col, rank, item_col, predicted_rating) — 일반 데이터 미리보기로 확인.",
    parameters: "user_col · item_col · rating_col · n_components(잠재 요인 수, 기본 2) · top_n(사용자별 추천 수, 기본 5) · random_state=42(고정·결정적)",
    whenToUse: "사용자-아이템 평점/선호 데이터로 추천 목록을 만들 때. 보험·헬스케어 교차판매(가입자→서비스/상품 추천) 시나리오에도 활용.",
    connections: "LoadData(평점 테이블) → (data_in)Recommender → 데이터 미리보기.",
    commonErrors: "입력은 wide(피벗된) 행렬이 아니라 long-format(user_id, item_id, rating 3열)이어야 합니다. 컬럼 매핑이 비어 있으면 실행되지 않습니다. n_components는 사용자 수·아이템 수보다 작아야 의미가 있습니다.",
  },

  // ===== Stat Models (Traditional) =====
  [ModuleType.StatModels]: {
    title: "Stat Models",
    category: "전통 통계 모델",
    beginner:
      "예측 정확도보다 '각 변수가 정말 의미 있는 영향을 주는지'를 따지는 전통 통계 모델 블록입니다. 단순히 답을 맞히는 게 아니라, 변수별 영향력과 그 신뢰도(p-value·신뢰구간)를 표로 보여 주어 해석과 설명에 강합니다.",
    analysisMethod:
      "statsmodels로 타깃 분포에 맞는 GLM을 적합합니다: 연속형은 OLS, 이진은 Logit, 카운트는 Poisson/음이항, 양의 연속·보험손해는 Gamma/Tweedie. 각 계수의 추정값·표준오차·t/z 통계량·p-value·신뢰구간을 산출해 통계적 추론을 가능하게 합니다.",
    role: "OLS/Logit/Poisson/NB/Gamma/Tweedie GLM을 statsmodels로 적합. 계수 신뢰구간/p-value 산출.",
    input: "X_train, y_train.",
    output: "적합된 모델 + 계수표.",
    parameters: "model: OLS / Logit / Poisson / NegativeBinomial / Gamma / Tweedie",
    whenToUse: "예측보다 계수의 유의성·신뢰구간 등 통계적 추론이 중요할 때.",
    connections: "전처리 데이터 → StatModels → ResultModel/EvaluateStat.",
    commonErrors: "model 종류를 타깃 분포와 맞춰야 합니다(카운트→Poisson/NB, 이진→Logit).",
  },
  [ModuleType.OLSModel]: {
    title: "OLS Model",
    category: "전통 통계 모델",
    beginner:
      "직선식으로 숫자를 설명하되, '각 변수가 통계적으로 유의한지'까지 알려 주는 블록입니다. 면적·층수가 집값에 얼마씩 영향을 주는지, 그 영향이 우연이 아닌지를 p-value로 함께 보여 줍니다. 해석 중심의 선형회귀입니다.",
    analysisMethod:
      "최소제곱법으로 선형회귀 계수를 추정하고, 각 계수의 t-통계량·p-value·신뢰구간과 모델 설명력 R²를 statsmodels로 산출합니다. 이 모듈은 정의만 만들고 실제 적합 결과는 ResultModel이 생성합니다. 잔차의 정규성·등분산 가정 점검이 권장됩니다.",
    role: "최소제곱 선형회귀. 계수, t-stat, p-value, R² 산출.",
    input: "(모델 정의) DataFrame + 종속·독립 변수 지정.",
    output: "정의 객체. 실제 적합 결과는 ResultModel이 생성.",
    whenToUse: "연속형 타깃의 선형 관계와 각 변수의 유의성을 해석할 때.",
    connections: "(model_in)OLSModel → ResultModel(적합·계수표). 다중공선성은 VIFChecker로 점검.",
    commonErrors: "이 모듈은 정의만 합니다 — 적합 결과는 ResultModel에 연결해야 나옵니다. 잔차 정규성·등분산 가정을 확인하세요.",
  },
  [ModuleType.LogisticModel]: {
    title: "Logistic Model",
    category: "전통 통계 모델",
    beginner:
      "'발생/비발생' 같은 이진 결과에 대해, 각 요인이 발생 가능성을 몇 배로 바꾸는지(오즈비) 해석하는 블록입니다. 예컨대 흡연이 질병 발생 오즈를 몇 배 높이는지를 통계적 유의성과 함께 보여 줍니다.",
    analysisMethod:
      "이진 종속변수에 로지스틱 GLM을 적합해 각 변수의 계수를 추정하고, 이를 지수변환한 오즈비(odds ratio)와 Wald p-value·신뢰구간을 statsmodels로 산출합니다. 정의만 만들고 적합 결과는 ResultModel이 생성합니다. 완전분리가 있으면 계수가 발산할 수 있습니다.",
    role: "이진 로지스틱 GLM. odds ratio, Wald p-value 산출.",
    input: "(모델 정의) DataFrame + 이진 종속 변수.",
    output: "정의 객체. 적합 결과는 ResultModel.",
    whenToUse: "이진 결과(발생/비발생)에 대한 변수별 오즈비를 해석할 때.",
    connections: "(model_in)LogisticModel → ResultModel(오즈비·p-value).",
    commonErrors: "완전분리(perfect separation)가 있으면 계수가 발산합니다. 종속변수는 0/1 이진이어야 합니다.",
  },
  [ModuleType.PoissonModel]: {
    title: "Poisson Model",
    category: "전통 통계 모델",
    beginner:
      "발생 '건수'를 모델링하되, 각 요인이 발생률에 주는 영향을 해석하는 블록입니다. 가입자마다 관찰 기간이 다른 경우, 노출량을 반영해 '단위 기간당 발생률'로 공정하게 비교합니다.",
    analysisMethod:
      "카운트 종속변수에 Poisson GLM(log link)을 적합하고, 관찰 규모 차이는 offset(노출량의 로그)으로 반영해 발생률로 모델링합니다. 각 계수는 발생률 비(rate ratio)로 해석되며 p-value와 함께 statsmodels로 산출합니다. 정의만 만들고 적합 결과는 ResultModel이 생성합니다.",
    role: "Poisson GLM. 카운트 데이터 + offset(노출량) 지원.",
    input: "(모델 정의) DataFrame + count 종속 변수 (+ offset).",
    output: "정의 객체. 적합 결과는 ResultModel.",
    whenToUse: "발생 건수를 노출량 대비로 모델링할 때(발생률).",
    connections: "(model_in)PoissonModel → ResultModel. 과대분산이면 NegativeBinomialModel.",
    commonErrors: "과대분산을 무시하면 p-value가 과소추정됩니다 — EvaluateStat의 deviance로 점검.",
  },
  [ModuleType.QuasiPoissonModel]: {
    title: "Quasi-Poisson Model",
    category: "전통 통계 모델",
    beginner:
      "카운트 모델인데 값의 흩어짐이 평균보다 조금~중간 정도 큰 경우, 그 흩어짐을 '한꺼번에 보정'해 주는 블록입니다. 모델 형태는 Poisson과 같지만, p-value가 너무 낙관적으로 나오지 않도록 표준오차를 키워 줍니다.",
    analysisMethod:
      "Poisson GLM을 적합하되 분산이 평균의 상수배(분산 = φ·평균)라고 가정하고, 추정한 분산 팽창계수 φ로 표준오차를 보정합니다. 계수 추정값 자체는 Poisson과 같고 유의성 판정만 더 보수적이 됩니다. 강한 과대분산에는 음이항이 더 적절합니다.",
    role: "과대분산 보정 Poisson. 분산이 평균의 상수배라고 가정.",
    input: "(모델 정의) DataFrame + count 종속.",
    output: "정의 객체. 적합 결과는 ResultModel.",
    whenToUse: "경미~중간 과대분산을 표준오차 보정으로 다루고 싶을 때.",
    connections: "(model_in)QuasiPoissonModel → ResultModel.",
    commonErrors: "강한 과대분산은 NegativeBinomial이 더 적절합니다.",
  },
  [ModuleType.NegativeBinomialModel]: {
    title: "Negative Binomial Model",
    category: "전통 통계 모델",
    beginner:
      "흩어짐이 평균보다 뚜렷이 큰 카운트 데이터를 해석하는 전통 통계 블록입니다. Poisson으로는 부족한 큰 변동을 추가 모수로 흡수해, 계수의 유의성을 더 정확하게 평가합니다.",
    analysisMethod:
      "음이항 GLM을 적합하며, 과대분산의 정도를 나타내는 모수 α를 데이터에서 자유롭게 추정합니다(statsmodels). 이로써 표준오차·p-value를 과소추정하지 않게 보정합니다. 과대분산이 없으면 더 단순한 Poisson이 안정적이며, 정의만 만들고 적합은 ResultModel이 생성합니다.",
    role: "NB GLM. 과대분산 카운트에 적합 (α 자유 추정).",
    input: "(모델 정의) DataFrame + count 종속.",
    output: "정의 객체. 적합 결과는 ResultModel.",
    whenToUse: "카운트 타깃의 분산이 평균보다 뚜렷이 클 때.",
    connections: "(model_in)NegativeBinomialModel → ResultModel.",
    commonErrors: "과대분산이 없으면 Poisson이 더 단순합니다. α 추정이 불안정하면 표본/공변량을 점검하세요.",
  },
  [ModuleType.DiversionChecker]: {
    title: "Diversion Checker",
    category: "데이터 품질",
    beginner:
      "두 데이터셋이 '얼마나 달라졌는지'를 비교해 주는 블록입니다. 예를 들어 모델을 학습할 때의 데이터와 지금 운영 중인 데이터의 분포가 변했는지(데이터 드리프트) 점검합니다. 너무 변했다면 모델을 다시 학습해야 한다는 신호입니다.",
    analysisMethod:
      "두 데이터셋의 같은 컬럼끼리 분포 차이를 정량화합니다: KS 통계량(누적분포 최대 차이), PSI(집단 안정성 지수), Wasserstein 거리 등을 계산해 컬럼별 drift 점수와 위험 등급을 매깁니다. 두 데이터의 컬럼 구성이 동일해야 비교됩니다.",
    role: "두 데이터셋의 분포 차이(KS, PSI, Wasserstein 등)를 비교해 drift를 진단합니다.",
    input: "DataFrame 2개 (예: train vs prod).",
    output: "컬럼별 drift 점수 + 위험 등급.",
    whenToUse: "학습 데이터와 운영 데이터의 분포가 달라졌는지(데이터 드리프트) 점검할 때.",
    connections: "두 데이터 소스 → DiversionChecker.",
    commonErrors: "두 데이터의 컬럼 구성이 동일해야 비교됩니다.",
  },
  [ModuleType.EvaluateStat]: {
    title: "Evaluate Stat",
    category: "모델 연산",
    beginner:
      "전통 통계 모델의 '적합도 성적표'를 만들어 주는 블록입니다. 모델이 데이터를 얼마나 잘 설명하는지, 여러 모델 중 어느 쪽이 더 나은지를 통계 지표로 비교하고, 가정 위반(잔차의 이상 패턴)도 점검합니다.",
    analysisMethod:
      "적합된 statsmodels 결과에서 AIC·BIC(작을수록 좋음, 모델 비교용)·deviance·pseudo-R² 같은 적합도 지표를 뽑고, 잔차를 그려 패턴·이상치를 진단합니다. AIC/BIC는 동일 데이터에 적합한 모델끼리만 비교가 유효합니다.",
    role: "전통 통계 모델의 적합도(AIC, BIC, deviance, pseudo-R²) 및 잔차 진단을 수행합니다.",
    input: "적합된 statsmodels 결과.",
    output: "적합도 지표 + 잔차 plot.",
    whenToUse: "GLM/회귀의 적합도를 비교하거나 가정 위반(잔차 패턴)을 진단할 때.",
    connections: "StatModels/ResultModel → EvaluateStat.",
    commonErrors: "AIC/BIC는 동일 데이터에 적합한 모델끼리만 비교 가능합니다.",
  },
  [ModuleType.VIFChecker]: {
    title: "VIF Checker",
    category: "데이터 품질",
    beginner:
      "입력 변수들이 '서로 너무 닮아서 겹치는지'를 점검하는 블록입니다. 키와 키(cm)·키(inch)처럼 같은 정보를 담은 변수가 함께 있으면 회귀 계수가 불안정해지는데, 이런 중복(다중공선성)을 변수별 점수로 알려 줍니다.",
    analysisMethod:
      "각 독립변수를 나머지 변수들로 회귀했을 때의 설명력 R²로 VIF = 1/(1−R²)를 계산합니다(statsmodels). VIF가 클수록 그 변수가 다른 변수들로 잘 설명된다는 뜻이며, 통상 10을 넘으면 다중공선성 위험으로 봅니다. 높은 변수를 한 번에 다 빼지 말고 하나씩 재평가합니다.",
    role: "Variance Inflation Factor로 다중공선성을 진단합니다. 통상 VIF>10이면 위험.",
    input: "DataFrame (수치형).",
    output: "변수별 VIF 표.",
    whenToUse: "회귀 전 독립변수 간 중복(다중공선성)으로 계수가 불안정해질지 점검할 때.",
    connections: "Correlation(탐색) → VIFChecker → 변수 제거/Ridge.",
    commonErrors: "범주형은 인코딩 후 평가하세요. VIF가 높은 변수를 한 번에 다 빼지 말고 하나씩 재평가합니다.",
  },

  // ===== Result / Predict =====
  [ModuleType.ResultModel]: {
    title: "Result Model",
    category: "출력",
    beginner:
      "통계 모델 정의 블록(OLS·Logit 등)을 받아 '실제로 적합시키고 결과표를 펼쳐 주는' 블록입니다. 정의만 해 둔 모델을 여기에 연결해야 비로소 계수·p-value·적합도 같은 진짜 분석 결과를 볼 수 있습니다.",
    analysisMethod:
      "연결된 통계 모델 정의의 종류에 맞춰 statsmodels로 적합(fit)을 수행하고, 계수표(추정값·표준오차·p-value·신뢰구간)와 적합도 진단을 종합한 결과 뷰를 만듭니다. 정의 모듈마다 적합 코드가 달라지므로 반드시 model_in에 정의 모듈을 연결해야 합니다.",
    role: "통계 모델 정의(OLS/Logit 등)를 받아 실제 적합을 수행하고, 계수표·진단을 종합 출력합니다.",
    input: "model_in: 통계 모델 정의 + 데이터.",
    output: "적합 결과(계수·p-value·적합도) 통합 뷰.",
    whenToUse: "OLSModel 등 statsmodels 정의 모듈의 적합 결과를 실제로 산출할 때.",
    connections: "OLSModel/LogisticModel/… → ResultModel → EvaluateStat.",
    commonErrors: "연결된 모델 정의 종류에 따라 코드가 달라집니다 — 정의 모듈을 model_in에 연결해야 합니다.",
  },
  [ModuleType.PredictModel]: {
    title: "Predict Model",
    category: "모델 연산",
    beginner:
      "학습된 모델로 새 데이터를 예측하고, 그 결과를 '위험 등급(높음/중간/낮음 등)으로 분류'까지 해 주는 블록입니다. 예측값만 내는 데서 한 걸음 더 나아가, 실무에서 바로 쓰기 좋은 등급으로 묶어 줍니다.",
    analysisMethod:
      "학습된 모델에 신규 입력을 넣어 예측값(또는 확률)을 계산한 뒤, 정해진 기준(임계값·구간)에 따라 위험 카테고리로 분류합니다. 신규 데이터의 피처·전처리(인코딩·스케일링)가 학습 시와 동일해야 예측이 올바릅니다.",
    role: "학습된 모델 + 신규 데이터로 예측 + 위험 카테고리 분류.",
    input: "학습된 모델 + 신규 X.",
    output: "예측값 + 위험 등급.",
    whenToUse: "학습된 모델을 새 데이터에 적용해 예측·위험 분류를 산출할 때.",
    connections: "TrainModel → PredictModel ←(신규 데이터).",
    commonErrors: "신규 데이터의 피처/전처리가 학습 시와 동일해야 합니다.",
  },

  // ===== Mortality =====
  [ModuleType.MortalityResult]: {
    title: "Mortality Result",
    category: "사망률 모델",
    beginner:
      "사망률 모델의 적합·예측 결과를 '표와 그래프로 종합해 보여 주는' 블록입니다. Lee-Carter 등 사망률 모델을 돌린 뒤, 연령·연도별 예측 사망률과 생명표(life table)를 한눈에 정리합니다.",
    analysisMethod:
      "연결된 사망률 모델 객체에서 추정된 모수와 예측 사망률을 받아 연령×연도 형태로 정리하고, 생존·사망 확률을 누적해 생명표를 구성해 표·그래프로 출력합니다. 입력 사망률 행렬에 결측·0 값이 있으면 적합·집계가 방해받을 수 있습니다.",
    role: "사망률 모델 적합 결과를 표·그래프로 종합합니다.",
    input: "사망률 모델 객체.",
    output: "예측 사망률 + life table.",
    whenToUse: "Lee-Carter/CBD 등 사망률 모델의 적합·예측 결과를 종합 확인할 때.",
    connections: "LeeCarter/CBD/APC/RH/Plat/PSpline → MortalityResult.",
    commonErrors: "입력 사망률 행렬(연령×연도)의 결측·0 값이 모델 적합을 방해할 수 있습니다.",
  },
  [ModuleType.LeeCarterModel]: {
    title: "Lee-Carter Model",
    category: "사망률 모델",
    beginner:
      "시대가 지날수록 사람들이 얼마나 오래 사는지(사망률 추세)를 모델링하는 대표적 블록입니다. '연령별 기본 수준'과 '해마다 변하는 전반적 추세'를 분리해, 미래 사망률을 예측하는 데 씁니다.",
    analysisMethod:
      "로그 사망률을 연령 효과 ax(연령별 평균 수준) + 시기 효과 kt(연도별 변동) × 민감도 bx(연령별 반응 정도)로 분해합니다. 보통 SVD(특이값분해)로 ax·bx·kt를 추정하고, kt의 시계열 추세를 외삽해 미래 사망률을 예측합니다. 연도가 너무 짧으면 추세 추정이 불안정합니다.",
    role: "Lee-Carter 분해(age ax + period kt × bx)로 로그 사망률을 모델링.",
    input: "연령×연도 사망률 행렬.",
    output: "ax, bx, kt 추정치 + 예측.",
    whenToUse: "장기 사망률 추세를 모델링·예측하는 표준 베이스라인이 필요할 때.",
    connections: "TransitionData(행렬화) → LeeCarterModel → MortalityResult.",
    commonErrors: "연도가 너무 짧으면 kt 추세 추정이 불안정합니다.",
  },
  [ModuleType.CBDModel]: {
    title: "CBD Model",
    category: "사망률 모델",
    beginner:
      "특히 '고령층' 사망률을 잘 설명하도록 만든 사망률 모델 블록입니다. 연금·생명보험처럼 노년 구간이 중요한 경우에 적합합니다. 두 개의 시간 흐름 요인으로 사망률의 수준과 연령 기울기를 함께 잡아냅니다.",
    analysisMethod:
      "logit 변환한 사망률을, 연도별로 변하는 두 시계열 요인(전반적 수준 κ1과 연령에 따른 기울기 κ2)의 선형 결합으로 모델링하는 Cairns-Blake-Dowd 2-요인 모델입니다. 두 요인 시계열을 외삽해 고령 구간을 예측합니다. 저연령 구간에는 적합이 떨어질 수 있습니다.",
    role: "Cairns-Blake-Dowd 2-factor 모델. 고령층 사망률에 강점.",
    input: "logit 변환 사망률.",
    output: "두 시계열 요인 + 예측.",
    whenToUse: "고연령(연금·생명) 사망률을 모델링할 때.",
    connections: "TransitionData → CBDModel → MortalityResult.",
    commonErrors: "저연령 구간에는 적합이 떨어질 수 있습니다.",
  },
  [ModuleType.APCModel]: {
    title: "APC Model",
    category: "사망률 모델",
    beginner:
      "사망률을 '나이(Age)·시대(Period)·출생세대(Cohort)' 세 영향으로 나눠 보는 블록입니다. 예컨대 특정 연도에 태어난 세대가 유독 건강/취약한 '세대 효과'를 따로 떼어 보고 싶을 때 씁니다.",
    analysisMethod:
      "로그 사망률을 연령 효과 + 기간 효과 + 코호트(출생연도=연도−연령) 효과의 합으로 모델링합니다. 세 효과는 서로 선형 종속(식별 문제)이라 제약 가정을 두어 추정하며, 가정에 따라 각 효과의 해석이 달라질 수 있습니다. 코호트 효과 분리가 핵심 목적입니다.",
    role: "Age-Period-Cohort 모델. 코호트 효과 분리.",
    input: "연령×연도 사망률.",
    output: "APC 분해 + 예측.",
    whenToUse: "출생 코호트 효과를 분리해 보고 싶을 때.",
    connections: "TransitionData → APCModel → MortalityResult.",
    commonErrors: "APC는 식별(identification) 문제가 있어 제약 가정에 따라 해석이 달라집니다.",
  },
  [ModuleType.RHModel]: {
    title: "RH Model",
    category: "사망률 모델",
    beginner:
      "Lee-Carter 모델에 '출생세대 효과'를 더 얹어 적합을 개선한 블록입니다. 기본 추세만으로는 설명이 부족할 때, 세대별 차이까지 반영해 사망률을 더 정밀하게 맞춥니다.",
    analysisMethod:
      "Lee-Carter 분해(ax + bx·kt)에 코호트 항(연령 민감도 × 출생세대 효과 γ)을 추가한 Renshaw-Haberman 모델입니다. 연령·시기·코호트 모수를 반복 추정해 적합하며, 추정이 까다로워 수렴 문제가 생길 수 있어 데이터 기간·격자를 점검해야 합니다.",
    role: "Renshaw-Haberman: Lee-Carter + cohort term.",
    input: "연령×연도 사망률.",
    output: "RH 적합 + 예측.",
    whenToUse: "Lee-Carter에 코호트 효과를 추가해 적합을 개선하고 싶을 때.",
    connections: "TransitionData → RHModel → MortalityResult.",
    commonErrors: "수렴이 까다로울 수 있습니다 — 데이터 기간/격자를 확인하세요.",
  },
  [ModuleType.PlatModel]: {
    title: "Plat Model",
    category: "사망률 모델",
    beginner:
      "여러 사망률 모델의 장점을 합쳐 '전 연령대를 두루 잘 맞추도록' 만든 유연한 블록입니다. 저연령부터 고연령까지 한 모델로 폭넓게 설명하고 싶을 때 적합합니다.",
    analysisMethod:
      "전반적 수준·연령 기울기를 나타내는 여러 기간 요인과 코호트 효과를 결합한 다요인 모델로, Lee-Carter와 CBD의 구조를 아우릅니다. 모수가 많아 표현력이 크지만, 표본이 작으면 과적합·추정 불안정이 생길 수 있습니다.",
    role: "Plat 모델: 연령·기간·코호트를 결합한 다요인 사망률 모델.",
    input: "연령×연도 사망률.",
    output: "Plat 적합 + 예측.",
    whenToUse: "전 연령대를 아우르는 유연한 사망률 모델이 필요할 때.",
    connections: "TransitionData → PlatModel → MortalityResult.",
    commonErrors: "모수가 많아 표본이 작으면 과적합/불안정.",
  },
  [ModuleType.PSplineModel]: {
    title: "P-Spline Model",
    category: "사망률 모델",
    beginner:
      "사망률 데이터의 울퉁불퉁한 표면을 '부드러운 곡면으로 매끈하게 다듬는' 블록입니다. 특정 모델 형태를 가정하지 않고, 데이터 흐름을 따라가되 너무 들쭉날쭉하지 않게 평활합니다.",
    analysisMethod:
      "연령·연도에 걸쳐 스플라인 기저함수를 깔고, 인접 계수 차이에 벌점(penalty)을 주어 매끄러움과 적합도 사이 균형을 맞추는 penalized spline 방식입니다. 평활 모수가 크면 과도하게 매끈해지고(과평활), 작으면 잡음까지 따라가(과적합) 균형 조정이 중요합니다.",
    role: "Penalized spline으로 사망률 곡면을 매끄럽게 적합.",
    input: "연령×연도 사망률.",
    output: "스무딩된 곡면 + 예측.",
    whenToUse: "구조적 가정 없이 사망률 표면을 부드럽게 적합·평활하고 싶을 때.",
    connections: "TransitionData → PSplineModel → MortalityResult.",
    commonErrors: "평활 모수가 크면 과평활, 작으면 과적합 — 균형을 확인하세요.",
  },

  // ===== Freq-Sev Simulation =====
  [ModuleType.SimulateFreqSevTable]: {
    title: "Simulate Freq-Sev Table",
    category: "손해 시뮬레이션",
    beginner:
      "'사고가 몇 번 날까(빈도) × 한 번에 얼마 손해날까(심도)'를 가상으로 수없이 돌려 보는 블록입니다. 주사위를 수만 번 굴리듯 시뮬레이션해, 총 손해가 어느 정도로 나올지 그 분포를 만들어 줍니다.",
    analysisMethod:
      "몬테카를로 방식으로, 먼저 빈도 분포(예: Poisson)에서 사고 건수를 뽑고 각 건마다 심도 분포(예: Gamma·Lognormal)에서 손해액을 뽑아 합산하는 과정을 많은 횟수 반복합니다. 그 결과로 집계 손해 분포 테이블을 만들며, 시뮬레이션 횟수가 적으면 극단(꼬리) 추정이 부정확합니다(결정성을 위해 시드 고정).",
    role: "빈도(Frequency) × 심도(Severity) 가정으로 손해 시뮬레이션 테이블 생성.",
    input: "빈도/심도 분포 파라미터.",
    output: "시뮬레이션된 손해 분포 테이블.",
    whenToUse: "보험 손해의 집계 분포를 몬테카를로로 추정할 때.",
    connections: "(파라미터 입력) → SimulateFreqSevTable → CombineLossModel.",
    commonErrors: "시뮬레이션 횟수가 적으면 꼬리(tail) 추정이 부정확합니다.",
  },
  [ModuleType.CombineLossModel]: {
    title: "Combine Loss Model",
    category: "손해 시뮬레이션",
    beginner:
      "여러 담보·계층에서 따로 만든 손해 분포를 '하나로 합쳐 총 위험을 보는' 블록입니다. 각각의 손해를 합산해 전체로 볼 때 최악의 경우 얼마까지 손해날 수 있는지(VaR·TVaR)를 계산합니다.",
    analysisMethod:
      "여러 손해 분포(시뮬레이션 결과)를 합산해 종합 손해 분포를 만들고, 그 분포의 상위 분위수에서 VaR(특정 확률 수준의 손실 한계)과 TVaR(그 한계를 넘는 손실의 평균)을 산출합니다. 분포 간 의존(상관) 구조를 무시하면 꼬리 위험을 과소평가할 수 있습니다.",
    role: "여러 손해 모델을 결합해 종합 손해 분포를 산출.",
    input: "복수 손해 모델.",
    output: "통합 손해 분포 + VaR/TVaR.",
    whenToUse: "여러 담보/계층의 손해를 합산해 총 위험(VaR/TVaR)을 평가할 때.",
    connections: "SimulateFreqSevTable(들) → CombineLossModel.",
    commonErrors: "분포 간 의존(상관) 구조를 무시하면 꼬리 위험을 과소평가할 수 있습니다.",
  },

  // ===== JMDC Analysis (PRD v2.0 §17, J1~J7) - 상세 =====
  [ModuleType.JMDCCohortBuilder]: {
    title: "[J1] JMDC Cohort Builder",
    category: "JMDC 분석",
    beginner:
      "연구에 참여할 '대상자 명단'을 만드는 첫 단계 블록입니다. 임상시험에서 '20~60세, 특정 병력 없는 사람만 모집'하듯이, 여기서 나이·관찰기간·제외 질환 같은 기준을 정하면 전체 가입자 중 조건에 맞는 사람만 걸러져 분석 대상(코호트)이 됩니다. 모든 JMDC 분석은 이 명단에서 출발합니다.",
    analysisMethod:
      "먼저 각 사람의 분석 기준 시점(Index Date)을 규칙(생일 기준 특정 나이·등록일·고정일자)에 따라 정합니다. 그다음 washout 기간(이전 관찰 확보), 연령창(age_at_index_min~max), 기왕증 제외(ICD-10 코드)를 순서대로 적용하는 깔때기(funnel) 방식으로 대상을 줄여 나가, 단계마다 몇 명이 남았는지 추적표로 보여 줍니다. 최종 명단과 성별·연령대 분포를 산출합니다.",
    role:
      "분석 코호트를 정의하는 첫 단계 모듈입니다. Index Date 규칙(생일+나이/등록시점/고정일자)을 적용해 각 가입자의 분석 시점을 지정하고, washout 기간·연령창·기왕증 제외 조건으로 funnel을 거쳐 최종 분석 대상을 산출합니다.",
    input:
      "(A) 'synthetic' 모드: 모듈이 가상의 코호트를 자체 생성. (B) 'csv' 모드: 업스트림 LoadData로 받은 DataFrame. 필요 컬럼: member_id, sex_code, birth_date, first_obs_date, last_obs_date, bmi, has_diabetes, has_htn, charlson.",
    output:
      "코호트 DataFrame (member_id, index_date, age_at_index, sex_code, age_band, bmi, has_diabetes, has_htn, charlson, first_obs_date, last_obs_date) + funnel 추적 표 + 성별/연령대 분포 + claims_disease 페이로드(J2가 사용).",
    parameters:
      "data_source(synthetic/csv) · index_date_rule(birthday_age/enrollment_date/fixed_date) · index_age · washout_years · age_at_index_min/max · exclusion_diseases(ICD-10 prefix list) · disease_free_years",
    whenToUse: "JMDC 클레임 데이터로 코호트 연구를 시작할 때 가장 먼저 배치(모든 J2~J7의 출발점).",
    connections: "(시작점, 또는 LoadData) → JMDCCohortBuilder → JMDCOutcomeLabeler(J2).",
    commonErrors: "csv 모드인데 필수 컬럼이 없으면 실패합니다. funnel 후 코호트가 0명이면 제외 조건(연령창·washout)을 완화하세요.",
    notes: "PRD v2.0 §17.2. 실행: utils/pyodideRunner.ts의 performJMDCCohort.",
  },
  [ModuleType.JMDCOutcomeLabeler]: {
    title: "[J2] JMDC Outcome Labeler",
    category: "JMDC 분석",
    beginner:
      "명단에 오른 각 사람에게 '언제 무슨 일이 일어났는지' 꼬리표를 붙이는 블록입니다. 예를 들어 '관찰 시작 후 며칠 만에 당뇨가 생겼는가, 끝까지 안 생겼는가'를 정리합니다. 생존분석·발생률 계산은 이 (관찰기간, 사건발생 여부) 꼬리표가 있어야 가능하므로, 코호트 다음에 반드시 거치는 단계입니다.",
    analysisMethod:
      "각 사람의 청구(claims) 기록에서 관심 질환(ICD-10 코드 묶음)이 관찰창 안에 처음 나타난 날을 찾아 '사건 발생일'로 잡고, 기준 시점부터 그날까지의 일수를 time_to_event로 계산합니다. 끝까지 사건이 없으면 관찰 종료일까지를 '검열(censoring)'로 처리하고 그 사유(추적탈락/행정종료)를 기록합니다. 여러 질환을 동시에 다룰 때는 long(질환×사람) 또는 single(가장 빠른 사건) 방식 중 선택합니다.",
    role:
      "J1 코호트의 각 가입자에 대해 outcome(질병 발생, 사망 등) event 시점과 검열 시점을 산출합니다. 시간-사건 분석(KM, Cox)에 필요한 (time, event) 페어를 만듭니다.",
    input:
      "데이터 1: J1 코호트 (member_id, index_date, last_obs_date 필수). 데이터 2: claims_disease (member_id, icd10_code, onset_date, suspect_flag). multi_outcome_mode='long'이면 outcome×member 카르테시안, 'single'이면 가장 빠른 event 채택.",
    output:
      "코호트 행 + outcome_type, first_event_date, time_to_event_days, event_flag(0/1), censor_reason(event/lost_followup/admin_censor) + eventSummary + outcomeBreakdown(label별 event 수·발생률).",
    parameters:
      "outcome_diseases({label: [ICD10 prefix]}) · outcome_window_years · confirm_suspect_flag · multi_outcome_mode(single/long)",
    whenToUse: "코호트에 (관찰시간, 사건여부) 라벨을 붙여 발생률·생존분석으로 넘기기 직전.",
    connections: "JMDCCohortBuilder(J1) → JMDCOutcomeLabeler(J2) → J3(발생률)/J4(생존)/J5(누적발생)/J6(Cox).",
    commonErrors: "outcome_diseases의 ICD-10 prefix가 데이터 코드 체계와 맞지 않으면 event가 0이 됩니다. claims_disease 페이로드(J1 출력)를 연결해야 합니다.",
    notes: "PRD v2.0 §17.2. 실행: performJMDCOutcomeLabeler.",
  },
  [ModuleType.JMDCIncidenceRate]: {
    title: "[J3] JMDC Incidence Rate",
    category: "JMDC 분석",
    beginner:
      "'1년에 1,000명당 몇 명에게 병이 새로 생기는가' 같은 발생 빈도를 계산하는 블록입니다. 단순히 인원수로 나누지 않고 '각자가 실제로 관찰된 기간(person-years)'을 분모로 써서 더 공정하게 셈합니다. 또 집단마다 나이 구성이 다르면 비교가 왜곡되므로, 표준 인구에 맞춰 보정한 값도 함께 내줍니다.",
    analysisMethod:
      "각 사람이 사건 발생 또는 검열까지 관찰된 기간을 모두 더해 person-years(분모)를 만들고, 사건 수(분자)를 나눠 조발생률(crude rate)을 구합니다. 성별·연령대 등으로 층화한 뒤, 표준 인구(WHO 2000·일본·한국 등) 가중치로 직접표준화(ASR) 또는 간접표준화(SIR)를 적용합니다. 신뢰구간은 사건 수가 포아송 분포를 따른다고 보고 Byar 근사로 95% 구간을 계산합니다.",
    role:
      "Person-years 분모 기반 조발생률과 직접/간접 연령표준화 발생률(ASR/SIR)을 산출합니다. Byar 근사로 95% 신뢰구간 포함.",
    input: "J2 출력(event_flag, time_to_event_days, 인구통계 컬럼).",
    output:
      "층화(전체/성별/연령대/성별×연령대)별 events·PY·crude rate·표준화 rate·95% CI 표 + 시각화용 누적 카운트.",
    parameters:
      "stratify_by(none/sex/age_band/sex_age) · standard_population(internal/WHO_2000/japan_2015/korea_2020) · rate_unit(1000_PY/10000_PY/100000_PY)",
    whenToUse: "집단별 발생률을 비교하거나, 인구 구성을 보정한 표준화 발생률을 보고할 때.",
    connections: "JMDCOutcomeLabeler(J2) → JMDCIncidenceRate(J3).",
    commonErrors: "표준화 인구를 잘못 고르면 비교가 왜곡됩니다. 층화 셀의 event가 적으면 CI가 매우 넓어집니다.",
    notes: "PRD v2.0 §17.2. 실행: performJMDCIncidenceRate.",
  },
  [ModuleType.JMDCSurvivalCompare]: {
    title: "[J4] JMDC Survival Compare",
    category: "JMDC 분석",
    beginner:
      "'두 집단 중 어느 쪽이 더 오래 병 없이 버티는가'를 그림과 통계로 비교하는 블록입니다. 시간이 지날수록 사건(병·사망)이 없는 사람 비율이 어떻게 줄어드는지 계단형 곡선(생존곡선)으로 그리고, 두 곡선 차이가 우연인지 통계 검정으로 판정합니다.",
    analysisMethod:
      "Kaplan-Meier 방법으로 사건이 일어난 시점마다 생존확률을 갱신해 군별 생존곡선을 그리고, 1·3·5년 시점 생존확률과 중위 생존시간을 읽어 냅니다. 두 군 곡선 차이는 log-rank 검정(또는 층화 log-rank)으로 χ²·p-value를 계산하며, 단순 Hazard Ratio도 함께 제시합니다. lifelines 라이브러리를 사용합니다.",
    role:
      "Kaplan-Meier 생존곡선과 log-rank(또는 stratified log-rank) 검정으로 2개 이상 군의 생존 차이를 비교합니다.",
    input:
      "J2 출력(event_flag, time_to_event_days) + 군 구분 컬럼(예: 당뇨 vs 비당뇨, 성별, 위험계층).",
    output:
      "군별 KM 곡선 좌표 + 1/3/5y 시점 생존확률 + 중위 생존시간 + log-rank χ², p-value + Hazard Ratio(단순).",
    parameters:
      "group_col · time_horizons_years(예: [1,3,5]) · logrank_method(standard/stratified) · stratify_cols",
    whenToUse: "두 집단의 생존/무사건 곡선이 통계적으로 다른지 비교할 때.",
    connections: "JMDCOutcomeLabeler(J2) → JMDCSurvivalCompare(J4).",
    commonErrors: "group_col이 연속형이면 군 비교가 안 됩니다 — 범주로 만드세요. lifelines 미설치 시 첫 실행에서 자동 설치(시간 소요).",
    notes: "lifelines 패키지 필요. Pyodide에서 첫 실행 시 자동 설치. PRD v2.0 §17.2.",
  },
  [ModuleType.JMDCCumulativeIncidence]: {
    title: "[J5] JMDC Cumulative Incidence",
    category: "JMDC 분석",
    beginner:
      "'시간이 지나면서 병이 생긴 사람이 누적으로 얼마나 늘어나는가'를 보여 주는 블록입니다. 특히 '사망' 같은 경쟁 사건이 있으면 관심 질환 발생을 부풀려 셀 수 있는데, 이를 바로잡아 정확한 누적 발생을 계산합니다.",
    analysisMethod:
      "경쟁위험(예: 사망)이 있을 때는 Aalen-Johansen 추정량으로, 단일 사건만 있을 때는 1−KM(생존확률의 여집합)으로 시점별 누적발생함수(CIF)를 계산합니다. 신뢰구간은 부트스트랩(데이터를 반복 재표집해 곡선 변동을 측정)으로 추정하며, 군별로 곡선을 겹쳐 비교합니다.",
    role:
      "누적 발생 함수를 산출. 경쟁위험이 있을 때는 Aalen-Johansen 추정량, 단일 사건은 1-KM 사용.",
    input: "J2 출력(이벤트 컬럼 + 경쟁위험 컬럼).",
    output: "시간 grid별 CIF 곡선 + bootstrap 신뢰구간 + 군별 비교.",
    parameters:
      "event_col · competing_event_cols · group_col · time_grid_years · bootstrap_n",
    whenToUse: "사망 등 경쟁위험이 있어 단순 1-KM이 발생을 과대추정할 때.",
    connections: "JMDCOutcomeLabeler(J2) → JMDCCumulativeIncidence(J5).",
    commonErrors: "경쟁위험을 무시하면 누적발생이 과대추정됩니다 — competing_event_cols를 지정하세요. bootstrap_n이 크면 느립니다.",
    notes: "PRD v2.0 §17.2.",
  },
  [ModuleType.JMDCRiskStratification]: {
    title: "[J6] JMDC Risk Stratification (Cox PH)",
    category: "JMDC 분석",
    beginner:
      "'나이·성별·동반질환 같은 다른 요인을 모두 감안했을 때, 이 노출(예: 당뇨)이 사건 위험을 몇 배 높이는가'를 숫자(위험비)로 알려 주는 블록입니다. 여러 요인을 한꺼번에 보정하므로, 단순 비교보다 공정한 위험 평가가 됩니다.",
    analysisMethod:
      "Cox 비례위험모델(lifelines.CoxPHFitter)로 노출과 공변량들을 함께 넣어 각 변수의 Hazard Ratio(위험비)와 95% 신뢰구간·p-value를 추정합니다. 이 모델의 핵심 가정인 '비례위험(시간에 따라 위험비가 일정)'이 성립하는지 Schoenfeld 잔차 검정으로 점검해, 위반하는 변수를 표시합니다.",
    role:
      "Cox 비례위험모델로 공변량 보정 Hazard Ratio를 산출합니다. PH 가정(Schoenfeld 잔차) 검정 포함.",
    input:
      "J2 출력 + 노출(exposure) 컬럼 + 공변량 리스트(연령, 성별, BMI, charlson 등).",
    output:
      "HR 표(점추정·95% CI·p-value) + PH 위반 컬럼 표시 + 학습된 Cox 모델(다음 ScoreModel에서 재사용 가능).",
    parameters:
      "exposure_col · covariates · stratify_col · proportional_hazards_test · tie_method(efron/breslow)",
    whenToUse: "여러 공변량을 보정한 노출 효과(HR)를 추정하고 위험을 계층화할 때.",
    connections: "JMDCOutcomeLabeler(J2) → JMDCRiskStratification(J6) → (선택)ScoreModel.",
    commonErrors: "PH 가정 위반 컬럼은 stratify_col로 빼거나 시간상호작용을 고려하세요. 공변량 다중공선성은 HR을 불안정하게 합니다.",
    notes: "lifelines.CoxPHFitter 사용. PRD v2.0 §17.2.",
  },
  [ModuleType.JMDCKRJPMatcher]: {
    title: "[J7] JMDC KR-JP Matcher",
    category: "JMDC 분석",
    beginner:
      "한국과 일본처럼 서로 다른 두 집단을 '사과 대 사과'로 공정하게 비교하기 위해 4단계로 맞춰 주는 블록입니다. 표 구조를 맞추고(1), 용어·코드를 통일하고(2), 인구 구성을 보정하고(3), 비슷한 사람끼리 짝지어(4) 비교가 한쪽으로 기울지 않게 합니다.",
    analysisMethod:
      "L1 스키마 정렬(컬럼 구조 일치) → L2 어휘 매핑(코드·용어 통일) → L3 표준화(직접/간접 SIR로 인구구조 보정) → L4 성향점수매칭(PSM: 공변량으로 비슷한 사람을 caliper 안에서 1:1 매칭) 순으로 적용합니다. 매칭 전후의 표준화 평균차(SMD)로 균형이 맞았는지 확인하고, 표준화 발생률·SIR(Byar)·KM 곡선 겹침을 함께 산출합니다.",
    role:
      "한·일 코호트 비교를 위한 4-Layer 매칭 프로토콜(L1 스키마 정렬 · L2 어휘 매핑 · L3 표준화 · L4 PSM)을 일괄 수행합니다.",
    input:
      "데이터 1: JP 코호트(J1+J2). 데이터 2: KR 코호트(동일 스키마). 필수 컬럼: 인구통계, outcome.",
    output:
      "매칭 전후 SMD 표 + 표준화 발생률 비교 + SIR(Byar) + KM overlay + PSM 매칭 페어 ID.",
    parameters:
      "apply_schema_alignment · apply_vocab_mapping · apply_standardization(none/direct/indirect_sir) · standard_population · apply_psm · psm_covariates · caliper · comparison_outcome",
    whenToUse: "두 국가/기관 코호트를 공정하게 비교하기 위해 스키마·어휘·인구구조·교란을 정렬할 때.",
    connections: "JP 코호트(J1+J2) + KR 코호트 → JMDCKRJPMatcher(J7).",
    commonErrors: "두 코호트의 컬럼 스키마가 어긋나면 L1에서 실패합니다. PSM 후 SMD가 여전히 크면 caliper/공변량을 조정하세요.",
    notes: "PRD v2.0 §18 (4-Layer L1~L4). 실행: performJMDCMatcher.",
  },
};
