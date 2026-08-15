/**
 * 장소 이름 비교용 키.
 *
 * 같은 장소를 기관마다 다르게 표기한다:
 *  - TourAPI: "전북 전주 한옥마을 [슬로시티]", "성산일출봉 [유네스코 세계자연유산]"
 *  - TMAP:    "전주한옥마을"
 *  - KTO:     "해운대 해수욕장"
 *
 * 공백·대괄호 부가설명을 걷어내야 같은 곳으로 인식됨.
 * 이 키로 포함 관계까지 보면 지역 접두사가 붙은 이름도 연결.
 */
export function toPlaceMatchKey(name: string): string {
  return name
    .normalize('NFC')
    .replace(/\[[^\]]*\]/g, '') // [슬로시티], [유네스코 세계자연유산] 등 부가 표기
    .replace(/\s+/g, '')
    .trim();
}

/** 이름 유사도 등급. 0=완전 일치, 1=포함 관계, 2=그 외. 낮을수록 좋음. */
export function placeNameRank(candidateName: string, targetName: string): number {
  const candidate = toPlaceMatchKey(candidateName);
  const target = toPlaceMatchKey(targetName);

  if (candidate.length === 0 || target.length === 0) {
    return 2;
  }
  if (candidate === target) {
    return 0;
  }
  if (candidate.includes(target) || target.includes(candidate)) {
    return 1;
  }
  return 2;
}
