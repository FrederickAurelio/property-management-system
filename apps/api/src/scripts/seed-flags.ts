/** Treat `1` / `true` / `yes` as on. Empty, `0`, `false` → off. */
export function isEnvFlagOn(raw: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes((raw ?? '').trim().toLowerCase());
}
