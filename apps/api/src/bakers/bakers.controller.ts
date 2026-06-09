/**
 * GalataBaker API — Bakers REST controller.
 *
 * Endpoints:
 *   GET /api/bakers?limit&sort&order
 *   GET /api/bakers/:pkh
 *
 * Validasyon:
 *   - Query: zod ile (limit 1-100, sort enum, order enum)
 *   - Pkh: zod ile (tz1|tz2|tz3|tz4 prefix + 36 char total)
 *
 * Yanıt formatı: ListBakersResult / BakerListItem (BigInt -> string)
 */

import { Controller, Get, Param, Query, UsePipes } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

import { BakersService, type ListBakersResult, type BakerListItem } from './bakers.service.js';

// Tezos PKH format: tz1/tz2/tz3/tz4 prefix + 33 base58 karakter = 36 toplam
const PKH_REGEX = /^tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}$/;

const pkhParamSchema = z.object({
  pkh: z
    .string()
    .regex(PKH_REGEX, 'Invalid Tezos address format (expected tz1/tz2/tz3/tz4 + 36 chars)'),
});

// limit: sadece "sayı mı?" kontrolü. Clamp (1-100) service katmanında
// yapılıyor — kullanıcı limit=0 gönderirse service "1"'e çekiyor, 400
// dönmek yerine. Bu sayede kötü input bile API'yi kıramaz.
const listQuerySchema = z.object({
  limit: z.coerce.number().int().nonnegative().optional().default(20),
  sort: z.enum(['totalStake', 'fee', 'blocksBaked']).optional().default('totalStake'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

@Controller('bakers') // main.ts `api` prefix'i ekliyor -> /api/bakers
@UsePipes(new ZodValidationPipe())
export class BakersController {
  constructor(private readonly bakers: BakersService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>,
  ): Promise<ListBakersResult> {
    return this.bakers.list(query);
  }

  @Get(':pkh')
  async getByPkh(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
  ): Promise<BakerListItem> {
    return this.bakers.getByPkh(params.pkh);
  }
}
