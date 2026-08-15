import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaceType } from '@prisma/client';

const { getPlacesMock } = vi.hoisted(() => ({
    getPlacesMock: vi.fn(),
}));

vi.mock('../services/place.service', () => ({
    getPlaces: getPlacesMock,
}));

import { getPlacesController } from './place.controller';

function makeReq(query: Record<string, unknown> = {}) {
    return {
        query,
    } as any;
}

function makeRes() {
    const res: any = {
        statusCode: 200,
        body: undefined,
    };

    res.status = vi.fn((statusCode: number) => {
        res.statusCode = statusCode;
        return res;
    });

    res.json = vi.fn((body: unknown) => {
        res.body = body;
        return res;
    });

    return res;
}

beforeEach(() => {
    getPlacesMock.mockReset();
    getPlacesMock.mockResolvedValue([]);
});

describe('getPlacesController', () => {
    it('tag를 getPlaces에 전달한다', async () => {
        const req = makeReq({
            tag: '카페',
        });
        const res = makeRes();
        const next = vi.fn();

        await getPlacesController(req, res, next);

        expect(getPlacesMock).toHaveBeenCalledWith(
            undefined,
            '카페',
        );
        expect(res.statusCode).toBe(200);
    });

    it('type과 tag를 함께 getPlaces에 전달한다', async () => {
        const req = makeReq({
            type: PlaceType.LOCAL_PLACE,
            tag: '카페',
        });
        const res = makeRes();
        const next = vi.fn();

        await getPlacesController(req, res, next);

        expect(getPlacesMock).toHaveBeenCalledWith(
            PlaceType.LOCAL_PLACE,
            '카페',
        );
        expect(res.statusCode).toBe(200);
    });

    it('빈 tag는 400을 반환한다', async () => {
        const req = makeReq({
            tag: '   ',
        });
        const res = makeRes();
        const next = vi.fn();

        await getPlacesController(req, res, next);

        expect(res.statusCode).toBe(400);
        expect(getPlacesMock).not.toHaveBeenCalled();
    });

    it('tag가 배열이면 400을 반환한다', async () => {
        const req = makeReq({
            tag: ['카페', '맛집'],
        });
        const res = makeRes();
        const next = vi.fn();

        await getPlacesController(req, res, next);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({
            success: false,
            data: null,
            error: {
                code: 'INVALID_TAG',
                message: 'tag는 비어 있지 않은 문자열이어야 합니다.',
            },
        });
        expect(getPlacesMock).not.toHaveBeenCalled();
    });
});