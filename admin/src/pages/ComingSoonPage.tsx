interface ComingSoonPageProps {
  title: string;
  description: string;
  /** 어떤 선행 작업이 끝나야 만들 수 있는지. 가짜 화면 대신 의존성을 명시한다. */
  blockedBy: string;
}

export function ComingSoonPage({
  title,
  description,
  blockedBy,
}: ComingSoonPageProps) {
  return (
    <section className="panel coming-soon">
      <span className="badge badge-neutral">준비 중</span>
      <h2 className="coming-soon-title">{title}</h2>
      <p className="coming-soon-description">{description}</p>
      <div className="coming-soon-blocked">
        <span className="coming-soon-blocked-label">선행 조건</span>
        <p>{blockedBy}</p>
      </div>
    </section>
  );
}
