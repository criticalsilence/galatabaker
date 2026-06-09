/**
 * GalataBaker API — Auth REST controller.
 *
 * Endpoints:
 *   GET  /api/auth/challenge — yeni SIWW challenge al
 *   POST /api/auth/verify    — signature doğrula, JWT al
 *
 * Public — guard yok, rate limit global.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';

import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

import { AuthService } from './auth.service.js';
import type { Challenge, SIWWResult } from './auth.types.js';
import { ChallengeService } from './challenge.service.js';
import { siwwInputSchema, type SiwwInputDto } from './dto/siww-input.dto.js';

@Controller('auth')
@UsePipes(new ZodValidationPipe())
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly challenges: ChallengeService,
  ) {}

  @Get('challenge')
  @HttpCode(HttpStatus.OK)
  issueChallenge(): Challenge {
    return this.challenges.create();
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body(new ZodValidationPipe(siwwInputSchema)) body: SiwwInputDto,
  ): Promise<SIWWResult> {
    return this.auth.verifyAndConnect(body);
  }
}
