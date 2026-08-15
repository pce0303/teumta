import { describe, expect, it } from 'vitest';

import { placeNameRank, toPlaceMatchKey } from './place-name';

/** 기관마다 같은 장소를 다르게 표기해서 비교 전에 표기를 걷어내야 한다. */

describe('toPlaceMatchKey', () => {
  it('대괄호 부가 표기와 공백을 걷어낸다', () => {
    expect(toPlaceMatchKey('전북 전주 한옥마을 [슬로시티]')).toBe('전북전주한옥마을');
    expect(toPlaceMatchKey('성산일출봉 [유네스코 세계자연유산]')).toBe('성산일출봉');
    expect(toPlaceMatchKey('해운대 해수욕장')).toBe('해운대해수욕장');
  });
});

describe('placeNameRank', () => {
  it('표기만 다른 같은 이름은 정확 일치로 본다', () => {
    expect(placeNameRank('해운대 해수욕장', '해운대해수욕장')).toBe(0);
    expect(placeNameRank('성산일출봉 [유네스코 세계자연유산]', '성산일출봉')).toBe(0);
  });

  it('지역 접두사가 붙은 이름은 포함 관계로 본다', () => {
    expect(placeNameRank('전주한옥마을', '전북 전주 한옥마을 [슬로시티]')).toBe(1);
  });

  it('부속 시설은 포함 관계가 아니다', () => {
    // "전주한옥마을 관광안내소"는 "전북전주한옥마을"을 포함하지도, 포함되지도 않는다.
    expect(placeNameRank('전주한옥마을 관광안내소', '전북 전주 한옥마을 [슬로시티]')).toBe(2);
  });

  it('관련 없는 이름은 2', () => {
    expect(placeNameRank('N서울타워', '경복궁')).toBe(2);
  });
});
