import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { NotesService } from './notes.service';
import { CreateNoteDto, ShareNoteDto, UpdateNoteDto } from './dto/note.dto';

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /** Read x-selected-company header directly (AuthorizationGuard not used here) */
  private getAuthUser(req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const raw = req.headers?.['x-selected-company'];
    const parsed = raw ? parseInt(raw as string, 10) : NaN;
    const activeCompanyId = !isNaN(parsed) && parsed !== 0 ? parsed : null;
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ...req.user,
      activeCompanyId,
    };
  }

  @Post()
  createNote(@Body() dto: CreateNoteDto, @Request() req: any) {
    return this.notesService.createNote(dto, this.getAuthUser(req));
  }

  @Get('my')
  getMyNotes(@Request() req: any) {
    return this.notesService.getMyNotes(this.getAuthUser(req));
  }

  @Get('shared-with-me')
  getSharedWithMe(@Request() req: any) {
    return this.notesService.getSharedWithMe(this.getAuthUser(req));
  }

  @Patch(':id')
  updateNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNoteDto,
    @Request() req: any,
  ) {
    return this.notesService.updateNote(id, dto, this.getAuthUser(req));
  }

  @Delete(':id')
  deleteNote(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.notesService.deleteNote(id, this.getAuthUser(req));
  }

  @Post(':id/share')
  shareNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ShareNoteDto,
    @Request() req: any,
  ) {
    return this.notesService.shareNote(id, dto, this.getAuthUser(req));
  }

  @Get(':id/share')
  getShareList(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.notesService.getShareList(id, this.getAuthUser(req));
  }
}
