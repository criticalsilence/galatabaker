/**
 * GalataBaker API — Generic Zod validation pipe.
 *
 * Tek bir pipe ile query, params ve body validasyonu yapıyoruz.
 * DTO class'ları, class-validator, NestJS-zod wrapper gibi
 * ek katmanlar eklemiyoruz — KISS.
 *
 * Kullanım:
 *   @Get(':pkh')
 *   getByPkh(@Param('pkh', new ZodValidationPipe(pkhSchema)) pkh: string)
 *
 * Hata durumunda 400 + { error, details } döner. Zod issue'larını
 * olduğu gibi yansıtıyoruz — frontend hangi alanın neden geçersiz
 * olduğunu görsün.
 *
 * Güvenlik:
 *   - Ham error.message döndürmüyoruz (sensitive data sızıntısı riski)
 *   - Issue'lar sadece { path, message, code } formatında, sınırlı alan
 */

import {
  BadRequestException,
  type ArgumentMetadata,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema?: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    // Schema inject edilmediyse pass-through (no-op validation)
    if (!this.schema) {
      return value as T;
    }

    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        error: 'Validation failed',
        details: this.formatZodError(result.error),
      });
    }

    return result.data;
  }

  /**
   * Zod error'ı minimal ve güvenli formata çevir.
   * Sadece path + message + code — stack trace veya internal state sızdırma yok.
   */
  private formatZodError(error: ZodError): Array<{ path: string; message: string; code: string }> {
    return error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
      code: issue.code,
    }));
  }
}
