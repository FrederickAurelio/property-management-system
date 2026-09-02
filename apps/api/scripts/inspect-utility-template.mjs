import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function inspect(file, label) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  console.log(`\n=== ${label} ===`);
  console.log('merges', ws.model.merges);
  for (let r = 1; r <= 45; r++) {
    const parts = [];
    for (const c of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']) {
      const cell = ws.getCell(`${c}${r}`);
      const v = cell.value;
      if (v != null && v !== '') {
        let s =
          typeof v === 'object' && v.richText
            ? v.richText.map((x) => x.text).join('')
            : String(v);
        parts.push(
          `${c}:${s.slice(0, 28)}|fmt:${cell.numFmt ?? '-'}|h:${cell.alignment?.horizontal ?? '-'}`,
        );
      }
    }
    if (parts.length) console.log(`R${r}`, parts.join(' | '));
  }
}

await inspect(path.join(root, 'assets/utility-statement.xlsx'), 'api virgin');
await inspect(path.join(root, '../pms/utilities-template.xlsx'), 'pms ref');
