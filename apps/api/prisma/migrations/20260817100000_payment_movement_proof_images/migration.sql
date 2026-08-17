-- Garage receipt / transfer screenshots (ArchiveItem[]) on each cash movement.
ALTER TABLE "PaymentMovement" ADD COLUMN "proofImages" JSONB NOT NULL DEFAULT '[]';
