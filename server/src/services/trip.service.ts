import { TripEventType, TripStatus } from '@prisma/client';

import { prisma } from '../utils/prisma';

export async function createTrip(routeId: number) {
  const route = await prisma.route.findUnique({
    where: {
      id: routeId,
    },
    select: {
      id: true,
    },
  });

  if (!route) {
    return null;
  }

  return prisma.trip.create({
    data: {
      routeId,
    },
  });
}

export async function createTripEvent(
  tripId: number,
  input: {
    eventType: TripEventType;
  },
) {
  const trip = await prisma.trip.findUnique({
    where: {
      id: tripId,
    },
    select: {
      id: true,
    },
  });

  if (!trip) {
    return null;
  }

  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const event = await transaction.tripEvent.create({
      data: {
        tripId,
        eventType: input.eventType,
      },
    });

    if (input.eventType === TripEventType.TRIP_STARTED) {
      await transaction.trip.update({
        where: {
          id: tripId,
        },
        data: {
          status: TripStatus.IN_PROGRESS,
          startedAt: now,
        },
      });
    }

    if (input.eventType === TripEventType.TRIP_COMPLETED) {
      await transaction.trip.update({
        where: {
          id: tripId,
        },
        data: {
          status: TripStatus.COMPLETED,
          endedAt: now,
        },
      });
    }

    if (input.eventType === TripEventType.TRIP_CANCELLED) {
      await transaction.trip.update({
        where: {
          id: tripId,
        },
        data: {
          status: TripStatus.CANCELLED,
          endedAt: now,
        },
      });
    }

    return event;
  });
}

export async function getTripById(tripId: number) {
  return prisma.trip.findUnique({
    where: {
      id: tripId,
    },
    include: {
      events: {
        orderBy: {
          occurredAt: 'asc',
        },
      },
    },
  });
}