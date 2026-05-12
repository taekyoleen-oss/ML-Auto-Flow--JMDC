# 별첨 F: ML 모델 평가 지표 정의

본 문서는 JMDC ML 프레임워크에서 사용되는 모든 평가 지표의 정의·해석·임계값을 정리한 표준 참조 문서입니다.

---

## 1. Survival Analysis (M1, M4)

### 1.1 Concordance Index (C-index)

**정의**: 무작위로 선택된 두 환자 쌍에서, 더 빨리 사건이 발생한 환자가 더 높은 위험 점수를 받는 비율.

**해석**:
- 0.5: 무작위 (모델 가치 없음)
- 0.6 ~ 0.7: 약함 (참고용)
- 0.7 ~ 0.8: 보통 (실용적)
- 0.8 이상: 강함 (드물게 달성)

**임계값**:
- 최소 수용: 0.65
- 목표: 0.75
- 우수: 0.80

**Python 구현**:
```python
from sksurv.metrics import concordance_index_censored

c_index, concordant, discordant, tied_risk, tied_time = concordance_index_censored(
    event_indicator=y_test_event,
    event_time=y_test_time,
    estimate=risk_scores,
)
```

### 1.2 Integrated Brier Score (IBS)

**정의**: 시간에 따른 예측 확률과 실제 결과의 평균 제곱 오차를 시간 통합한 값.

**해석**:
- 0: 완벽 (불가능)
- 0.25: 무작위 베이스라인
- 낮을수록 좋음

**임계값**: 0.20 이하

**Python**:
```python
from sksurv.metrics import integrated_brier_score
ibs = integrated_brier_score(y_train, y_test, surv_funcs, times)
```

### 1.3 Time-dependent AUC

**정의**: 특정 시점 t에서 그 시점까지 사건이 발생한 사람 vs 발생하지 않은 사람을 구분하는 ROC AUC.

**해석**: 1년·3년·5년 등 임상적으로 의미 있는 시점에서 별도로 보고

**임계값**: 1년 AUC 0.75 이상, 5년 AUC 0.70 이상

---

## 2. Regression (M2)

### 2.1 RMSE (Root Mean Squared Error)

**정의**: √(평균 제곱 오차). 큰 오차에 더 큰 페널티.

**해석 (의료비 예측 기준)**:
- 의료비는 right-skewed이므로 절대값 RMSE보다 **상대 RMSE** (RMSE / 평균 의료비) 사용 권장
- 좋은 모델: 상대 RMSE < 0.7

**Python**:
```python
from sklearn.metrics import mean_squared_error
rmse = np.sqrt(mean_squared_error(y_true, y_pred))
relative_rmse = rmse / y_true.mean()
```

### 2.2 MAE (Mean Absolute Error)

**정의**: 평균 절대 오차. RMSE보다 outlier 영향 적음.

**임계값**: 의료비 평균 대비 < 50%

### 2.3 R² (Coefficient of Determination)

**정의**: 예측이 평균 모델 대비 분산을 얼마나 설명하는가.

**해석**:
- 0: 평균 모델과 같음
- 0.3 ~ 0.5: 의료비 예측은 어려운 문제 → 이 수준도 실용적
- 0.5 이상: 우수

**임계값**: 0.3 이상

### 2.4 MAPE (Mean Absolute Percentage Error)

**정의**: 평균 절대 백분율 오차.

**주의**: 실제값이 0에 가까운 경우 폭발 → 의료비처럼 작은 값이 많은 경우 부적절.

**대안**: SMAPE 또는 분위별 MAPE 사용

### 2.5 Bias by Decile

**정의**: 예측값을 10분위로 나누고, 각 분위에서 예측-실제 평균 차이.

**해석**:
- 상위 분위에서 underestimation 발생 시 → tail risk 미반영
- 하위 분위에서 overestimation → 모델이 "안전한 사람"을 과대평가

---

## 3. Classification (M3)

### 3.1 ROC AUC

**정의**: 모든 임계값에서의 True Positive Rate vs False Positive Rate.

**해석**:
- 0.5: 무작위
- 0.7 ~ 0.8: 보통
- 0.8 이상: 우수

