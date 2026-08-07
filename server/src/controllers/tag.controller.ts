import type { RequestHandler } from 'express';

import { createTag, deleteTag, getTags } from '../services/tag.service';

const MAX_TAG_NAME_LENGTH = 50;

/** GET /api/tags — 전체 태그 목록(사용 장소 수 포함). */
export const getTagsController: RequestHandler = async (_req, res, next) => {
  try {
    const tags = await getTags();

    res.status(200).json({
      success: true,
      data: tags,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/admin/tags — 태그 생성. 이름 unique. */
export const createTagController: RequestHandler = async (req, res, next) => {
  try {
    const name = req.body?.name;

    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: 'name은 비어 있지 않은 문자열이어야 합니다.',
        },
      });
      return;
    }

    const trimmedName = name.trim();

    if (trimmedName.length > MAX_TAG_NAME_LENGTH) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: `태그 이름은 ${MAX_TAG_NAME_LENGTH}자 이하여야 합니다.`,
        },
      });
      return;
    }

    const result = await createTag(trimmedName);

    if (result.status === 'DUPLICATE') {
      res.status(409).json({
        success: false,
        data: null,
        error: {
          code: 'TAG_ALREADY_EXISTS',
          message: `이미 존재하는 태그입니다: ${trimmedName}`,
        },
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: result.tag,
      error: null,
    });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/admin/tags/:id — 태그 삭제(장소-태그 연결도 함께 삭제, 장소는 유지). */
export const deleteTagController: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          message: '태그 ID는 양의 정수여야 합니다.',
        },
      });
      return;
    }

    const result = await deleteTag(id);

    if (result === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        data: null,
        error: {
          message: '태그를 찾을 수 없습니다.',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { deleted: true },
      error: null,
    });
  } catch (error) {
    next(error);
  }
};
