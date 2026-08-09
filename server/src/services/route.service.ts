import { prisma } from '../utils/prisma';
import { transformPlace } from './place.service';

export async function getRoutesByPlaceId(placeId: number) {
  return prisma.route.findMany({
    where: {
      mainPlaceId: placeId,
    },
    orderBy: {
      id: 'asc',
    },
  });
}

export async function getRouteById(routeId: number) {
  const route = await prisma.route.findUnique({
    where: {
      id: routeId,
    },
    include: {
      stops: {
        orderBy: {
          stopOrder: 'asc',
        },
        include: {
          place: {
            include: {
              placeTags: {
                include: {
                  tag: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!route) {
    return null;
  }

  return {
    ...route,
    stops: route.stops.map((stop) => ({
      ...stop,
      place: transformPlace(stop.place),
    })),
  };
}