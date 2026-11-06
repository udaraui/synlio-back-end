import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
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

export const USER_PROFILE_UPDATED_EVENT = 'user.profile.updated';

export interface UserProfileUpdatedEventPayload {
  userId: number;
  firstName: string;
  lastName: string;
  profilePicture?: string | null;
}

export interface AuthenticatedUserPayload {
  id?: number;
  userId?: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  profile_picture?: string | null;
}

export interface CommentTreeNode extends Comment {
  childComments: CommentTreeNode[];
}

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly ticketAlertService: TicketAlertService,
    private readonly taskAlertService: TaskAlertService,
  ) {}

  async create(
    data: CreateCommentDto,
    files: Express.Multer.File[] | undefined,
    authUser: AuthenticatedUserPayload,
  ): Promise<Comment | null> {
    const {
      id,
      userId: jwtUserId,
      email,
      first_name,
      last_name,
      profile_picture,
    } = authUser;

    let resolvedUserId = id ?? jwtUserId;
    let resolvedFirstName = first_name;
    let resolvedLastName = last_name;
    let resolvedProfilePicture = profile_picture;

    // Fallback lookup when JwtStrategy only provides { userId, username, email }
    if (
      resolvedProfilePicture === undefined ||
      (!resolvedFirstName && !resolvedLastName)
    ) {
      const dbUser = await this.entityManager.findOne(User, {
        where: resolvedUserId ? { id: resolvedUserId } : { email },
        select: ['id', 'first_name', 'last_name', 'email', 'profile_picture'],
      });
      if (dbUser) {
        resolvedUserId = resolvedUserId ?? dbUser.id;
        resolvedFirstName = resolvedFirstName ?? dbUser.first_name;
        resolvedLastName = resolvedLastName ?? dbUser.last_name;
        resolvedProfilePicture =
          resolvedProfilePicture ?? dbUser.profile_picture ?? null;
      }
    }

    if (!resolvedUserId || !email) {
      throw new HttpException(
        'Authenticated user context is missing required fields',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const constructedUsername =
      `${resolvedFirstName ?? ''} ${resolvedLastName ?? ''}`.trim() ||
      authUser.username?.trim() ||
      email;

    const result = await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const newComment = new Comment();
        newComment.comment = data.comment;
        newComment.postId = data.postId;
        newComment.postType = data.postType;
        newComment.createdBy = email;
        newComment.userId = resolvedUserId;
        newComment.userEmail = email;
        newComment.username = constructedUsername;
        newComment.profilePicture = resolvedProfilePicture ?? null;

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
          for (const file of files) {
            const fileUrl = await uploadAttachmentToAzure(file, resolvedUserId);
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
            attachment.createdBy = email;
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
            ticket.updatedBy = email;
            ticket.updatedAt = new Date();
            await transactionalEntityManager.save(Ticket, ticket);
          }
        } else if (data.postType === PostType.TSK) {
          const task = await transactionalEntityManager.findOne(Task, {
            where: { id: data.postId },
          });
          if (task) {
            task.updatedBy = email;
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
    authUser: AuthenticatedUserPayload,
  ): Promise<Comment | null> {
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

  async findOne(id: number): Promise<Comment> {
    const comment = await this.entityManager.findOne(Comment, {
      where: { id },
      relations: ['parentComment', 'childComments', 'commentAttachments'],
    });

    if (!comment) {
      throw new HttpException('Comment not found', HttpStatus.NOT_FOUND);
    }

    return comment;
  }

  async findAll(): Promise<Comment[]> {
    return await this.entityManager.find(Comment, {
      relations: ['parentComment', 'childComments', 'commentAttachments'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByPost(
    postId: number,
    postType: PostType | string,
  ): Promise<CommentTreeNode[]> {
    // First, get all comments for this post
    const allComments = await this.entityManager.find(Comment, {
      where: { postId, postType: postType as PostType },
      relations: ['commentAttachments'],
      order: { createdAt: 'DESC' },
    });

    // Build a tree structure manually
    const commentMap = new Map<number, CommentTreeNode>();
    const topLevelComments: CommentTreeNode[] = [];

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
      if (!commentWithChildren) return;

      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.childComments.push(commentWithChildren);
        }
      } else {
        topLevelComments.push(commentWithChildren);
      }
    });

    return topLevelComments;
  }

  async findByParent(parentId: number): Promise<Comment[]> {
    return await this.entityManager.find(Comment, {
      where: { parentId },
      relations: ['childComments', 'commentAttachments'],
      order: { createdAt: 'DESC' },
    });
  }

  async delete(
    id: number,
    authUser: AuthenticatedUserPayload,
  ): Promise<{ message: string; id: number }> {
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

  @OnEvent(USER_PROFILE_UPDATED_EVENT, { async: true })
  async handleUserProfileUpdated(
    payload: UserProfileUpdatedEventPayload,
  ): Promise<void> {
    try {
      const username =
        `${payload.firstName ?? ''} ${payload.lastName ?? ''}`.trim();

      const updateFields: Partial<Pick<Comment, 'username' | 'profilePicture'>> =
        {};

      if (username) {
        updateFields.username = username;
      }
      if (payload.profilePicture !== undefined) {
        updateFields.profilePicture = payload.profilePicture;
      }

      if (Object.keys(updateFields).length === 0) {
        return;
      }

      await this.entityManager
        .createQueryBuilder()
        .update(Comment)
        .set(updateFields)
        .where('"userId" = :userId', { userId: payload.userId })
        .execute();
    } catch (error) {
      this.logger.error(
        `Failed to sync user profile update to comments for userId=${payload.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
