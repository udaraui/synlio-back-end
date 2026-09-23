import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { Comment } from './comment.entity';
import { CommentAttachment } from '../comment-attachment/comment-attachment.entity';
import { User } from '../../user-management/user/user.entity';
import { uploadAttachmentToAzure } from '../../common/azure/azure-image-upload';
import { PostType } from '../../common/enum/post-type.enum';
import { Ticket } from '../../ticket-management/ticket/ticket.entity';
import { Task } from '../../task-management/task/task.entity';
import { TicketAlertService } from '../../ticket-management/ticket-alert/ticket-alert.service';
import { TaskAlertService } from '../../task-management/task-alert/task-alert.service';

@Injectable()
export class CommentService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    private readonly ticketAlertService: TicketAlertService,
    private readonly taskAlertService: TaskAlertService,
  ) {}

  async create(
    data: CreateCommentDto,
    files: Express.Multer.File[] | undefined,
    authUser: any,
  ) {
    const result = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const newComment = new Comment();
        newComment.comment = data.comment;
        newComment.postId = data.postId;
        newComment.postType = data.postType;
        newComment.createdBy = authUser?.email;

        // Validate parent comment if provided
        if (data.parentId) {
          const parentComment = await transactionalEntityManager.findOne(
            Comment,
            {
              where: { id: data.parentId },
            },
          );
          if (!parentComment) {
            throw new HttpException(
              'Parent comment not found',
              HttpStatus.BAD_REQUEST,
            );
          }
          newComment.parentId = data.parentId;
        }

        const savedComment = await transactionalEntityManager.save(newComment);

        // Handle file uploads if files are provided
        const uploadedUrls: string[] = [];
        if (files && files.length > 0) {
          const userId = authUser?.id || 0;
          for (const file of files) {
            const fileUrl = await uploadAttachmentToAzure(file, userId);
            uploadedUrls.push(fileUrl);
          }
        }

        // Combine uploaded file URLs with attachmentLinks from DTO
        const allAttachmentLinks = [
          ...(data.attachmentLinks || []),
          ...uploadedUrls,
        ];

        // Create attachments if there are any links
        if (allAttachmentLinks.length > 0) {
          const attachments = allAttachmentLinks.map((link) => {
            const attachment = new CommentAttachment();
            attachment.link = link;
            attachment.commentId = savedComment.id!;
            attachment.createdBy = authUser?.email;
            return attachment;
          });

          await transactionalEntityManager.save(CommentAttachment, attachments);
        }

        // Update updatedBy / updatedAt on the parent Ticket or Task
        if (data.postType === PostType.TKT) {
          const ticket = await transactionalEntityManager.findOne(Ticket, {
            where: { id: data.postId },
          });
          if (ticket) {
            ticket.updatedBy = authUser?.email;
            ticket.updatedAt = new Date();
            await transactionalEntityManager.save(Ticket, ticket);
          }
        } else if (data.postType === PostType.TSK) {
          const task = await transactionalEntityManager.findOne(Task, {
            where: { id: data.postId },
          });
          if (task) {
            task.updatedBy = authUser?.email;
            task.updatedAt = new Date();
            await transactionalEntityManager.save(Task, task);
          }
        }

        // Return the comment with relations from within the transaction
        return await transactionalEntityManager.findOne(Comment, {
          where: { id: savedComment.id },
          relations: ['parentComment', 'childComments', 'commentAttachments'],
        });
      },
    );

    // After transaction commits — fire ticket alert for new ticket comments
    if (data.postType === PostType.TKT) {
      await this.ticketAlertService.dispatchCommentAdded(
        data.postId,
        data.comment,
        authUser,
      );
    }

    // After transaction commits — fire task alert for new task comments
    if (data.postType === PostType.TSK) {
      void this.taskAlertService.dispatchCommentAdded(
        data.postId,
        data.comment,
        authUser,
      );
    }

    return result;
  }

  async update(
    id: number,
    data: UpdateCommentDto,
    files: Express.Multer.File[] | undefined,
    authUser: any,
  ) {
    return await this.entityManager.transaction(async (manager) => {
      const comment = await manager.findOne(Comment, {
        where: { id },
      });

      if (!comment) {
        throw new HttpException('Comment not found', HttpStatus.NOT_FOUND);
      }

      if (data.comment !== undefined) {
        comment.comment = data.comment;
      }
      if (data.postId !== undefined) {
        comment.postId = data.postId;
      }
      if (data.postType !== undefined) {
        comment.postType = data.postType;
      }
      if (data.parentId !== undefined) {
        // Validate parent comment if provided
        if (data.parentId) {
          const parentComment = await manager.findOne(Comment, {
            where: { id: data.parentId },
          });
          if (!parentComment) {
            throw new HttpException(
              'Parent comment not found',
              HttpStatus.BAD_REQUEST,
            );
          }
        }
        comment.parentId = data.parentId;
      }

      comment.updatedBy = authUser?.email;
      await manager.save(comment);

      // Handle file uploads if files are provided
      if (files && files.length > 0) {
        for (const file of files) {
          const fileUrl = await uploadAttachmentToAzure(file, id);

          // Create attachment record
          const attachment = new CommentAttachment();
          attachment.link = fileUrl;
          attachment.commentId = id;
          attachment.createdBy = authUser?.email;
          await manager.save(CommentAttachment, attachment);
        }
      }

      // Handle attachmentLinks from DTO
      if (data.attachmentLinks && data.attachmentLinks.length > 0) {
        const attachments = data.attachmentLinks.map((link) => {
          const attachment = new CommentAttachment();
          attachment.link = link;
          attachment.commentId = id;
          attachment.createdBy = authUser?.email;
          return attachment;
        });

        await manager.save(CommentAttachment, attachments);
      }

      // Update updatedBy / updatedAt on the parent Ticket or Task
      if (comment.postType === PostType.TKT) {
        const ticket = await manager.findOne(Ticket, {
          where: { id: comment.postId },
        });
        if (ticket) {
          ticket.updatedBy = authUser?.email;
          ticket.updatedAt = new Date();
          await manager.save(Ticket, ticket);
        }
      } else if (comment.postType === PostType.TSK) {
        const task = await manager.findOne(Task, {
          where: { id: comment.postId },
        });
        if (task) {
          task.updatedBy = authUser?.email;
          task.updatedAt = new Date();
          await manager.save(Task, task);
        }
      }

      // Return the comment with relations from within the transaction
      return await manager.findOne(Comment, {
        where: { id },
        relations: ['parentComment', 'childComments', 'commentAttachments'],
      });
    });
  }

  // Helper method to enrich comments with user profile information
  private async enrichCommentWithUserData(comment: any): Promise<any> {
    if (comment.createdBy) {
      const user = await this.entityManager.findOne(User, {
        where: { email: comment.createdBy },
        select: ['id', 'first_name', 'last_name', 'email', 'profile_picture'],
      });

      if (user) {
        comment.createdByUser = {
          username: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_picture: user.profile_picture,
        };
      }
    }

    // Recursively enrich child comments
    if (comment.childComments && comment.childComments.length > 0) {
      for (const childComment of comment.childComments) {
        await this.enrichCommentWithUserData(childComment);
      }
    }

    return comment;
  }

  async findOne(id: number) {
    const comment = await this.entityManager.findOne(Comment, {
      where: { id },
      relations: ['parentComment', 'childComments', 'commentAttachments'],
    });

    if (!comment) {
      throw new HttpException('Comment not found', HttpStatus.NOT_FOUND);
    }

    // Enrich with user data
    await this.enrichCommentWithUserData(comment);

    return comment;
  }

  async findAll() {
    return await this.entityManager.find(Comment, {
      relations: ['parentComment', 'childComments', 'commentAttachments'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByPost(postId: number, postType: string) {
    // First, get all comments for this post
    const allComments = await this.entityManager.find(Comment, {
      where: { postId, postType: postType as any },
      relations: ['commentAttachments'],
      order: { createdAt: 'DESC' },
    });

    // Build a tree structure manually
    const commentMap = new Map<number, any>();
    const topLevelComments: any[] = [];

    // First pass: create map of all comments
    allComments.forEach((comment) => {
      if (comment.id) {
        commentMap.set(comment.id, { ...comment, childComments: [] });
      }
    });

    // Second pass: build tree structure
    allComments.forEach((comment) => {
      if (!comment.id) return;

      const commentWithChildren = commentMap.get(comment.id);
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.childComments.push(commentWithChildren);
        }
      } else {
        topLevelComments.push(commentWithChildren);
      }
    });

    // Enrich each comment with user data
    for (const comment of topLevelComments) {
      await this.enrichCommentWithUserData(comment);
    }

    return topLevelComments;
  }

  async findByParent(parentId: number) {
    const comments = await this.entityManager.find(Comment, {
      where: { parentId },
      relations: ['childComments', 'commentAttachments'],
      order: { createdAt: 'DESC' },
    });

    // Enrich each comment with user data
    for (const comment of comments) {
      await this.enrichCommentWithUserData(comment);
    }

    return comments;
  }

  async delete(id: number, authUser: any) {
    const comment = await this.entityManager.findOne(Comment, {
      where: { id },
      relations: ['childComments', 'commentAttachments'],
    });

    if (!comment) {
      throw new HttpException('Comment not found', HttpStatus.NOT_FOUND);
    }

    // Check if comment has child comments
    if (comment.childComments && comment.childComments.length > 0) {
      throw new HttpException(
        'Cannot delete comment with replies. Delete replies first',
        HttpStatus.BAD_REQUEST,
      );
    }

    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        // Delete attachments first
        if (
          comment.commentAttachments &&
          comment.commentAttachments.length > 0
        ) {
          await transactionalEntityManager.remove(comment.commentAttachments);
        }

        // Delete the comment
        await transactionalEntityManager.remove(comment);

        // Update updatedBy / updatedAt on the parent Ticket or Task
        if (comment.postType === PostType.TKT) {
          const ticket = await transactionalEntityManager.findOne(Ticket, {
            where: { id: comment.postId },
          });
          if (ticket) {
            ticket.updatedBy = authUser?.email;
            ticket.updatedAt = new Date();
            await transactionalEntityManager.save(Ticket, ticket);
          }
        } else if (comment.postType === PostType.TSK) {
          const task = await transactionalEntityManager.findOne(Task, {
            where: { id: comment.postId },
          });
          if (task) {
            task.updatedBy = authUser?.email;
            task.updatedAt = new Date();
            await transactionalEntityManager.save(Task, task);
          }
        }

        return { message: 'Comment deleted', id };
      },
    );
  }
}
