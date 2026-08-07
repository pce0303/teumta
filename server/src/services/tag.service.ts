import { Prisma } from '@prisma/client';

import { prisma } from '../utils/prisma';

export interface TagWithUsage {
  id: number;
  name: string;
  /** 이 태그가 지정된 장소 수. */
  placeCount: number;
}

export async function getTags(): Promise<TagWithUsage[]> {
  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: {
          placeTags: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    placeCount: tag._count.placeTags,
  }));
}

export type CreateTagResult =
  | { status: 'CREATED'; tag: TagWithUsage }
  | { status: 'DUPLICATE' };

export async function createTag(name: string): Promise<CreateTagResult> {
  try {
    const tag = await prisma.tag.create({
      data: {
        name,
      },
    });
    return {
      status: 'CREATED',
      tag: { id: tag.id, name: tag.name, placeCount: 0 },
    };
  } catch (error) {
    // P2002: unique 제약(name) 위반 — 이미 같은 이름의 태그가 있다.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { status: 'DUPLICATE' };
    }
    throw error;
  }
}

export type DeleteTagResult = 'DELETED' | 'NOT_FOUND';

/** 태그 삭제. PlaceTag는 onDelete: Cascade로 함께 정리된다(장소 자체는 유지). */
export async function deleteTag(id: number): Promise<DeleteTagResult> {
  try {
    await prisma.tag.delete({
      where: {
        id,
      },
    });
    return 'DELETED';
  } catch (error) {
    // P2025: 대상 없음.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return 'NOT_FOUND';
    }
    throw error;
  }
}
