import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { PAYMENT_MOVEMENT_PROOF_MAX } from '@cabin/api-contract';
import { ArchiveProofImageDto } from './archive-proof-image.dto.js';

/** PATCH /staff/reservations/:id/movements/:movementId/proofs — images only. */
export class PatchPaymentMovementProofsDto {
  @IsArray()
  @ArrayMaxSize(PAYMENT_MOVEMENT_PROOF_MAX)
  @ValidateNested({ each: true })
  @Type(() => ArchiveProofImageDto)
  proofImages!: ArchiveProofImageDto[];
}
