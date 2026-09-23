import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
  Request,
  Res,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { jwtConstants } from './constants';
import { LocalAuthGuard } from './local.auth.guard';
import { Public } from './public.decorator';
import type { Request as ExpressRequest, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.gurard';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private jwtService: JwtService,
  ) {}

  // @Post('refresh')
  // async refreshToken(@Body('refreshToken') refreshToken: string) {
  //   const user = this.validateRefreshToken(refreshToken);
  //   return this.authService.refreshToken(user);
  // }

  // private validateRefreshToken(token: string) {
  //   try {
  //     return this.authService.verifyToken(token, jwtConstants.refresh_secret);
  //   } catch (error) {
  //     throw new UnauthorizedException('Invalid refresh token');
  //   }
  // }

  @Public()
  @Post('refresh')
  async refreshTokens(@Req() req: ExpressRequest) {
    const { refreshToken } = req.cookies || {};

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found in cookies');
    }

    return this.authService.refreshTokens(refreshToken);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {

    const loginResult = await this.authService.login(req.user);

    res.cookie('refreshToken', loginResult.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.send({
      message: 'Logged in',
      access_token: loginResult.access_token,
      return_user: loginResult.return_user,
    });
  }

  // @Post('logout')
  // async logout(@Res() res: Response, @Req() req: Request) {
  //   // Clear cookies
  //   res.clearCookie('refreshToken');
  //   return res.send({ message: 'Logged out' });
  // }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    const userId = req.user.userId;

    // Invalidate refresh token in DB
    await this.authService.updateRefreshToken(userId, undefined);

    // Clear refreshToken cookie with correct path
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      path: '/', // Must match the path used when setting the cookie
    });

    return { message: 'Logged out' };
  }

  @Public()
  @Post('refresh-token')
  async refresh(@Req() req, @Res() res: Response) {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).send({ message: 'No refresh token provided' });
      }

      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || jwtConstants.refresh_secret,
      });

      const { access_token, refresh_token: newRefreshToken } =
        await this.authService.login({ ...payload, id: payload.userId });

      // Set new cookies
      res.cookie('accessToken', access_token, {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.send({
        message: 'Token refreshed',
        access_token,
        accessToken: access_token, // Support both naming conventions
      });
    } catch (error) {
      return res.status(401).send({ message: 'Unauthorized' });
    }
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}

