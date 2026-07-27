# 데이터 스키마 초안

## 1. 문서 목적

틈타 서비스에서 혼잡도 판단, 로컬 장소 추천, 우회 코스 계산에 필요한 데이터 항목을 정의한다.

본 문서는 초기 설계안이며, 실제 TourAPI·SK 혼잡도·TMAP API 응답을 확인한 후 수정한다.

---

## 2. 인기 관광지 데이터

| 필드명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| id | string | O | 서비스 내부 관광지 ID |
| contentId | string | O | TourAPI 콘텐츠 ID |
| name | string | O | 관광지명 |
| address | string | O | 관광지 주소 |
| latitude | number | O | 위도 |
| longitude | number | O | 경도 |
| category | string | O | 관광지 카테고리 |
| openingTime | string | X | 운영 시작 시각 |
| closingTime | string | X | 운영 종료 시각 |
| imageUrl | string | X | 대표 이미지 주소 |
| predictedCongestionScore | number | X | 방문 예정 시각의 예상 혼잡도 |
| realtimeCongestionScore | number | X | 현재 실시간 혼잡도 |
| congestionUpdatedAt | datetime | X | 혼잡도 마지막 갱신 시각 |

---

## 3. 로컬 장소 데이터

| 필드명 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| id | string | O | 서비스 내부 로컬 장소 ID |
| contentId | string | X | TourAPI 콘텐츠 ID |
| touristSpotId | string | O | 연결된 인기 관광지 ID |
| name | string | O | 로컬 장소명 |
| category | string | O | 카페·시장·전시·산책 등 |
| address | string | O | 장소 주소 |
| latitude | number | O | 위도 |
| longitude | number | O | 경도 |
| openingTime | string | X | 운영 시작 시각 |
| closingTime | string | X | 운영 종료 시각 |
| recommendedStayMinutes | number | O | 권장 체류시간 |
| tags | string[] | O | 취향 및 특성 태그 |
| imageUrl | string | X | 대표 이미지 주소 |
| realtimeCongestionScore | number | X | 현재 장소 혼잡도 |
| isActive | boolean | O | 추천 대상 사용 여부 |

### 장소 태그 예시

```text
카페
먹거리
시장
사진
산책
전시
역사
조망
실내
야외
혼자 방문
