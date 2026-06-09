/**
 * GalataBaker API — Delegations REST controller.
 *
 * Endpoints:
 *   POST /api/delegations                       — op broadcast sonrası kayıt
 *   GET  /api/delegations/:walletPkh            — kullanıcı delegation geçmişi
 *
 * Validasyon: zod (DTO) ile — service katmanı zod'a güvenmiyor (defense in depth).
 *
 * Yanıt formatı: DelegationItem / ListDelegationsResult (amount string).
 */

import { Body, Controller, Get, Param, Post, Query, UsePipes } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

import {
  DelegationsService,
  type DelegationItem,
  type ListDelegationsResult,
} from './delegations.service.js';
import {
  createDelegationSchema,
  listDelegationsQuerySchema,
  PKH_REGEX,
} from './dto/create-delegation.dto.js';

const pkhParamSchema = z.object({
  walletPkh: z
    .string()
    .regex(PKH_REGEX, 'Invalid Tezos address format (expected tz1/tz2/tz3/tz4 + 36 chars)'),
});

@Controller('delegations')
@UsePipes(new ZodValidationPipe())
export class DelegationsController {
  constructor(private readonly delegations: DelegationsService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createDelegationSchema))
    body: z.infer<typeof createDelegationSchema>,
  ): Promise<DelegationItem> {
    return this.delegations.create(body);
  }

  @Get(':walletPkh')
  async listByWallet(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    @Query(new ZodValidationPipe(listDelegationsQuerySchema))
    query: z.infer<typeof listDelegationsQuerySchema>,
  ): Promise<ListDelegationsResult> {
    return this.delegations.listByWallet(params.walletPkh, query);
  }
}
