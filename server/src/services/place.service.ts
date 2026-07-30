import { prisma } from '../utils/prisma';

export async function getPlaces() {
  return prisma.place.findMany({
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
}

export async function getPlaceById(id: number) {
  return prisma.place.findUnique({
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
}