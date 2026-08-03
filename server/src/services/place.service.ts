import type { PlaceType } from '@prisma/client';

import { prisma } from '../utils/prisma';

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