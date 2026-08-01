/** 현재 시각에서 offsetMinutes 뒤의 시각을 "HH:MM" 라벨로 만든다. */
export function timeLabelAfter(offsetMinutes: number) {
  const at = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const hours = String(at.getHours()).padStart(2, '0');
  const minutes = String(at.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
