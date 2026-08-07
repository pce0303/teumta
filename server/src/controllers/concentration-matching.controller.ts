import type { RequestHandler } from 'express';

import { ingestConcentrationForecasts } from '../services/congestion-ingestion.service';
import {
  deleteForecastAlias,
  listForecastAliases,
  previewConcentrationMatching,
  upsertForecastAlias,
} from '../services/concentration-matching.service';

const REGION_CODE_PATTERN = /^\d{1,8}$/;

function readRegionParams(query: {
  areaCd?: unknown;
  signguCd?: unknown;
}): { areaCd: string; signguCd: string } | null {
  const areaCd = typeof query.areaCd === 'string' ? query.areaCd.trim() : '';
  const signguCd =
    typeof query.signguCd === 'string' ? query.signguCd.trim() : '';

  if (!REGION_CODE_PATTERN.test(areaCd) || !REGION_CODE_PATTERN.test(signguCd)) {
    return null;
  }
  return { areaCd, signguCd };
}

/** GET /api/admin/concentration-matching/preview?areaCd=&signguCd= — 외부 API 1회 호출, 저장 없음. */
export const previewMatchingController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const region = readRegionParams(req.query);

    if (!region) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message:
            'areaCd(법정동 시도코드)와 signguCd(법정동 시군구코드)는 숫자 문자열로 필수입니다.',
        },
      });
      return;
    }

    const preview = await previewConcentrationMatching(
      region.areaCd,
      region.signguCd,
    );

    res.status(200).json({
      success: true,
      data: preview,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/admin/concentration-matching/ingest — 해당 지역 적재 즉시 실행(alias 반영 확인용). */
export const runMatchingIngestController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const region = readRegionParams(req.body ?? {});

    if (!region) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message:
            'areaCd(법정동 시도코드)와 signguCd(법정동 시군구코드)는 숫자 문자열로 필수입니다.',
        },
      });
      return;
    }

    const result = await ingestConcentrationForecasts(region);

    res.status(200).json({
      success: true,
      data: {
        matchedPlaces: result.matchedPlaces,
        aliasMatchedPlaces: result.aliasMatchedPlaces,
        inserted: result.inserted,
        deleted: result.deleted,
        unmatched: result.unmatched,
        ambiguous: result.ambiguous,
        skippedCount: result.skipped.length,
      },
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/admin/concentration-matching/aliases */
export const listAliasesController: RequestHandler = async (
  _req,
  res,
  next,
) => {
  try {
    const aliases = await listForecastAliases();

    res.status(200).json({
      success: true,
      data: aliases,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/admin/concentration-matching/aliases — 같은 키가 있으면 대상 장소를 교체(upsert). */
export const upsertAliasController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { areaCd, signguCd, tAtsNm, placeId } = req.body ?? {};

    const region = readRegionParams({ areaCd, signguCd });
    if (!region) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message:
            'areaCd(법정동 시도코드)와 signguCd(법정동 시군구코드)는 숫자 문자열로 필수입니다.',
        },
      });
      return;
    }

    if (typeof tAtsNm !== 'string' || tAtsNm.trim().length === 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'tAtsNm(KTO 관광지명)은 비어 있지 않은 문자열이어야 합니다.',
        },
      });
      return;
    }

    if (!Number.isInteger(placeId) || placeId <= 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'placeId는 양의 정수여야 합니다.',
        },
      });
      return;
    }

    const result = await upsertForecastAlias({
      areaCd: region.areaCd,
      signguCd: region.signguCd,
      tAtsNm,
      placeId,
    });

    if (result.status === 'PLACE_NOT_FOUND') {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `존재하지 않는 장소 ID입니다: ${placeId}`,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.alias,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/admin/concentration-matching/aliases/:id */
export const deleteAliasController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'alias ID는 양의 정수여야 합니다.',
        },
      });
      return;
    }

    const result = await deleteForecastAlias(id);

    if (result === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        data: null,
        error: {
          message: 'alias를 찾을 수 없습니다.',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { deleted: true },
      error: null,
    });
  } catch (error) {
    next(error);
  }
};
