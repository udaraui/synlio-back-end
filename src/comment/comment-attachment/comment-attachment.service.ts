import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  CreateCommentAttachmentDto,
  UpdateCommentAttachmentDto,
} from './dto/comment-attachment.dto';
import { CommentAttachment } from './comment-attachment.entity';

@Injectable()
export class CommentAttachmentService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  async create(data: CreateCommentAttachmentDto, authUser: any) {
    // Validate comment exists
    // const comment = await this.entityManager.findOne(Comment, {
    //   where: { id: data.commentId },
    // });
    // if (!comment) {
    //   throw new HttpException('Comment not found', HttpStatus.BAD_REQUEST);
    // }

    const newAttachment = new CommentAttachment();
    newAttachment.link = data.link;
    newAttachment.commentId = data.commentId;
    newAttachment.createdBy = authUser?.email;

    const savedAttachment = await this.entityManager.save(newAttachment);
    return this.findOne(savedAttachment.id!);
  }

  async update(id: number, data: UpdateCommentAttachmentDto, authUser: any) {
    return await this.entityManager.transaction(async (manager) => {
      const attachment = await manager.findOne(CommentAttachment, {
        where: { id },
      });

      if (!attachment) {
        throw new HttpException(
          'Comment attachment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      attachment.link = data.link;
      attachment.updatedBy = authUser?.email;
      await manager.save(attachment);

      return this.findOne(id);
    });
  }

  async findOne(id: number) {
    const attachment = await this.entityManager.findOne(CommentAttachment, {
      where: { id },
      relations: ['comment'],
    });

    if (!attachment) {
      throw new HttpException(
        'Comment attachment not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return attachment;
  }

  async findAll() {
    return await this.entityManager.find(CommentAttachment, {
      relations: ['comment'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByComment(commentId: number) {
    return await this.entityManager.find(CommentAttachment, {
      where: { commentId },
      order: { createdAt: 'ASC' },
    });
  }

  async delete(id: number, authUser: any) {
    return await this.entityManager.transaction(async (manager) => {
      const attachment = await manager.findOne(CommentAttachment, {
        where: { id },
      });

      if (!attachment) {
        throw new HttpException(
          'Comment attachment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      await manager.remove(attachment);
      return { message: 'Comment attachment deleted', id };
    });
  }
}
