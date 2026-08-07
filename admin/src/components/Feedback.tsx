/** 목록/상세 공용 로딩·오류·빈 상태. mock fallback 없이 상태를 그대로 보여준다. */

export function LoadingState({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="state state-loading" role="status">
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">요청에 실패했습니다</p>
      <p className="state-message">{message}</p>
      {onRetry && (
        <button type="button" className="button button-secondary" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="state state-empty">
      <p className="state-title">{title}</p>
      {description && <p className="state-message">{description}</p>}
    </div>
  );
}
