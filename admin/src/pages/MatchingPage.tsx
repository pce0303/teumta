import { useEffect, useState } from 'react';

import { getErrorMessage } from '../api/client';
import {
  deleteAlias,
  fetchAliases,
  fetchMatchingPreview,
  runMatchingIngest,
  saveAlias,
} from '../api/matching';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import {
  MATCHING_STATUS_LABELS,
  type ForecastAlias,
  type MatchingIngestResult,
  type MatchingPreviewItem,
  type MatchingPreviewResult,
} from '../types/matching';
import { formatDateTime } from '../utils/format';
import { usePlaces } from '../utils/usePlaces';

const STATUS_BADGE_CLASS: Record<MatchingPreviewItem['status'], string> = {
  MATCHED: 'badge badge-tourist',
  ALIAS_MATCHED: 'badge badge-alias',
  UNMATCHED: 'badge badge-danger',
  AMBIGUOUS: 'badge badge-warning',
};

function itemKey(item: MatchingPreviewItem): string {
  return `${item.areaCd}|${item.signguCd}|${item.tAtsNm}`;
}

export function MatchingPage() {
  const { places } = usePlaces();

  const [areaCd, setAreaCd] = useState('11');
  const [signguCd, setSignguCd] = useState('11110');

  const [preview, setPreview] = useState<MatchingPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [aliases, setAliases] = useState<ForecastAlias[] | null>(null);
  const [aliasesError, setAliasesError] = useState<string | null>(null);

  const [rowSelections, setRowSelections] = useState<Record<string, string>>(
    {},
  );
  const [rowSavingKey, setRowSavingKey] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const [ingestRunning, setIngestRunning] = useState(false);
  const [ingestResult, setIngestResult] = useState<MatchingIngestResult | null>(
    null,
  );
  const [ingestError, setIngestError] = useState<string | null>(null);

  const loadAliases = async () => {
    try {
      setAliases(await fetchAliases());
      setAliasesError(null);
    } catch (caught) {
      setAliasesError(getErrorMessage(caught));
    }
  };

  useEffect(() => {
    void loadAliases();
  }, []);

  const regionValid = /^\d{1,8}$/.test(areaCd) && /^\d{1,8}$/.test(signguCd);

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setIngestResult(null);
    setRowErrors({});
    try {
      setPreview(await fetchMatchingPreview(areaCd.trim(), signguCd.trim()));
    } catch (caught) {
      setPreview(null);
      setPreviewError(getErrorMessage(caught));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleIngest = async () => {
    setIngestRunning(true);
    setIngestError(null);
    setIngestResult(null);
    try {
      setIngestResult(await runMatchingIngest(areaCd.trim(), signguCd.trim()));
    } catch (caught) {
      setIngestError(getErrorMessage(caught));
    } finally {
      setIngestRunning(false);
    }
  };

  const handleSaveRowAlias = async (item: MatchingPreviewItem) => {
    const key = itemKey(item);
    const placeId = Number(rowSelections[key]);
    if (!Number.isInteger(placeId) || placeId <= 0) {
      setRowErrors((previous) => ({
        ...previous,
        [key]: '연결할 장소를 선택하세요.',
      }));
      return;
    }

    setRowSavingKey(key);
    setRowErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });

    try {
      const saved = await saveAlias({
        areaCd: item.areaCd,
        signguCd: item.signguCd,
        tAtsNm: item.tAtsNm,
        placeId,
      });

      // 외부 API 재호출 없이 화면 상태만 갱신한다(쿼터 절약).
      setPreview((previous) => {
        if (previous === null) {
          return previous;
        }
        const items = previous.items.map((existing) =>
          itemKey(existing) === key
            ? {
              ...existing,
              status: 'ALIAS_MATCHED' as const,
              matchedPlace: saved.place,
              candidates: [],
            }
            : existing,
        );
        const counts = { ...previous.counts };
        if (item.status === 'UNMATCHED') {
          counts.unmatched -= 1;
        } else if (item.status === 'AMBIGUOUS') {
          counts.ambiguous -= 1;
        } else if (item.status === 'MATCHED') {
          counts.matched -= 1;
        } else {
          counts.aliasMatched -= 1;
        }
        counts.aliasMatched += 1;
        return { ...previous, items, counts };
      });

      setAliases((previous) => {
        if (previous === null) {
          return [saved];
        }
        const rest = previous.filter((alias) => alias.id !== saved.id);
        return [saved, ...rest];
      });
    } catch (caught) {
      setRowErrors((previous) => ({
        ...previous,
        [key]: getErrorMessage(caught),
      }));
    } finally {
      setRowSavingKey(null);
    }
  };

  const handleDeleteAlias = async (alias: ForecastAlias) => {
    try {
      await deleteAlias(alias.id);
      setAliases(
        (previous) =>
          previous?.filter((existing) => existing.id !== alias.id) ?? null,
      );
      setAliasesError(null);
    } catch (caught) {
      setAliasesError(getErrorMessage(caught));
    }
  };

  const regionPlaces = (places ?? [])
    .filter((place) => place.lDongRegnCd === (preview?.areaCd ?? areaCd.trim()))
    .sort((first, second) => first.name.localeCompare(second.name, 'ko'));

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">KTO 집중률 매칭 조회</h2>
        </div>
        <p className="panel-caption">
          KTO 집중률 예측의 관광지명이 DB 장소와 어떻게 연결되는지 확인하고,
          자동 매칭이 안 되는 항목을 수동으로 연결합니다. 조회/적재 버튼은 KTO
          외부 API를 1회 호출합니다(자동 새로고침 없음).
        </p>
        <div className="matching-controls">
          <label className="field matching-region-field">
            <span className="field-label">법정동 시도코드 (areaCd)</span>
            <input
              className="input"
              value={areaCd}
              onChange={(event) => setAreaCd(event.target.value)}
              placeholder="11"
              inputMode="numeric"
            />
          </label>
          <label className="field matching-region-field">
            <span className="field-label">법정동 시군구코드 (signguCd)</span>
            <input
              className="input"
              value={signguCd}
              onChange={(event) => setSignguCd(event.target.value)}
              placeholder="11110"
              inputMode="numeric"
            />
          </label>
          <div className="matching-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => void handlePreview()}
              disabled={!regionValid || previewLoading || ingestRunning}
            >
              {previewLoading ? '조회 중…' : '매칭 미리보기 조회'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void handleIngest()}
              disabled={!regionValid || previewLoading || ingestRunning}
              title="이 지역의 집중률 예측을 지금 적재합니다(수동 연결 반영 확인용)."
            >
              {ingestRunning ? '적재 중…' : '적재 실행'}
            </button>
          </div>
        </div>
        <p className="field-hint">예: 서울 종로구 = 11 / 11110</p>
      </section>

      {ingestError && (
        <div className="banner banner-error" role="alert">
          적재 실패: {ingestError}
        </div>
      )}
      {ingestResult && (
        <div className="banner banner-success" role="status">
          적재 완료 — 매칭 {ingestResult.matchedPlaces}곳 (수동 연결{' '}
          {ingestResult.aliasMatchedPlaces}곳), 저장 {ingestResult.inserted}건,
          미매칭 {ingestResult.unmatched.length}건, 후보 다수{' '}
          {ingestResult.ambiguous.length}건
        </div>
      )}

      {previewLoading ? (
        <LoadingState label="KTO 집중률 예측을 조회하는 중…" />
      ) : previewError !== null ? (
        <ErrorState message={previewError} onRetry={() => void handlePreview()} />
      ) : preview === null ? (
        <EmptyState
          title="아직 조회하지 않았습니다"
          description="지역 코드를 확인한 뒤 ‘매칭 미리보기 조회’를 눌러 주세요."
        />
      ) : preview.items.length === 0 ? (
        <EmptyState
          title="해당 지역의 집중률 예측 데이터가 없습니다"
          description="지역 코드를 확인해 주세요."
        />
      ) : (
        <section className="panel panel-flush">
          <div className="matching-summary">
            <span className="badge badge-danger">
              미매칭 {preview.counts.unmatched}
            </span>
            <span className="badge badge-warning">
              후보 다수 {preview.counts.ambiguous}
            </span>
            <span className="badge badge-alias">
              수동 연결 {preview.counts.aliasMatched}
            </span>
            <span className="badge badge-tourist">
              자동 매칭 {preview.counts.matched}
            </span>
            {preview.truncated && (
              <span className="cell-muted">
                ⚠ 외부 API 응답이 잘렸습니다 — 일부 항목만 표시될 수 있습니다.
              </span>
            )}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>KTO 관광지명</th>
                <th>상태</th>
                <th className="cell-number">예측 일수</th>
                <th className="cell-number">평균 집중률</th>
                <th>연결 장소</th>
                <th>수동 연결</th>
              </tr>
            </thead>
            <tbody>
              {preview.items.map((item) => {
                const key = itemKey(item);
                const needsResolution =
                  item.status === 'UNMATCHED' || item.status === 'AMBIGUOUS';
                const options =
                  item.status === 'AMBIGUOUS' ? item.candidates : regionPlaces;

                return (
                  <tr key={key}>
                    <td>
                      <span className="table-link">{item.tAtsNm}</span>
                    </td>
                    <td>
                      <span className={STATUS_BADGE_CLASS[item.status]}>
                        {MATCHING_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="cell-number cell-muted">
                      {item.forecastCount}
                    </td>
                    <td className="cell-number cell-muted">
                      {item.averageRate === null ? '—' : item.averageRate}
                    </td>
                    <td>
                      {item.matchedPlace ? (
                        <span>
                          {item.matchedPlace.name}{' '}
                          <span className="cell-muted">
                            #{item.matchedPlace.id}
                          </span>
                        </span>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                    <td>
                      {needsResolution ? (
                        <div className="matching-resolve">
                          <select
                            className="input matching-resolve-select"
                            value={rowSelections[key] ?? ''}
                            onChange={(event) =>
                              setRowSelections((previous) => ({
                                ...previous,
                                [key]: event.target.value,
                              }))
                            }
                          >
                            <option value="">장소 선택…</option>
                            {options.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name} (#{option.id})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => void handleSaveRowAlias(item)}
                            disabled={rowSavingKey === key}
                          >
                            {rowSavingKey === key ? '저장 중…' : '연결'}
                          </button>
                          {rowErrors[key] && (
                            <span className="field-error">{rowErrors[key]}</span>
                          )}
                        </div>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {preview.skipped.length > 0 && (
            <p className="table-footnote">
              형식 불량으로 제외된 항목 {preview.skipped.length}건 (서버 로그
              참조)
            </p>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">수동 연결(alias) 목록</h2>
        </div>
        <p className="panel-caption">
          적재 시 자동 매칭보다 우선 적용됩니다. 삭제하면 다음 적재부터 자동
          매칭 결과로 되돌아갑니다(미리보기 반영은 다시 조회 필요).
        </p>
        {aliasesError !== null && (
          <div className="banner banner-error" role="alert">
            {aliasesError}
          </div>
        )}
        {aliases === null ? (
          <LoadingState label="alias 목록을 불러오는 중…" />
        ) : aliases.length === 0 ? (
          <EmptyState
            title="수동 연결이 없습니다"
            description="위 미리보기에서 미매칭/후보 다수 항목을 장소에 연결하면 여기에 쌓입니다."
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>KTO 관광지명</th>
                <th>지역</th>
                <th>연결 장소</th>
                <th>수정일</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {aliases.map((alias) => (
                <tr key={alias.id}>
                  <td>{alias.tAtsNm}</td>
                  <td className="cell-muted">
                    {alias.areaCd} / {alias.signguCd}
                  </td>
                  <td>
                    {alias.place.name}{' '}
                    <span className="cell-muted">#{alias.place.id}</span>
                  </td>
                  <td className="cell-muted">
                    {formatDateTime(alias.updatedAt)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => void handleDeleteAlias(alias)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
