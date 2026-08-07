import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { getErrorMessage } from '../api/client';
import {
  createPlace,
  deletePlace,
  fetchPlace,
  updatePlace,
} from '../api/places';
import { createTag, deleteTag, fetchTags } from '../api/tags';
import { ErrorState, LoadingState } from '../components/Feedback';
import {
  PLACE_TYPES,
  PLACE_TYPE_LABELS,
  type CreatePlaceInput,
  type Place,
  type PlaceType,
} from '../types/place';
import type { TagWithUsage } from '../types/tag';
import { formatDateTime } from '../utils/format';

/** 서버 place.controller.ts의 TIME_PATTERN과 동일하게 유지한다. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

interface FormValues {
  name: string;
  type: PlaceType | '';
  address: string;
  latitude: string;
  longitude: string;
  imageUrl: string;
  description: string;
  openingTime: string;
  closingTime: string;
  recommendedDuration: string;
}

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const EMPTY_VALUES: FormValues = {
  name: '',
  type: '',
  address: '',
  latitude: '',
  longitude: '',
  imageUrl: '',
  description: '',
  openingTime: '',
  closingTime: '',
  recommendedDuration: '',
};

function placeToFormValues(place: Place): FormValues {
  return {
    name: place.name,
    type: place.type,
    address: place.address ?? '',
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    imageUrl: place.imageUrl ?? '',
    description: place.description ?? '',
    openingTime: place.openingTime ?? '',
    closingTime: place.closingTime ?? '',
    recommendedDuration:
      place.recommendedDuration === null
        ? ''
        : String(place.recommendedDuration),
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** 서버 validation(place.controller.ts)과 같은 규칙으로 검사하고 올바른 타입의 payload를 만든다. */
function validate(values: FormValues): {
  errors: FieldErrors;
  payload: CreatePlaceInput | null;
} {
  const errors: FieldErrors = {};

  if (values.name.trim() === '') {
    errors.name = '이름은 필수입니다.';
  }

  if (values.type === '') {
    errors.type = '유형을 선택하세요.';
  }

  const latitude = Number(values.latitude);
  if (values.latitude.trim() === '' || !Number.isFinite(latitude)) {
    errors.latitude = '위도를 숫자로 입력하세요.';
  } else if (latitude < -90 || latitude > 90) {
    errors.latitude = '위도는 -90 이상 90 이하여야 합니다.';
  }

  const longitude = Number(values.longitude);
  if (values.longitude.trim() === '' || !Number.isFinite(longitude)) {
    errors.longitude = '경도를 숫자로 입력하세요.';
  } else if (longitude < -180 || longitude > 180) {
    errors.longitude = '경도는 -180 이상 180 이하여야 합니다.';
  }

  if (
    values.openingTime.trim() !== '' &&
    !TIME_PATTERN.test(values.openingTime.trim())
  ) {
    errors.openingTime = 'HH:mm 형식으로 입력하세요. (예: 09:00)';
  }

  if (
    values.closingTime.trim() !== '' &&
    !TIME_PATTERN.test(values.closingTime.trim())
  ) {
    errors.closingTime = 'HH:mm 형식으로 입력하세요. (예: 18:00)';
  }

  let recommendedDuration: number | null = null;
  if (values.recommendedDuration.trim() !== '') {
    recommendedDuration = Number(values.recommendedDuration);
    if (
      !Number.isInteger(recommendedDuration) ||
      recommendedDuration <= 0
    ) {
      errors.recommendedDuration = '분 단위 양의 정수로 입력하세요.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, payload: null };
  }

  return {
    errors,
    payload: {
      name: values.name.trim(),
      type: values.type as PlaceType,
      latitude,
      longitude,
      address: emptyToNull(values.address),
      imageUrl: emptyToNull(values.imageUrl),
      description: emptyToNull(values.description),
      openingTime: emptyToNull(values.openingTime),
      closingTime: emptyToNull(values.closingTime),
      recommendedDuration,
    },
  };
}

export function PlaceFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const placeId = mode === 'edit' ? Number(id) : null;

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [allTags, setAllTags] = useState<TagWithUsage[] | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagActionError, setTagActionError] = useState<string | null>(null);
  const [managingTags, setManagingTags] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const justCreated = Boolean(
    (location.state as { created?: boolean } | null)?.created,
  );

  const loadPlace = useCallback(async () => {
    if (placeId === null || !Number.isInteger(placeId) || placeId <= 0) {
      setLoadError('잘못된 장소 ID입니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const fetched = await fetchPlace(placeId);
      setPlace(fetched);
      setValues(placeToFormValues(fetched));
      setSelectedTagIds(fetched.tags.map((tag) => tag.id));
    } catch (caught) {
      setLoadError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    if (mode === 'edit') {
      void loadPlace();
    } else {
      setPlace(null);
      setValues(EMPTY_VALUES);
      setFieldErrors({});
      setSelectedTagIds([]);
      setLoading(false);
      setLoadError(null);
      setSaveError(null);
      setSavedAt(null);
    }
  }, [mode, loadPlace]);

  useEffect(() => {
    let cancelled = false;
    fetchTags()
      .then((tags) => {
        if (!cancelled) {
          setAllTags(tags);
          setTagsError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setTagsError(getErrorMessage(caught));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((previous) =>
      previous.includes(tagId)
        ? previous.filter((id) => id !== tagId)
        : [...previous, tagId],
    );
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (name.length === 0) {
      return;
    }
    setCreatingTag(true);
    setTagActionError(null);
    try {
      const created = await createTag(name);
      setAllTags((previous) =>
        previous === null ? [created] : [...previous, created],
      );
      setSelectedTagIds((previous) => [...previous, created.id]);
      setNewTagName('');
    } catch (caught) {
      setTagActionError(getErrorMessage(caught));
    } finally {
      setCreatingTag(false);
    }
  };

  /** 태그 전체 삭제(모든 장소에서 제거). 관리 모드에서만 노출된다. */
  const handleDeleteTag = async (tagId: number, tagName: string) => {
    const usage = allTags?.find((tag) => tag.id === tagId)?.placeCount;
    const usageText =
      usage === undefined ? '' : ` 현재 ${usage}곳에 지정되어 있습니다.`;
    if (
      !window.confirm(
        `'${tagName}' 태그를 삭제할까요? 모든 장소에서 제거되며 되돌릴 수 없습니다.${usageText}`,
      )
    ) {
      return;
    }
    setTagActionError(null);
    try {
      await deleteTag(tagId);
      setAllTags(
        (previous) => previous?.filter((tag) => tag.id !== tagId) ?? null,
      );
      setSelectedTagIds((previous) => previous.filter((id) => id !== tagId));
    } catch (caught) {
      setTagActionError(getErrorMessage(caught));
    }
  };

  /** 장소 삭제. 코스에서 사용 중이면 서버가 409로 막는다. */
  const handleDeletePlace = async () => {
    if (placeId === null || !place) {
      return;
    }
    if (
      !window.confirm(
        `'${place.name}' 장소를 삭제할까요? 태그 연결·집중률 데이터도 함께 삭제되며 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setSaveError(null);
    try {
      await deletePlace(placeId);
      navigate('/places', { replace: true });
    } catch (caught) {
      setSaveError(getErrorMessage(caught));
      setDeleting(false);
    }
  };

  const setField = (field: keyof FormValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    setSavedAt(null);

    const { errors, payload } = validate(values);
    setFieldErrors(errors);
    if (payload === null) {
      return;
    }

    // 태그는 전체 교체 방식(tagIds) — 현재 선택 상태를 함께 저장한다.
    const fullPayload: CreatePlaceInput = {
      ...payload,
      tagIds: selectedTagIds,
    };

    setSaving(true);
    try {
      if (mode === 'create') {
        const created = await createPlace(fullPayload);
        navigate(`/places/${created.id}`, {
          replace: true,
          state: { created: true },
        });
      } else {
        const updated = await updatePlace(placeId!, fullPayload);
        setPlace(updated);
        setValues(placeToFormValues(updated));
        setSelectedTagIds(updated.tags.map((tag) => tag.id));
        setSavedAt(new Date());
      }
    } catch (caught) {
      setSaveError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  // 태그 선택지: 전체 태그 + (목록 API 실패/누락 대비) 현재 장소에 이미 붙은 태그.
  const knownTags = new Map<
    number,
    { name: string; placeCount: number | null }
  >();
  for (const tag of allTags ?? []) {
    knownTags.set(tag.id, { name: tag.name, placeCount: tag.placeCount });
  }
  for (const tag of place?.tags ?? []) {
    if (!knownTags.has(tag.id)) {
      knownTags.set(tag.id, { name: tag.name, placeCount: null });
    }
  }
  const tagOptions = [...knownTags.entries()]
    .map(([id, info]) => ({ id, ...info }))
    .sort((first, second) => first.name.localeCompare(second.name, 'ko'));

  if (loading) {
    return <LoadingState label="장소 정보를 불러오는 중…" />;
  }

  if (mode === 'edit' && loadError !== null) {
    return <ErrorState message={loadError} onRetry={() => void loadPlace()} />;
  }

  return (
    <div className="stack form-page">
      <div className="form-page-top">
        <Link to="/places" className="back-link">
          ← 장소 목록
        </Link>
        {mode === 'edit' && place && (
          <span className="cell-muted">
            ID {place.id} · 생성 {formatDateTime(place.createdAt)} · 수정{' '}
            {formatDateTime(place.updatedAt)}
          </span>
        )}
      </div>

      {justCreated && (
        <div className="banner banner-success" role="status">
          장소가 등록되었습니다.
        </div>
      )}
      {savedAt && (
        <div className="banner banner-success" role="status">
          저장되었습니다.
        </div>
      )}
      {saveError && (
        <div className="banner banner-error" role="alert">
          저장에 실패했습니다: {saveError}
        </div>
      )}

      <form className="panel form" onSubmit={(event) => void handleSubmit(event)}>
        <fieldset className="form-section" disabled={saving}>
          <legend className="form-section-title">기본 정보</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">
                이름 <em className="field-required">*</em>
              </span>
              <input
                className="input"
                value={values.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder="예: 통인시장"
              />
              {fieldErrors.name && (
                <span className="field-error">{fieldErrors.name}</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">
                유형 <em className="field-required">*</em>
              </span>
              <select
                className="input"
                value={values.type}
                onChange={(event) => setField('type', event.target.value)}
              >
                <option value="">선택하세요</option>
                {PLACE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PLACE_TYPE_LABELS[type]} ({type})
                  </option>
                ))}
              </select>
              {fieldErrors.type && (
                <span className="field-error">{fieldErrors.type}</span>
              )}
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section" disabled={saving}>
          <legend className="form-section-title">위치</legend>
          <div className="form-grid">
            <label className="field field-wide">
              <span className="field-label">주소</span>
              <input
                className="input"
                value={values.address}
                onChange={(event) => setField('address', event.target.value)}
                placeholder="예: 서울특별시 종로구 자하문로15길 18"
              />
            </label>

            <label className="field">
              <span className="field-label">
                위도 <em className="field-required">*</em>
              </span>
              <input
                className="input"
                inputMode="decimal"
                value={values.latitude}
                onChange={(event) => setField('latitude', event.target.value)}
                placeholder="예: 37.5796"
              />
              {fieldErrors.latitude && (
                <span className="field-error">{fieldErrors.latitude}</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">
                경도 <em className="field-required">*</em>
              </span>
              <input
                className="input"
                inputMode="decimal"
                value={values.longitude}
                onChange={(event) => setField('longitude', event.target.value)}
                placeholder="예: 126.9770"
              />
              {fieldErrors.longitude && (
                <span className="field-error">{fieldErrors.longitude}</span>
              )}
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section" disabled={saving}>
          <legend className="form-section-title">운영 정보</legend>
          <div className="form-grid form-grid-3">
            <label className="field">
              <span className="field-label">여는 시간 (HH:mm)</span>
              <input
                className="input"
                value={values.openingTime}
                onChange={(event) =>
                  setField('openingTime', event.target.value)
                }
                placeholder="09:00"
              />
              {fieldErrors.openingTime && (
                <span className="field-error">{fieldErrors.openingTime}</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">닫는 시간 (HH:mm)</span>
              <input
                className="input"
                value={values.closingTime}
                onChange={(event) =>
                  setField('closingTime', event.target.value)
                }
                placeholder="18:00"
              />
              {fieldErrors.closingTime && (
                <span className="field-error">{fieldErrors.closingTime}</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">추천 체류시간 (분)</span>
              <input
                className="input"
                inputMode="numeric"
                value={values.recommendedDuration}
                onChange={(event) =>
                  setField('recommendedDuration', event.target.value)
                }
                placeholder="예: 40"
              />
              {fieldErrors.recommendedDuration && (
                <span className="field-error">
                  {fieldErrors.recommendedDuration}
                </span>
              )}
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section" disabled={saving}>
          <legend className="form-section-title">소개</legend>
          <div className="form-grid">
            <label className="field field-wide">
              <span className="field-label">이미지 URL</span>
              <input
                className="input"
                value={values.imageUrl}
                onChange={(event) => setField('imageUrl', event.target.value)}
                placeholder="https://…"
              />
            </label>

            <label className="field field-wide">
              <span className="field-label">설명</span>
              <textarea
                className="input textarea"
                rows={4}
                value={values.description}
                onChange={(event) =>
                  setField('description', event.target.value)
                }
                placeholder="우회 코스 추천 시 보여줄 장소 소개"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section" disabled={saving}>
          <legend className="form-section-title">태그</legend>
          {tagsError !== null && allTags === null ? (
            <p className="field-error">
              태그 목록을 불러오지 못했습니다: {tagsError}
            </p>
          ) : allTags === null ? (
            <p className="cell-muted">태그 목록을 불러오는 중…</p>
          ) : (
            <>
              <div className="tag-picker-header">
                <span className="field-label">
                  {managingTags
                    ? '태그 관리 — 클릭하면 태그가 전체에서 삭제됩니다'
                    : '클릭해서 이 장소의 태그를 선택/해제'}
                </span>
                <button
                  type="button"
                  className="tag-manage-toggle"
                  onClick={() => setManagingTags((previous) => !previous)}
                >
                  {managingTags ? '관리 끝내기' : '태그 관리'}
                </button>
              </div>
              {tagOptions.length === 0 ? (
                <p className="cell-muted">
                  아직 태그가 없습니다. 아래에서 첫 태그를 만들어 보세요.
                </p>
              ) : (
                <div className="tag-picker">
                  {tagOptions.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    if (managingTags) {
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className="tag-chip tag-chip-danger"
                          onClick={() =>
                            void handleDeleteTag(tag.id, tag.name)
                          }
                          title="태그 삭제"
                        >
                          {tag.name}
                          {tag.placeCount !== null && (
                            <span className="tag-chip-count">
                              {tag.placeCount}곳
                            </span>
                          )}
                          <span aria-hidden>×</span>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={`tag-chip${selected ? ' is-selected' : ''}`}
                        onClick={() => toggleTag(tag.id)}
                        aria-pressed={selected}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="tag-create">
                <input
                  className="input tag-create-input"
                  value={newTagName}
                  onChange={(event) => setNewTagName(event.target.value)}
                  placeholder="새 태그 이름"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleCreateTag();
                    }
                  }}
                />
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => void handleCreateTag()}
                  disabled={creatingTag || newTagName.trim().length === 0}
                >
                  {creatingTag ? '추가 중…' : '태그 추가'}
                </button>
              </div>
              {tagActionError && (
                <p className="field-error">{tagActionError}</p>
              )}
              <p className="field-hint">
                저장 시 이 장소의 태그가 현재 선택 목록으로 교체됩니다.
              </p>
            </>
          )}
        </fieldset>

        <div className="form-actions">
          {mode === 'edit' && place && (
            <button
              type="button"
              className="button button-danger form-actions-left"
              onClick={() => void handleDeletePlace()}
              disabled={deleting || saving}
            >
              {deleting ? '삭제 중…' : '장소 삭제'}
            </button>
          )}
          <Link to="/places" className="button button-secondary">
            취소
          </Link>
          <button
            type="submit"
            className="button button-primary"
            disabled={saving || deleting}
          >
            {saving
              ? '저장 중…'
              : mode === 'create'
                ? '장소 등록'
                : '변경사항 저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
