const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('C:', 'Users', 'tomba', 'Downloads', '2025.xlsx');
console.log('Reading:', filePath);

const wb = XLSX.readFile(filePath);
console.log('Sheet names:', wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Rows: ${data.length}`);
  data.slice(0, 20).forEach((row, i) => {
    if (row.length > 0) {
      console.log(i, JSON.stringify(row).slice(0, 200));
    }
  });
});