**임계값**: 0.75 이상

### 3.2 PR AUC (Precision-Recall AUC)

**정의**: Precision-Recall 곡선의 면적.

**왜 중요한가**: Class Imbalance가 심한 경우 (예: 발병률 1%) ROC AUC는 부풀려질 수 있음. PR AUC가 더 정직한 지표.

**임계값**:
- ROC AUC와 함께 보고
- 베이스라인 = 발병률 (예: 1%인 경우 0.01)

### 3.3 Sensitivity / Specificity at Fixed Threshold

**시나리오**: 보험 인수에서 "거절"로 분류할 임계값 결정 필요.

**예시**:
- "False Positive Rate(건강한 사람을 거절) 5% 이하 유지하며 Sensitivity(고위험 식별률)는 얼마인가?"
- 30% 이상이면 실용적

### 3.4 F1 Score

**정의**: Precision과 Recall의 조화평균.

**용도**: 단일 임계값 모델 비교

---

## 4. Calibration (모든 모델 공통)

### 4.1 Brier Score

**정의**: 예측 확률과 실제 결과의 평균 제곱 오차.

**해석**:
- 0: 완벽
- 0.25: 무작위
- 잘 보정된 모델: < 0.15

### 4.2 Hosmer-Lemeshow 검정

**정의**: 예측 확률 10분위 그룹별로 예측-관찰 비율이 일치하는지 카이제곱 검정.

**해석**:
- p > 0.05: 통계적으로 잘 보정됨
- p < 0.05: 보정 부족 → Isotonic Regression 또는 Platt Scaling 적용

### 4.3 Calibration Plot

**정의**: x축에 예측 확률, y축에 실제 발생률을 plot. 대각선 y=x에 가까울수록 좋음.

**해석**:
- 위로 휘어짐: 모델이 위험을 과소평가 (보험사 위험)
- 아래로 휘어짐: 과대평가 (가입자 거절 과다)

---

## 5. Fairness (공정성)

### 5.1 Group AUC Disparity

**정의**: 그룹별 AUC의 최대-최소 차이.

**임계값**:
- < 0.05: 우수
- 0.05 ~ 0.10: 검토 필요
- > 0.10: 재학습 필요

**구현**: 별첨 lib/evaluation/fairness.py 참조

### 5.2 Demographic Parity

**정의**: 예측 양성률이 그룹 간 동일한가.

**보험 적용 한계**: 보험은 본질적으로 위험 차등화가 목적이므로 demographic parity는 부적절한 경우 多. 대신 Calibration Parity 권장.

### 5.3 Calibration Parity

**정의**: 그룹별로 예측 확률과 실제 발생률의 관계가 동일한가.

**임계값**: 그룹별 calibration slope 차이 < 0.1

---

## 6. Operational Metrics

### 6.1 추론 응답 시간

| 시나리오 | 목표 |
|----------|------|
| 단일 환자 (실시간 인수) | < 200ms (P95) |
| 배치 (10만 명) | < 30분 |

### 6.2 모델 크기

- 단일 모델 직렬화 크기: < 100MB (보통)
- > 500MB 시 서빙 인프라 검토 필요

### 6.3 학습 시간

| 표본 수 | 목표 |
|---------|------|
| 10만 | < 5분 |
| 100만 | < 30분 |
| 1000만 | < 4시간 (GPU 가능 시 < 1시간) |

---

## 7. 보고서 표준 양식

각 학습 완료된 모델에 대해 자동 생성되는 보고서에는 반드시 다음이 포함되어야 합니다:

```
1. 모델 식별 (이름, 버전, 알고리즘)
2. 학습 데이터 요약 (N, 사건률, 분할)
3. 전체 성능 표 (모든 관련 지표 + 95% CI)
4. 그룹별 성능 (성별, 연령군)
5. Calibration Plot
6. SHAP 글로벌 중요도 (Top 20)
7. 학습 곡선 (loss/metric vs epoch/iteration)
8. 모델 카드 (별첨 D)
```

---

**문서 끝**

본 평가 지표 표준은 분기마다 검토하여 최신 ML/보험 분야 모범 사례를 반영합니다.
