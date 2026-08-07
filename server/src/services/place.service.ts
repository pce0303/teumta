import { PlaceType, Prisma } from '@prisma/client';

import { prisma } from '../utils/prisma';

const EARTH_RADIUS_METERS = 6_371_000;

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function calculateDistanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
) {
  const latitudeDifference = degreesToRadians(
    latitude2 - latitude1,
  );
  const longitudeDifference = degreesToRadians(
    longitude2 - longitude1,
  );

  const latitude1Radians = degreesToRadians(latitude1);
  const latitude2Radians = degreesToRadians(latitude2);

  const haversineValue =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitude1Radians) *
    Math.cos(latitude2Radians) *
    Math.sin(longitudeDifference / 2) ** 2;

  const centralAngle =
    2 *
    Math.atan2(
      Math.sqrt(haversineValue),
      Math.sqrt(1 - haversineValue),
    );

  return Math.round(EARTH_RADIUS_METERS * centralAngle);
}

function transformPlace(place: any) {
  const {
    placeTags,
    latitude,
    longitude,
    tourApiContentId: _tourApiContentId,
    ...placeData
  } = place;

  return {
    ...placeData,
    latitude: Number(latitude),
    longitude: Number(longitude),
    tags: placeTags.map((placeTag: any) => ({
      id: placeTag.tag.id,
      name: placeTag.tag.name,
    })),
  };
}

export async function findMissingTagIds(
  tagIds: number[],
): Promise<number[]> {
  const uniqueTagIds = [...new Set(tagIds)];

  if (uniqueTagIds.length === 0) {
    return [];
  }

  const existingTags = await prisma.tag.findMany({
    where: {
      id: {
        in: uniqueTagIds,
      },
    },
    select: {
      id: true,
    },
  });

  const existingTagIds = new Set(
    existingTags.map((tag) => tag.id),
  );

  return uniqueTagIds.filter(
    (tagId) => !existingTagIds.has(tagId),
  );
}

export async function getPlaces(type?: PlaceType) {
  const places = await prisma.place.findMany({
    where: type
      ? {
        type,
      }
      : undefined,
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

  return places.map(transformPlace);
}

export async function getPlaceById(id: number) {
  const place = await prisma.place.findUnique({
    where: {
      id,
    },
    include: {
      placeTags: {
        include: {
          tag: true,
        },
      },
    },
  });

  if (!place) {
    return null;
  }

  return transformPlace(place);
}

export interface CreatePlaceInput {
  name: string;
  type: PlaceType;
  address?: string | null;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
  description?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  recommendedDuration?: number | null;
  tourApiContentId?: string | null;
  tagIds?: number[];
}

export interface UpdatePlaceInput {
  name?: string;
  type?: PlaceType;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  imageUrl?: string | null;
  description?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  recommendedDuration?: number | null;
  tourApiContentId?: string | null;
  tagIds?: number[];
}

export async function createPlace(input: CreatePlaceInput) {
  const {
    tagIds = [],
    ...placeData
  } = input;

  const uniqueTagIds = [...new Set(tagIds)];

  const createdPlace = await prisma.place.create({
    data: {
      ...placeData,
      placeTags: {
        create: uniqueTagIds.map((tagId) => ({
          tag: {
            connect: {
              id: tagId,
            },
          },
        })),
      },
    },
    include: {
      placeTags: {
        include: {
          tag: true,
        },
      },
    },
  });

  return transformPlace(createdPlace);
}

export async function updatePlace(
  id: number,
  input: UpdatePlaceInput,
) {
  const {
    tagIds,
    ...placeData
  } = input;

  const existingPlace = await prisma.place.findUnique({
    where: {
      id,
    },
  });

  if (!existingPlace) {
    return null;
  }

  const updatedPlace = await prisma.place.update({
    where: {
      id,
    },
    data: {
      ...placeData,
      ...(tagIds !== undefined
        ? {
          placeTags: {
            deleteMany: {},
            create: [...new Set(tagIds)].map((tagId) => ({
              tag: {
                connect: {
                  id: tagId,
                },
              },
            })),
          },
        }
        : {}),
    },
    include: {
      placeTags: {
        include: {
          tag: true,
        },
      },
    },
  });

  return transformPlace(updatedPlace);
}

export type DeletePlaceResult = 'DELETED' | 'NOT_FOUND' | 'IN_USE';

/**
 * 장소 삭제. PlaceTag/Congestion/ForecastPlaceAlias는 cascade로 함께 정리된다.
 * Route(mainPlace)/RouteStop이 참조 중이면 DB 제약(RESTRICT)에 걸려 IN_USE를 반환한다 —
 * 코스 데이터를 보호하기 위한 의도된 동작이다(코스에서 먼저 제거해야 삭제 가능).
 */
export async function deletePlace(id: number): Promise<DeletePlaceResult> {
  try {
    await prisma.place.delete({
      where: {
        id,
      },
    });
    return 'DELETED';
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return 'NOT_FOUND';
      }
      // P2003: FK 제약 위반(Route/RouteStop 등에서 사용 중).
      if (error.code === 'P2003') {
        return 'IN_USE';
      }
    }
    throw error;
  }
}

/** @deprecated getNearbyLocalPlacesRealtime(실시간 TourAPI+TMAP)으로 대체됨. 신규 사용 금지. */
export async function getNearbyLocalPlaces(
  touristSpotId: number,
  radiusMeters = 2000,
) {
  const touristSpot = await prisma.place.findUnique({
    where: {
      id: touristSpotId,
    },
    select: {
      id: true,
      type: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!touristSpot) {
    return {
      status: 'NOT_FOUND' as const,
      places: [],
    };
  }

  if (touristSpot.type !== PlaceType.TOURIST_SPOT) {
    return {
      status: 'NOT_TOURIST_SPOT' as const,
      places: [],
    };
  }

  const localPlaces = await prisma.place.findMany({
    where: {
      type: PlaceType.LOCAL_PLACE,
    },
    include: {
      placeTags: {
        include: {
          tag: true,
        },
      },
    },
  });

  const touristLatitude = Number(touristSpot.latitude);
  const touristLongitude = Number(touristSpot.longitude);

  const nearbyLocalPlaces = localPlaces
    .map((localPlace) => {
      const transformedPlace = transformPlace(localPlace);

      const distanceMeters = calculateDistanceMeters(
        touristLatitude,
        touristLongitude,
        Number(localPlace.latitude),
        Number(localPlace.longitude),
      );

      return {
        ...transformedPlace,
        distanceMeters,
      };
    })
    .filter(
      (localPlace) =>
        localPlace.distanceMeters <= radiusMeters,
    )
    .sort(
      (firstPlace, secondPlace) =>
        firstPlace.distanceMeters -
        secondPlace.distanceMeters,
    );

  return {
    status: 'SUCCESS' as const,
    places: nearbyLocalPlaces,
  };
}