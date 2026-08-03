/** '으로/로' 조사를 받침 유무에 맞춰 붙인다 (ㄹ 받침은 '로'). 한글이 아니면 '로'. */
export function withRoJosa(word: string) {
  const lastChar = word.charCodeAt(word.length - 1);
  if (lastChar < 0xac00 || lastChar > 0xd7a3) {
    return `${word}로`;
  }
  const jongseong = (lastChar - 0xac00) % 28;
  return jongseong === 0 || jongseong === 8 ? `${word}로` : `${word}으로`;
}
