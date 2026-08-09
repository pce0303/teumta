import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaceType } from '@prisma/client';

const { placeFindManyMock } = vi.hoisted(() => ({
    placeFindManyMock: vi.fn(),
}));

vi.mock('../utils/prisma', () => ({
    prisma: {
        place: {
            findMany: placeFindManyMock,
        },
    },
}));

import { getPlaces } from './place.service';

beforeEach(() => {
    placeFindManyMock.mockReset();
    placeFindManyMock.mockResolvedValue([]);
});

describe('getPlaces', () => {
    it('tag가 있으면 해당 태그를 가진 장소만 조회한다', async () => {
        await getPlaces(undefined, '카페');

        expect(placeFindManyMock).toHaveBeenCalledWith({
            where: {
                placeTags: {
                    some: {
                        tag: {
                            name: '카페',
                        },
                    },
                },
            },
            include: {
                placeTags: {
                    include: {
                        tag: true,
                    },
                },
            },
            orderBy: {
                id: 'asc',
            },
        });
    });

    it('type과 tag를 함께 필터링할 수 있다', async () => {
        await getPlaces(PlaceType.LOCAL_PLACE, '카페');

        expect(placeFindManyMock).toHaveBeenCalledWith({
            where: {
                type: PlaceType.LOCAL_PLACE,
                placeTags: {
                    some: {
                        tag: {
                            name: '카페',
                        },
                    },
                },
            },
            include: {
                placeTags: {
                    include: {
                        tag: true,
                    },
                },
            },
            orderBy: {
                id: 'asc',
            },
        });
    });
});