/**
 * GalataBaker API — Rewards REST controller.
 *
 * Endpoints:
 *   GET  /api/rewards/:walletPkh?cycle=&kind=&limit=&offset=
 *        — kullanıcının ödül listesi + aggregations
 *   POST /api/rewards/claim
 *        — claim tx imzalandıktan sonra opsHash + claimedOpsHash callback
 *
 * Validasyon: zod (DTO) — service katmanı zod'a güvenmiyor.
 *
 * Güvenlik notları:
 *   - GET :walletPkh — pkh format validate (anonim user da reward
 *     sorgulayabilsin, register zorunluluğu yok — DB'de user yoksa boş döner)
 *   - POST /claim — internal endpoint (MVP'de API key guard yok, Adım 8
 *     hardening'a kalsın)
 *
 * Not: 'rewards' resource'unda ':walletPkh' path param conflict etmesin
 * diye POST'u '/rewards/claim' altına koyduk (ayrı POST resource).
 */

import { Body, Controller, Get, Param, Post, Query, UsePipes } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

import { PKH_REGEX, claimRewardSchema, listRewardsQuerySchema } from './dto/list-rewards.dto.js';
import { RewardsService, type ListRewardsResult, type RewardItem } from './rewards.service.js';

const pkhParamSchema = z.object({
  walletPkh: z
    .string()
    .regex(PKH_REGEX, 'Invalid Tezos address format (expected tz1/tz2/tz3/tz4 + 36 chars)'),
});

@Controller('rewards')
@UsePipes(new ZodValidationPipe())
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get(':walletPkh')
  async listByWallet(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    @Query(new ZodValidationPipe(listRewardsQuerySchema))
    query: z.infer<typeof listRewardsQuerySchema>,
  ): Promise<ListRewardsResult> {
    return this.rewards.listByWallet(params.walletPkh, query);
  }

  @Post('claim')
  async claim(
    @Body(new ZodValidationPipe(claimRewardSchema))
    body: z.infer<typeof claimRewardSchema>,
  ): Promise<RewardItem> {
    return this.rewards.claim(body.opsHash, body.claimedOpsHash);
  }
}
