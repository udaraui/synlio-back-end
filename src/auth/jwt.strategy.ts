import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtConstants } from './constants';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration: false,
      // secretOrKey: jwtConstants.secret,
      // jwtFromRequest: ExtractJwt.fromExtractors([
      //   // First try to get token from authorization header (Bearer Token)
      //   // ExtractJwt.fromAuthHeaderAsBearerToken(),
      //   // If that doesn't work, try to extract from cookies
      //   (req: Request) => {
      //     //console.log('🟢 Extracting accessToken from cookies :', req.cookies['accessToken']);
      //     return req.cookies['accessToken'] || null; // Replace 'token' with the cookie name you use
      //   },
      // ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || '',
    });
  }

  async validate(payload: any) {
    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = {
      userId: payload.userId,
      username: payload.first_name + ' ' + payload.last_name,
      email: payload.email,
      privileges: payload.privileges ?? [],
    };

    return user;
  }
}
