# 전체 파이프라인 코드 검증 (verify/)

이 앱의 핵심 불변식을 **자동 회귀 검증**한다:

> "전체 파이프라인 코드"(PipelineCodeModal/Panel에서 복사하는 코드)를 외부 Python에
> 그대로 가져가면 **바로 실행되고, 매번 동일한 결과**가 나온다.

## 실행

```bash
pnpm run verify:pipelines      # 또는: node verify/run-verification.mjs
```

각 픽스처에 대해:
1. 픽스처(.json)를 앱과 동일하게 hydrate하여 `generateFullPipelineCode`로 전체코드(.py) 생성
2. 필요한 데이터셋 CSV를 임시 디렉토리에 복사
3. 실제 `python`으로 그 .py를 **2회** 실행
4. **(a)** 두 번 모두 exit 0 (외부 실행 가능)  **(b)** 정규화 후 stdout이 byte-identical (동일 결과 재현)

하나라도 실패하면 종료코드 1 → CI에서 회귀를 잡는다.

## 구성

- `generate.ts` — 픽스처 → 전체코드(.py) 생성 엔트리 (esbuild로 번들되어 실행)
- `run-verification.mjs` — 오케스트레이터(번들·생성·실행·단언·요약)
- `pipelines/*.json` — 검증 픽스처(저장 파이프라인 포맷: `modules` + 인덱스 기반 `connections`)
  - 선택 필드 `requires: ["statsmodels", ...]` — 해당 파이썬 패키지가 없으면 그 픽스처는 **SKIP**(FAIL 아님)
- 데이터셋은 `Examples_in_Load/`(우선) 또는 `verify/datasets/`에서 찾는다.

## 픽스처 추가하기 (새 모듈/체인 검증)

1. `pipelines/NN_이름.json`을 만든다. `modules[].type`/`parameters`와 인덱스 기반 `connections`를 채운다.
2. `LoadData.parameters.source`는 `Examples_in_Load/`에 있는 CSV 파일명으로 둔다.
3. 특정 파이썬 패키지가 필요하면 최상위 `requires`에 적는다.
4. `pnpm run verify:pipelines`로 PASS를 확인한다. 실패하면 생성기/템플릿의 export 버그다 — 고친다.

## 알려진 제한

- **클러스터링 K-Means 체인(KMeans→TrainClusteringModel→ClusteringData)** 은 전체코드용 Python
  템플릿이 추가되어 외부 실행+재현 검증된다(`07_clustering_kmeans.json`). 지도학습 TrainModel/ScoreModel과
  동일한 변수 와이어링(`model`→`trained_model`)을 따른다.
- **PCA 체인(PCA→TrainClusteringModel→ClusteringData)** 도 외부 실행+재현 검증된다(`08_pca.json`).
  `ClusteringData`가 `.transform` 분기로 주성분(PC1, PC2…)을 생성한다. ModuleType의 PCA /
  PrincipalComponentAnalysis 불일치는 동일 값("PCA") 별칭 멤버로 정합화했다(types.ts).
- **DBSCAN 체인(DBSCAN→TrainClusteringModel→ClusteringData)** 도 외부 실행+재현 검증된다(`09_dbscan.json`).
  DBSCAN은 transductive(`.predict` 없음)라 `ClusteringData`가 `.labels_` 분기로 클러스터(-1=노이즈)를 할당한다.
  ModuleType.DBSCAN 신설 + 팔레트/DEFAULT_MODULES/PropertiesPanel(eps·min_samples)/ComponentRenderer 등록 완료.
- **계층적 클러스터링 체인(HierarchicalClustering→TrainClusteringModel→ClusteringData)** 도 외부 실행+재현
  검증된다(`10_hierarchical.json`). AgglomerativeClustering 역시 transductive라 `.labels_` 분기로 처리된다.
  ModuleType.HierarchicalClustering 신설 + 팔레트/DEFAULT_MODULES/PropertiesPanel(n_clusters·linkage)/ComponentRenderer
  등록 완료. (sklearn 1.7 호환: `affinity` 대신 `metric` 사용, ward는 euclidean 강제.)
- 이로써 클러스터링 패밀리 **KMeans·PCA·DBSCAN·Hierarchical** 의 전체코드 내보내기가 모두 검증된다.
- 통계모델 정의 모듈(OLSModel 등)은 자체 실행 변수를 만들지 않고 ResultModel이 전체 코드를 생성한다.
  생성기는 "모듈 코드가 실제로 출력 변수를 만들 때만" 출력 변수를 할당하도록 처리되어 있다.
