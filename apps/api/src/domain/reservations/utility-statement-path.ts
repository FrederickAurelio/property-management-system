import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** xlsx zips are never tiny — skip empty nest-cli / watch placeholders. */
const MIN_TEMPLATE_BYTES = 100;

function isReadableTemplate(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }
  try {
    return statSync(path).size >= MIN_TEMPLATE_BYTES;
  } catch {
    return false;
  }
}

/**
 * Virgin template. Prefer `dist/assets` (nest-cli / Docker runtime);
 * fall back to the package-root copy (jest / nest watch before copy).
 */
export function utilityStatementTemplatePath(): string {
  const candidates = [
    join(__dirname, '..', '..', 'assets', 'utility-statement.xlsx'),
    join(__dirname, '..', '..', '..', 'assets', 'utility-statement.xlsx'),
  ];
  for (const candidate of candidates) {
    if (isReadableTemplate(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `utility-statement.xlsx not found or empty (looked in ${candidates.join(', ')})`,
  );
}
