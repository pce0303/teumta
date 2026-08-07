const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return dateTimeFormatter.format(date);
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) {
    return '—';
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
  }
  return `${minutes}분`;
}

export function formatOperatingHours(
  openingTime: string | null,
  closingTime: string | null,
): string {
  if (!openingTime && !closingTime) {
    return '—';
  }
  return `${openingTime ?? '?'}–${closingTime ?? '?'}`;
}
