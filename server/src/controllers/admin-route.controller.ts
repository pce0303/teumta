import type { RequestHandler } from 'express';

import {
  createRoute,
  deleteRoute,
  getAllRoutes,
  updateRoute,
  type RouteStopInput,
} from '../services/route.service';

/**
 * 관리자 코스 관리 API(api-spec §6.5). 전부 /api/admin/* 보호 범위.
 * 이동시간·거리·경로는 요청 본문으로 받지 않는다 — 서버가 TMAP으로 계산한다.
 */

const MAX_NAME_LENGTH = 191;

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function parsePositiveIntParam(value: string | string[] | undefined): number | null {
  if (value === undefined || Array.isArray(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function badRequest(res: Parameters<RequestHandler>[1], message: string) {
  res.status(400).json({
    success: false,
    data: null,
    error: { code: 'INVALID_ROUTE_INPUT', message },
  });
}

type StopsParseResult =
  | { ok: true; stops: RouteStopInput[] }
  | { ok: false; message: string };

function parseStops(value: unknown): StopsParseResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, message: 'stops는 1개 이상의 배열이어야 합니다.' };
  }

  const stops: RouteStopInput[] = [];
  for (const [index, raw] of value.entries()) {
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, message: `stops[${index}]가 객체가 아닙니다.` };
    }
    const { placeId, stayMinutes } = raw as Record<string, unknown>;
    if (!isPositiveInt(placeId)) {
      return { ok: false, message: `stops[${index}].placeId는 양의 정수여야 합니다.` };
    }
    if (!isPositiveInt(stayMinutes)) {
      return { ok: false, message: `stops[${index}].stayMinutes는 양의 정수여야 합니다.` };
    }
    stops.push({ placeId, stayMinutes });
  }
  return { ok: true, stops };
}

function parseName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    return null;
  }
  return trimmed;
}

/** GET /api/admin/routes — 전체 코스 목록(mainPlaceName·stopCount 포함). */
export const listRoutesController: RequestHandler = async (req, res, next) => {
  try {
    const rawMainPlaceId = req.query.mainPlaceId;

    if (rawMainPlaceId !== undefined && typeof rawMainPlaceId !== 'string') {
      badRequest(res, 'mainPlaceId는 양의 정수여야 합니다.');
      return;
    }

    const mainPlaceId =
      rawMainPlaceId === undefined ? undefined : parsePositiveIntParam(rawMainPlaceId);

    if (rawMainPlaceId !== undefined && mainPlaceId === null) {
      badRequest(res, 'mainPlaceId는 양의 정수여야 합니다.');
      return;
    }

    res.status(200).json({
      success: true,
      data: await getAllRoutes(mainPlaceId ?? undefined),
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/admin/routes — 코스 생성(정류지 구성 + TMAP 계산). */
export const createRouteController: RequestHandler = async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = parseName(body.name);
    if (name === null) {
      badRequest(res, `name은 1~${MAX_NAME_LENGTH}자의 문자열이어야 합니다.`);
      return;
    }

    if (!isPositiveInt(body.mainPlaceId)) {
      badRequest(res, 'mainPlaceId는 양의 정수여야 합니다.');
      return;
    }

    if (body.description !== undefined && body.description !== null
      && typeof body.description !== 'string') {
      badRequest(res, 'description은 문자열이거나 null이어야 합니다.');
      return;
    }

    if (body.includeReturn !== undefined && typeof body.includeReturn !== 'boolean') {
      badRequest(res, 'includeReturn은 boolean이어야 합니다.');
      return;
    }

    const parsedStops = parseStops(body.stops);
    if (!parsedStops.ok) {
      badRequest(res, parsedStops.message);
      return;
    }

    const result = await createRoute({
      name,
      mainPlaceId: body.mainPlaceId,
      description: (body.description as string | null | undefined) ?? null,
      includeReturn: body.includeReturn as boolean | undefined,
      stops: parsedStops.stops,
    });

    if (result.status === 'INVALID') {
      badRequest(res, result.message);
      return;
    }

    res.status(201).json({ success: true, data: result.route, error: null });
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/admin/routes/:id — 부분 수정. stops를 보내면 전체 교체 + TMAP 재계산. */
export const updateRouteController: RequestHandler = async (req, res, next) => {
  try {
    const id = parsePositiveIntParam(req.params.id);
    if (id === null) {
      badRequest(res, '코스 ID는 양의 정수여야 합니다.');
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    let name: string | undefined;
    if (body.name !== undefined) {
      const parsed = parseName(body.name);
      if (parsed === null) {
        badRequest(res, `name은 1~${MAX_NAME_LENGTH}자의 문자열이어야 합니다.`);
        return;
      }
      name = parsed;
    }

    if (body.mainPlaceId !== undefined && !isPositiveInt(body.mainPlaceId)) {
      badRequest(res, 'mainPlaceId는 양의 정수여야 합니다.');
      return;
    }

    if (body.description !== undefined && body.description !== null
      && typeof body.description !== 'string') {
      badRequest(res, 'description은 문자열이거나 null이어야 합니다.');
      return;
    }

    if (body.includeReturn !== undefined && typeof body.includeReturn !== 'boolean') {
      badRequest(res, 'includeReturn은 boolean이어야 합니다.');
      return;
    }

    let stops: RouteStopInput[] | undefined;
    if (body.stops !== undefined) {
      const parsed = parseStops(body.stops);
      if (!parsed.ok) {
        badRequest(res, parsed.message);
        return;
      }
      stops = parsed.stops;
    }

    const result = await updateRoute(id, {
      ...(name !== undefined ? { name } : {}),
      ...(body.mainPlaceId !== undefined
        ? { mainPlaceId: body.mainPlaceId as number }
        : {}),
      ...(body.description !== undefined
        ? { description: body.description as string | null }
        : {}),
      ...(body.includeReturn !== undefined
        ? { includeReturn: body.includeReturn as boolean }
        : {}),
      ...(stops !== undefined ? { stops } : {}),
    });

    if (result.status === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        data: null,
        error: { code: 'ROUTE_NOT_FOUND', message: '코스를 찾을 수 없습니다.' },
      });
      return;
    }

    if (result.status === 'TRIP_IN_PROGRESS') {
      res.status(409).json({
        success: false,
        data: null,
        error: {
          code: 'ROUTE_TRIP_IN_PROGRESS',
          message: '진행 중인 방문이 있는 코스는 정류지 구성을 바꿀 수 없습니다.',
        },
      });
      return;
    }

    if (result.status === 'INVALID') {
      badRequest(res, result.message);
      return;
    }

    res.status(200).json({ success: true, data: result.route, error: null });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/admin/routes/:id — Trip이 참조 중이면 409. */
export const deleteRouteController: RequestHandler = async (req, res, next) => {
  try {
    const id = parsePositiveIntParam(req.params.id);
    if (id === null) {
      badRequest(res, '코스 ID는 양의 정수여야 합니다.');
      return;
    }

    const result = await deleteRoute(id);

    if (result === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        data: null,
        error: { code: 'ROUTE_NOT_FOUND', message: '코스를 찾을 수 없습니다.' },
      });
      return;
    }

    if (result === 'IN_USE') {
      res.status(409).json({
        success: false,
        data: null,
        error: {
          code: 'ROUTE_IN_USE',
          message: '방문(Trip) 기록이 있는 코스는 삭제할 수 없습니다.',
        },
      });
      return;
    }

    res.status(200).json({ success: true, data: { deleted: true }, error: null });
  } catch (error) {
    next(error);
  }
};
