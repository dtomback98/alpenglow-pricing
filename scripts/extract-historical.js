const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join('C:', 'Users', 'tomba', 'Downloads', '2025.xlsx');
const wb = XLSX.readFile(filePath);
const sheet = wb.Sheets['Master'];
const data = XLSX.utils.sheet_to_json(sheet);

// Filter and transform the data
const historicalTrips = data
  .filter(row =>
    row['Category'] &&
    row['Gross Revenue'] &&
    row['PAX'] &&
    row['Gross Revenue'] > 0
  )
  .map((row, index) => ({
    id: String(index + 1),
    name: row['Column 1'] || 'Unknown',
    category: row['Category'],
    pax: Number(row['PAX']) || 0,
    pricePerPax: Number(row['Price/Pax']) || 0,
    revenue: Number(row['Gross Revenue']) || 0,
    grossProfit: Number(row['Gross Income']) || 0,
    margin: (Number(row['Gross margin']) || 0) * 100, // Convert to percentage
    notes: row['Notes'] || '',
  }));

console.log(`Extracted ${historicalTrips.length} trips`);

// Write to JSON file
const outputPath = path.join(__dirname, '..', 'src', 'lib', 'historical-data.json');
fs.writeFileSync(outputPath, JSON.stringify(historicalTrips, null, 2));
console.log(`Written to ${outputPath}`);

// Also show first few
console.log('\nFirst 5 trips:');
historicalTrips.slice(0, 5).forEach(t => console.log(t));
