import * as XLSX from 'xlsx';
import { TripConfiguration, PaxCalculation, HistoricalTrip, FinancialBreakdown } from './types';
import { STATUS_LABELS } from './constants';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Patch a formula cell into an existing sheet, preserving the cached value
function setFormula(ws: XLSX.WorkSheet, row: number, col: number, formula: string, cachedValue: number) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  ws[addr] = { v: cachedValue, f: formula, t: 'n' };
}

export function exportTripSummary(config: TripConfiguration, calculations: PaxCalculation[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Trip Info (name + notes)
  const infoData = [
    { 'Field': 'Trip Name', 'Value': config.name || '' },
    { 'Field': 'Notes', 'Value': config.notes || '' },
  ];
  const wsInfo = XLSX.utils.json_to_sheet(infoData);
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Trip Info');

  // Sheet 2: Gross Margin Summary
  const marginData = calculations.map((calc) => {
    const coreRevenue = calc.totalRevenue - calc.extensionRevenue - calc.extensionSingleSuppRevenue + calc.extensionDiscountCost;
    const coreCosts = calc.totalCosts - calc.extensionTotalCost;
    const coreProfit = coreRevenue - coreCosts;
    const coreMargin = coreRevenue > 0 ? (coreProfit / coreRevenue) * 100 : 0;
    const extRevenue = calc.extensionRevenue + calc.extensionSingleSuppRevenue - calc.extensionDiscountCost;
    const extCosts = calc.extensionTotalCost;
    const extProfit = extRevenue - extCosts;
    const extMargin = extRevenue > 0 ? (extProfit / extRevenue) * 100 : 0;

    return {
      'Pax': calc.pax,
      'Core Profit': round2(coreProfit),
      'Core Margin %': round2(coreMargin),
      'Extension Profit': round2(extProfit),
      'Extension Margin %': round2(extMargin),
      'Combined Profit': round2(calc.grossProfit),
      'Combined Margin %': round2(calc.margin),
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(marginData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Gross Margin Summary');

  // Sheet 3: Revenue Breakdown
  // Columns: A=Pax B=Base Revenue C=Early Bird D=Loyalty E=Single Supp F=Ext Revenue G=Ext Single Supp H=Ext Discounts I=Total Revenue
  // Discounts stored as negative values so Total Revenue = SUM(B:H)
  const revenueData = calculations.map((calc) => ({
    'Pax': calc.pax,
    'Base Revenue': round2(calc.baseRevenue),
    'Early Bird Discount': round2(-calc.earlyBirdCost),
    'Loyalty Discount': round2(-calc.loyaltyCost),
    'Single Supplement': round2(calc.singleSupplementRevenue),
    'Extension Revenue': round2(calc.extensionRevenue),
    'Ext. Single Supp.': round2(calc.extensionSingleSuppRevenue),
    'Ext. Discounts': round2(-calc.extensionDiscountCost),
    'Total Revenue': round2(calc.totalRevenue),
  }));
  const ws2 = XLSX.utils.json_to_sheet(revenueData);
  // Total Revenue (col I, index 8) = SUM(B:H) for each data row
  calculations.forEach((calc, i) => {
    const r = i + 2; // Excel row (1-indexed; row 1 is header)
    setFormula(ws2, i + 1, 8, `SUM(B${r}:H${r})`, round2(calc.totalRevenue));
  });
  XLSX.utils.book_append_sheet(wb, ws2, 'Revenue Breakdown');

  // Sheet 4: Cost Breakdown
  // Columns: A=Pax B=Hotels C=Meals D=Staff E=Guide Flights F=Staff Meals G=Transport H=Logistics
  //          I=Trip Specific J=Single Room K=Ext Hotels L=Ext Meals M=Ext Staff N=Ext Logistics O=Ext Room P=Total Costs
  const costData = calculations.map((calc) => ({
    'Pax': calc.pax,
    'Hotels': round2(calc.hotelsCost),
    'Meals': round2(calc.mealsCost),
    'Staff': round2(calc.staffCost),
    'Guide Flights': round2(calc.guideFlightsCost),
    'Staff Meals': round2(calc.staffMealsCost),
    'Transport': round2(calc.transportCost),
    'Logistics': round2(calc.logisticsCost),
    'Trip Specific': round2(calc.tripSpecificCost),
    'Single Room': round2(calc.singleRoomCost),
    'Ext. Hotels': round2(calc.extensionHotelsCost),
    'Ext. Meals': round2(calc.extensionMealsCost),
    'Ext. Staff': round2(calc.extensionStaffCost),
    'Ext. Logistics': round2(calc.extensionLogisticsCost),
    'Ext. Room': round2(calc.extensionSingleRoomCost),
    'Total Costs': round2(calc.totalCosts),
  }));
  const ws3 = XLSX.utils.json_to_sheet(costData);
  // Total Costs (col P, index 15) = SUM(B:O) for each data row
  calculations.forEach((calc, i) => {
    const r = i + 2;
    setFormula(ws3, i + 1, 15, `SUM(B${r}:O${r})`, round2(calc.totalCosts));
  });
  XLSX.utils.book_append_sheet(wb, ws3, 'Cost Breakdown');

  const safeName = (config.name || 'trip').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `${safeName}_summary.xlsx`);
}

export function exportHistoricalTrips(trips: HistoricalTrip[], yearLabel: string, categoryLabel: string, statusLabel?: string) {
  const wb = XLSX.utils.book_new();

  const data = trips.map((t) => ({
    'Trip': t.name,
    'Category': t.category,
    'Country': t.country || 'Other',
    'Year': t.year || 2025,
    'Status': STATUS_LABELS[t.status || 'budgeted'] || t.status || 'Budgeted',
    'Pax': t.pax,
    '$/Pax': round2(t.pricePerPax),
    'Revenue': round2(t.revenue),
    'Gross Profit': round2(t.grossProfit),
    'Margin %': round2(t.margin),
    'Notes': t.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Historical Trips');

  const statusPart = statusLabel ? `_${statusLabel}` : '';
  const fileName = `trip_history_${yearLabel}_${categoryLabel}${statusPart}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  XLSX.writeFile(wb, fileName);
}

export function exportFinancialsBreakdown(
  rows: { trip: HistoricalTrip; breakdown: FinancialBreakdown | null }[],
  label?: string
) {
  const wb = XLSX.utils.book_new();

  // Column layout (0-indexed):
  // A(0)=Trip  B(1)=Category  C(2)=Country  D(3)=Year  E(4)=Status  F(5)=Pax
  // G(6)=Revenue
  // H(7)=Travel & Logistics  I(8)=Guide Wages  J(9)=Trip Supplies
  // K(10)=Comm. Use & Licensing  L(11)=Trip Communications  M(12)=Other Costs
  // N(13)=Total Costs  [formula: =SUM(H:M)]
  // O(14)=Gross Profit  [formula: =G-N]
  // P(15)=Margin %  [formula: =IF(G<>0, O/G*100, 0)]
  // Q(16)=Notes

  const data = rows.map(({ trip, breakdown }) => ({
    'Trip': trip.name,
    'Category': trip.category || '',
    'Country': trip.country || 'Other',
    'Year': trip.year || new Date().getFullYear(),
    'Status': STATUS_LABELS[trip.status || 'budgeted'] || trip.status || 'Budgeted',
    'Pax': trip.pax,
    'Revenue': round2(trip.revenue),
    'Travel & Logistics': breakdown ? round2(breakdown.tripTravelLogistics) : 0,
    'Guide Wages': breakdown ? round2(breakdown.guideWages) : 0,
    'Trip Supplies': breakdown ? round2(breakdown.tripSupplies) : 0,
    'Comm. Use & Licensing': breakdown ? round2(breakdown.commercialLicensing) : 0,
    'Trip Communications': breakdown ? round2(breakdown.tripCommunications) : 0,
    'Other Costs': breakdown ? round2(breakdown.otherTripCosts) : 0,
    'Total Costs': breakdown ? round2(breakdown.total) : round2(trip.revenue - trip.grossProfit),
    'Gross Profit': round2(trip.grossProfit),
    'Margin %': round2(trip.margin),
    'Notes': trip.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // Patch in Excel formulas for the calculated columns (data starts at row 2)
  rows.forEach(({ trip, breakdown }, i) => {
    const r = i + 2; // Excel row number (row 1 = header)
    const rowIdx = i + 1; // 0-indexed sheet row (row 0 = header)

    // Total Costs = SUM of all 6 cost category columns (H through M)
    // For rows without breakdown, the individual cols are 0 so SUM still works correctly
    setFormula(ws, rowIdx, 13, `SUM(H${r}:M${r})`,
      breakdown ? round2(breakdown.total) : round2(trip.revenue - trip.grossProfit));

    // Gross Profit = Revenue - Total Costs
    setFormula(ws, rowIdx, 14, `G${r}-N${r}`, round2(trip.grossProfit));

    // Margin % = Gross Profit / Revenue × 100
    setFormula(ws, rowIdx, 15, `IF(G${r}<>0,O${r}/G${r}*100,0)`, round2(trip.margin));
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Cost Breakdown');

  const suffix = label ? `_${label}` : '';
  const fileName = `financials_breakdown${suffix}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  XLSX.writeFile(wb, fileName);
}
