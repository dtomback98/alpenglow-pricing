'use client';

import { TripConfiguration } from '@/lib/types';
import { calculateAllPax, formatCurrency, formatPercent, getMarginColor, getProfitColor } from '@/lib/calculations';
import { exportTripSummary } from '@/lib/excelExport';
import RevenueVsCostsChart from './charts/RevenueVsCostsChart';
import MarginChart from './charts/MarginChart';

interface SummaryTabProps {
  config: TripConfiguration;
}

export default function SummaryTab({ config }: SummaryTabProps) {
  const calculations = calculateAllPax(config);

  if (calculations.length === 0) {
    return <div className="card text-center text-ag-text-muted py-8">No calculations to display. Check that Min Pax is less than Max Pax.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={() => exportTripSummary(config, calculations)}
          className="btn btn-secondary text-sm"
        >
          Export to Excel
        </button>
      </div>

      {/* Key metrics cards */}
      {(() => {
        const bestCalc = calculations.reduce((best, curr) => curr.margin > best.margin ? curr : best);
        const revenuePerPaxPerDay = bestCalc.pax > 0 && config.tripDays > 0 ? bestCalc.totalRevenue / bestCalc.pax / config.tripDays : 0;
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="card">
              <div className="text-sm text-ag-text-muted mb-1">Base Price per Pax</div>
              <div className="text-2xl font-bold text-ag-text">
                {formatCurrency(config.tripPrice)}
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-ag-text-muted mb-1">Trip Duration</div>
              <div className="text-2xl font-bold text-ag-text">
                {config.tripDays} days
              </div>
              <div className="text-sm text-ag-text-muted">
                {config.tripNights} nights
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-ag-text-muted mb-1">Best Margin ({bestCalc.pax} pax)</div>
              <div className={`text-2xl font-bold ${getMarginColor(bestCalc.margin)}`}>
                {formatPercent(bestCalc.margin)}
              </div>
              <div className="text-sm text-ag-text-muted">
                Profit: {formatCurrency(bestCalc.grossProfit)}
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-ag-text-muted mb-1">Break-even Point</div>
              <div className="text-2xl font-bold text-ag-warning">
                {(() => { const bp = calculations.find(c => c.grossProfit > 0)?.pax; return bp ? `${bp} pax` : 'N/A'; })()}
              </div>
              <div className="text-sm text-ag-text-muted">
                Minimum for profit
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-ag-text-muted mb-1">Revenue/Pax/Day ({bestCalc.pax} pax)</div>
              <div className="text-2xl font-bold text-ag-text">
                {formatCurrency(revenuePerPaxPerDay)}
              </div>
              <div className="text-sm text-ag-text-muted">
                At best margin pax level
              </div>
            </div>
          </div>
        );
      })()}

      {/* Core vs Extension vs Combined Margins */}
      <div className="card overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Gross Margin Summary</h2>
        <table className="pricing-table">
          <thead>
            <tr>
              <th>Pax</th>
              <th>Core Profit</th>
              <th>Core Margin</th>
              <th>Extension Profit</th>
              <th>Extension Margin</th>
              <th>Combined Profit</th>
              <th>Combined Margin</th>
            </tr>
          </thead>
          <tbody>
            {calculations.map((calc) => {
              const coreRevenue = calc.totalRevenue - calc.extensionRevenue - calc.extensionSingleSuppRevenue;
              const coreCosts = calc.totalCosts - calc.extensionTotalCost;
              const coreProfit = coreRevenue - coreCosts;
              const coreMargin = coreRevenue > 0 ? (coreProfit / coreRevenue) * 100 : 0;

              const extRevenue = calc.extensionRevenue + calc.extensionSingleSuppRevenue;
              const extCosts = calc.extensionTotalCost;
              const extProfit = extRevenue - extCosts;
              const extMargin = extRevenue > 0 ? (extProfit / extRevenue) * 100 : 0;

              return (
                <tr key={calc.pax}>
                  <td className="font-medium">{calc.pax}</td>
                  <td className={getProfitColor(coreProfit)}>{formatCurrency(coreProfit)}</td>
                  <td className={getMarginColor(coreMargin)}>{formatPercent(coreMargin)}</td>
                  <td className={getProfitColor(extProfit)}>{formatCurrency(extProfit)}</td>
                  <td className={getMarginColor(extMargin)}>{formatPercent(extMargin)}</td>
                  <td className={`font-bold ${getProfitColor(calc.grossProfit)}`}>{formatCurrency(calc.grossProfit)}</td>
                  <td className={`font-bold ${getMarginColor(calc.margin)}`}>{formatPercent(calc.margin)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Revenue Breakdown by Pax */}
      <div className="card overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Revenue Breakdown</h2>
        <table className="pricing-table">
          <thead>
            <tr>
              <th>Pax</th>
              <th>Base Revenue</th>
              <th>Early Bird</th>
              <th>Loyalty</th>
              <th>Extension</th>
              <th>Ext. Single Supp.</th>
              <th>Single Supp.</th>
              <th>Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {calculations.map((calc) => (
              <tr key={calc.pax}>
                <td className="font-medium">{calc.pax}</td>
                <td>{formatCurrency(calc.baseRevenue)}</td>
                <td className="text-ag-danger">-{formatCurrency(calc.earlyBirdCost)}</td>
                <td className="text-ag-danger">-{formatCurrency(calc.loyaltyCost)}</td>
                <td className="text-ag-success">+{formatCurrency(calc.extensionRevenue)}</td>
                <td className="text-ag-success">+{formatCurrency(calc.extensionSingleSuppRevenue)}</td>
                <td className="text-ag-success">+{formatCurrency(calc.singleSupplementRevenue)}</td>
                <td className="font-bold">{formatCurrency(calc.totalRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cost Breakdown by Pax */}
      <div className="card overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Cost Breakdown</h2>
        <table className="pricing-table">
          <thead>
            <tr>
              <th>Pax</th>
              <th>Hotels</th>
              <th>Meals</th>
              <th>Staff</th>
              <th>Guide Flights</th>
              <th>Staff Meals</th>
              <th>Transport</th>
              <th>Logistics</th>
              <th>Trip Specific</th>
              <th>Extension</th>
              <th>Single Room</th>
              <th>Total Costs</th>
            </tr>
          </thead>
          <tbody>
            {calculations.map((calc) => (
              <tr key={calc.pax}>
                <td className="font-medium">{calc.pax}</td>
                <td>{formatCurrency(calc.hotelsCost)}</td>
                <td>{formatCurrency(calc.mealsCost)}</td>
                <td>{formatCurrency(calc.staffCost)}</td>
                <td>{formatCurrency(calc.guideFlightsCost)}</td>
                <td>{formatCurrency(calc.staffMealsCost)}</td>
                <td>{formatCurrency(calc.transportCost)}</td>
                <td>{formatCurrency(calc.logisticsCost)}</td>
                <td>{formatCurrency(calc.tripSpecificCost)}</td>
                <td>{formatCurrency(calc.extensionTotalCost)}</td>
                <td>{formatCurrency(calc.singleRoomCost)}</td>
                <td className="font-bold text-ag-danger">{formatCurrency(calc.totalCosts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Revenue vs Costs</h2>
          <RevenueVsCostsChart calculations={calculations} />
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Margin by Group Size</h2>
          <MarginChart calculations={calculations} />
        </div>
      </div>
    </div>
  );
}
