import * as XLSX from 'xlsx';
import { TripConfiguration, PaxCalculation, HistoricalTrip } from './types';
import { STATUS_LABELS } from './constants';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function exportTripSummary(config: TripConfiguration, calculations: PaxCalculation[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Gross Margin Summary
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

  // Sheet 2: Revenue Breakdown
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
  XLSX.utils.book_append_sheet(wb, ws2, 'Revenue Breakdown');

  // Sheet 3: Cost Breakdown
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
