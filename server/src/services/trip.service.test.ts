import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TripEventType } from '@prisma/client';

const {
  routeFindUniqueMock,
  tripFindUniqueMock,
  tripCreateMock,
  tripUpdateMock,
  tripEventCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  routeFindUniqueMock: vi.fn(),
  tripFindUniqueMock: vi.fn(),
  tripCreateMock: vi.fn(),
  tripUpdateMock: vi.fn(),
  tripEventCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('../utils/prisma', () => ({
  prisma: {
    route: {
      findUnique: routeFindUniqueMock,
    },
    trip: {
      findUnique: tripFindUniqueMock,
      create: tripCreateMock,
      update: tripUpdateMock,
    },
    tripEvent: {
      create: tripEventCreateMock,
    },
    $transaction: transactionMock,
  },
}));

import {
  createTrip,
  createTripEvent,
  getTripById,
} from './trip.service';

beforeEach(() => {
  routeFindUniqueMock.mockReset();
  tripFindUniqueMock.mockReset();
  tripCreateMock.mockReset();
  tripEventCreateMock.mockReset();

  routeFindUniqueMock.mockResolvedValue(null);
  tripFindUniqueMock.mockResolvedValue(null);
  tripUpdateMock.mockReset();
  transactionMock.mockReset();

  transactionMock.mockImplementation(async (callback) =>
    callback({
      trip: {
        update: tripUpdateMock,
      },
      tripEvent: {
        create: tripEventCreateMock,
      },
    }),
  );
});

describe('createTrip', () => {
  it('존재하는 Route이면 Trip을 생성한다', async () => {
    const trip = {
      id: 1,
      routeId: 10,
      status: 'PLANNED',
    };

    routeFindUniqueMock.mockResolvedValue({ id: 10 });
    tripCreateMock.mockResolvedValue(trip);

    const result = await createTrip(10);

    expect(routeFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: 10,
      },
      select: {
        id: true,
      },
    });

    expect(tripCreateMock).toHaveBeenCalledWith({
      data: {
        routeId: 10,
      },
    });

    expect(result).toEqual(trip);
  });

  it('Route가 없으면 null을 반환하고 Trip을 생성하지 않는다', async () => {
    const result = await createTrip(999);

    expect(result).toBeNull();
    expect(tripCreateMock).not.toHaveBeenCalled();
  });
});

describe('createTripEvent', () => {
  it('TRIP_STARTED 이벤트 생성 시 Trip 상태를 IN_PROGRESS로 변경한다', async () => {
    const event = {
      id: 1,
      tripId: 5,
      eventType: TripEventType.TRIP_STARTED,
    };

    tripFindUniqueMock.mockResolvedValue({ id: 5 });
    tripEventCreateMock.mockResolvedValue(event);

    const result = await createTripEvent(5, {
      eventType: TripEventType.TRIP_STARTED,
    });

    expect(tripEventCreateMock).toHaveBeenCalledWith({
      data: {
        tripId: 5,
        eventType: TripEventType.TRIP_STARTED,
      },
    });

    expect(tripUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 5,
      },
      data: {
        status: 'IN_PROGRESS',
        startedAt: expect.any(Date),
      },
    });

    expect(result).toEqual(event);
  });

  it('Trip이 없으면 null을 반환하고 이벤트를 생성하지 않는다', async () => {
    const result = await createTripEvent(999, {
      eventType: TripEventType.TRIP_STARTED,
    });

    expect(result).toBeNull();
    expect(tripEventCreateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });
  it('TRIP_COMPLETED 이벤트 생성 시 Trip 상태를 COMPLETED로 변경한다', async () => {
    const event = {
      id: 2,
      tripId: 5,
      eventType: TripEventType.TRIP_COMPLETED,
    };

    tripFindUniqueMock.mockResolvedValue({ id: 5 });
    tripEventCreateMock.mockResolvedValue(event);

    const result = await createTripEvent(5, {
      eventType: TripEventType.TRIP_COMPLETED,
    });

    expect(tripUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 5,
      },
      data: {
        status: 'COMPLETED',
        endedAt: expect.any(Date),
      },
    });

    expect(result).toEqual(event);
  });

  it('TRIP_CANCELLED 이벤트 생성 시 Trip 상태를 CANCELLED로 변경한다', async () => {
    const event = {
      id: 3,
      tripId: 5,
      eventType: TripEventType.TRIP_CANCELLED,
    };

    tripFindUniqueMock.mockResolvedValue({ id: 5 });
    tripEventCreateMock.mockResolvedValue(event);

    const result = await createTripEvent(5, {
      eventType: TripEventType.TRIP_CANCELLED,
    });

    expect(tripUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 5,
      },
      data: {
        status: 'CANCELLED',
        endedAt: expect.any(Date),
      },
    });

    expect(result).toEqual(event);
  });
});

describe('getTripById', () => {
  it('Trip을 events 포함, occurredAt 오름차순으로 조회한다', async () => {
    const trip = {
      id: 5,
      routeId: 10,
      status: 'PLANNED',
      events: [],
    };

    tripFindUniqueMock.mockResolvedValue(trip);

    const result = await getTripById(5);

    expect(tripFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: 5,
      },
      include: {
        events: {
          orderBy: {
            occurredAt: 'asc',
          },
        },
      },
    });

    expect(result).toEqual(trip);
  });

  it('존재하지 않는 Trip은 null을 반환한다', async () => {
    const result = await getTripById(999);

    expect(result).toBeNull();
  });
});