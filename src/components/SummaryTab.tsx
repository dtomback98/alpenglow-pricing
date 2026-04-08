'use client';

import { useState } from 'react';
import { TripConfiguration } from '@/lib/types';
import { calculateAllPax, formatCurrency, formatPercent, getMarginColor, getProfitColor } from '@/lib/calculations';
import { exportTripSummary } from '@/lib/excelExport';
import RevenueVsCostsChart from './charts/RevenueVsCostsChart';
import MarginChart from './charts/MarginChart';

interface SummaryTabProps {
  config: TripConfiguration;
  updateConfig: (updates: Partial<TripConfiguration>) => void;
  isNewTrip?: boolean;
  onNotesBlur?: (notes: string) => void;
}

export default function SummaryTab({ config, updateConfig, isNewTrip, onNotesBlur }: SummaryTabProps) {
  const [grossMarginPerPax, setGrossMarginPerPax] = useState(false);
  const [revenuePerPax, setRevenuePerPax] = useState(false);
  const [costsPerPax, setCostsPerPax] = useState(false);

  const calculations = calculateAllPax(config);

  if (calculations.length === 0) {
    return <div className="card text-center text-ag-text-muted py-8">No calculations to display. Check that Min Pax is less than Max Pax.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top bar — startup hint (new trips) + Export button */}
      <div className="flex items-center justify-between gap-4">
        {isNewTrip ? (
          <div className="flex-1 card border border-ag-border text-sm text-ag-text-muted text-center py-4">
            Load an existing trip from the <strong className="text-ag-text">History</strong> tab, or fill in the inputs above to build a new one — then hit <strong className="text-ag-text">Save to History</strong> to save it.
          </div>
        ) : <div />}
        <button
          onClick={() => exportTripSummary(config, calculations)}
          className="btn btn-secondary text-sm shrink-0"
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
            <div className="card border-l-4 border-ag-accent">
              <div className="text-sm text-ag-text-muted mb-1">
                {(config.tripPriceMode === 'total' || config.tripPriceByPax) ? `Price per Pax (${bestCalc.pax} pax)` : 'Base Price per Pax'}
              </div>
              <div className="text-2xl font-bold text-ag-text">
                {formatCurrency(bestCalc.pax > 0 ? bestCalc.baseRevenue / bestCalc.pax : config.tripPrice)}
              </div>
            </div>
            <div className="card border-l-4 border-ag-accent">
              <div className="text-sm text-ag-text-muted mb-1">Trip Duration</div>
              <div className="text-2xl font-bold text-ag-text">
                {config.tripDays} days
              </div>
              <div className="text-sm text-ag-text-muted">
                {config.tripNights} nights
              </div>
            </div>
            <div className="card border-l-4 border-ag-accent">
              <div className="text-sm text-ag-text-muted mb-1">Best Margin ({bestCalc.pax} pax)</div>
              <div className={`text-2xl font-bold ${getMarginColor(bestCalc.margin)}`}>
                {formatPercent(bestCalc.margin)}
              </div>
              <div className="text-sm text-ag-text-muted">
                Profit: {formatCurrency(bestCalc.grossProfit)}
              </div>
            </div>
            <div className="card border-l-4 border-ag-accent">
              <div className="text-sm text-ag-text-muted mb-1">Break-even Point</div>
              <div className="text-2xl font-bold text-ag-warning">
                {(() => { const bp = calculations.find(c => c.grossProfit > 0)?.pax; return bp ? `${bp} pax` : 'N/A'; })()}
              </div>
              <div className="text-sm text-ag-text-muted">
                Minimum for profit
              </div>
            </div>
            <div className="card border-l-4 border-ag-accent">
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

      {/* Trip Notes */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Trip Notes</h2>
        <textarea
          value={config.notes || ''}
          onChange={(e) => updateConfig({ notes: e.target.value })}
          onBlur={(e) => onNotesBlur?.(e.target.value)}
          className="w-full text-sm resize-y"
          rows={3}
          placeholder="Add notes for this trip..."
        />
        <p className="text-xs text-ag-text-muted mt-2">Notes are saved with the trip config and copied to a history entry when you Save to History. Edits made directly on the History tab only update that entry — they do not sync back here.</p>
      </div>

      {/* Core vs Extension vs Combined Margins */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Gross Margin Summary</h2>
          <button onClick={() => setGrossMarginPerPax(!grossMarginPerPax)} className={`btn text-xs ${grossMarginPerPax ? 'btn-primary' : 'btn-secondary'}`}>
            {grossMarginPerPax ? 'Per Pax' : 'Totals'}
          </button>
        </div>
        <table className="pricing-table history-table">
          <thead>
            <tr>
              <th>Pax</th>
              <th>Core Profit{grossMarginPerPax ? ' /pax' : ''}</th>
              <th>Core Margin</th>
              <th>Ext. Pax</th>
              <th>Ext. Profit{grossMarginPerPax ? ' /pax' : ''}</th>
              <th>Ext. Margin</th>
              <th>Combined Profit{grossMarginPerPax ? ' /pax' : ''}</th>
              <th>Combined Margin</th>
            </tr>
          </thead>
          <tbody>
            {calculations.map((calc) => {
              const coreRevenue = calc.totalRevenue - calc.extensionRevenue - calc.extensionSingleSuppRevenue + calc.extensionDiscountCost;
              const coreCosts = calc.totalCosts - calc.extensionTotalCost;
              const coreProfit = coreRevenue - coreCosts;
              const coreMargin = coreRevenue > 0 ? (coreProfit / coreRevenue) * 100 : 0;

              const extRevenue = calc.extensionRevenue + calc.extensionSingleSuppRevenue - calc.extensionDiscountCost;
              const extCosts = calc.extensionTotalCost;
              const extProfit = extRevenue - extCosts;
              const extMargin = extRevenue > 0 ? (extProfit / extRevenue) * 100 : 0;

              const d = grossMarginPerPax ? calc.pax : 1;
              const extPax = config.extension.enabled ? (config.extension.countByPax?.[calc.pax] ?? 0) : 0;
              return (
                <tr key={calc.pax}>
                  <td className="font-medium">{calc.pax}</td>
                  <td className={`whitespace-nowrap ${getProfitColor(coreProfit)}`}>{formatCurrency(coreProfit / d)}</td>
                  <td className={`whitespace-nowrap ${getMarginColor(coreMargin)}`}>{formatPercent(coreMargin)}</td>
                  <td className="text-center">{extPax}</td>
                  <td className={`whitespace-nowrap ${getProfitColor(extProfit)}`}>{formatCurrency(extProfit / d)}</td>
                  <td className={`whitespace-nowrap ${getMarginColor(extMargin)}`}>{formatPercent(extMargin)}</td>
                  <td className={`whitespace-nowrap font-bold ${getProfitColor(calc.grossProfit)}`}>{formatCurrency(calc.grossProfit / d)}</td>
                  <td className={`whitespace-nowrap font-bold ${getMarginColor(calc.margin)}`}>{formatPercent(calc.margin)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Revenue Breakdown by Pax */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Revenue Breakdown</h2>
          <button onClick={() => setRevenuePerPax(!revenuePerPax)} className={`btn text-xs ${revenuePerPax ? 'btn-primary' : 'btn-secondary'}`}>
            {revenuePerPax ? 'Per Pax' : 'Totals'}
          </button>
        </div>
        <table className="pricing-table history-table">
          <thead>
            <tr>
              <th>Pax</th>
              <th>Base Revenue{revenuePerPax ? ' /pax' : ''}</th>
              <th>Early Bird{revenuePerPax ? ' /pax' : ''}</th>
              <th>Loyalty{revenuePerPax ? ' /pax' : ''}</th>
              <th>Extension{revenuePerPax ? ' /pax' : ''}</th>
              <th>Ext. Single Supp.{revenuePerPax ? ' /pax' : ''}</th>
              <th>Ext. Discounts{revenuePerPax ? ' /pax' : ''}</th>
              <th>Single Supp.{revenuePerPax ? ' /pax' : ''}</th>
              <th>Total Revenue{revenuePerPax ? ' /pax' : ''}</th>
            </tr>
          </thead>
          <tbody>
            {calculations.map((calc) => {
              const d = revenuePerPax ? calc.pax : 1;
              return (
                <tr key={calc.pax}>
                  <td className="font-medium">{calc.pax}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.baseRevenue / d)}</td>
                  <td className="whitespace-nowrap text-ag-danger">-{formatCurrency(calc.earlyBirdCost / d)}</td>
                  <td className="whitespace-nowrap text-ag-danger">-{formatCurrency(calc.loyaltyCost / d)}</td>
                  <td className="whitespace-nowrap text-ag-success">+{formatCurrency(calc.extensionRevenue / d)}</td>
                  <td className="whitespace-nowrap text-ag-success">+{formatCurrency(calc.extensionSingleSuppRevenue / d)}</td>
                  <td className="whitespace-nowrap text-ag-danger">-{formatCurrency(calc.extensionDiscountCost / d)}</td>
                  <td className="whitespace-nowrap text-ag-success">+{formatCurrency(calc.singleSupplementRevenue / d)}</td>
                  <td className="whitespace-nowrap font-bold">{formatCurrency(calc.totalRevenue / d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cost Breakdown by Pax */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Cost Breakdown</h2>
          <button onClick={() => setCostsPerPax(!costsPerPax)} className={`btn text-xs ${costsPerPax ? 'btn-primary' : 'btn-secondary'}`}>
            {costsPerPax ? 'Per Pax' : 'Totals'}
          </button>
        </div>
        <table className="pricing-table history-table">
          <thead>
            <tr>
              <th>Pax</th>
              <th>Hotels{costsPerPax ? ' /pax' : ''}</th>
              <th>Meals{costsPerPax ? ' /pax' : ''}</th>
              <th>Staff{costsPerPax ? ' /pax' : ''}</th>
              <th>Guide Flights{costsPerPax ? ' /pax' : ''}</th>
              <th>Staff Meals{costsPerPax ? ' /pax' : ''}</th>
              <th>Transport{costsPerPax ? ' /pax' : ''}</th>
              <th>Logistics{costsPerPax ? ' /pax' : ''}</th>
              <th>Trip Specific{costsPerPax ? ' /pax' : ''}</th>
              <th>Single Room{costsPerPax ? ' /pax' : ''}</th>
              <th>Ext. Costs{costsPerPax ? ' /pax' : ''}</th>
              <th>Total Costs{costsPerPax ? ' /pax' : ''}</th>
            </tr>
          </thead>
          <tbody>
            {calculations.map((calc) => {
              const d = costsPerPax ? calc.pax : 1;
              return (
                <tr key={calc.pax}>
                  <td className="font-medium">{calc.pax}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.hotelsCost / d)}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.mealsCost / d)}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.staffCost / d)}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.guideFlightsCost / d)}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.staffMealsCost / d)}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.transportCost / d)}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.logisticsCost / d)}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.tripSpecificCost / d)}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc.singleRoomCost / d)}</td>
                  <td className="whitespace-nowrap">{formatCurrency((calc.extensionHotelsCost + calc.extensionMealsCost + calc.extensionStaffCost + calc.extensionLogisticsCost + calc.extensionSingleRoomCost) / d)}</td>
                  <td className="whitespace-nowrap font-bold text-ag-danger">{formatCurrency(calc.totalCosts / d)}</td>
                </tr>
              );
            })}
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
