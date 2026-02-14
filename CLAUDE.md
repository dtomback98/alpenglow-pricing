# Alpenglow Pricing Tool

Trip pricing calculator for Milky Way Park (MWP) adventure/expedition trips.

## Quick Start
```bash
npm run dev        # Start dev server at localhost:3000
npx next build     # Verify build passes before pushing
git push           # Auto-deploys to Vercel from main branch
```

## Deployment
- **Live URL**: https://alpenglow-pricing.vercel.app
- **GitHub**: dtomback98/alpenglow-pricing (branch: `main`)
- **Vercel**: Auto-deploys on push to `main`
- **Supabase**: https://xkzjuwzhtdkcuzdhdgnf.supabase.co
- **Vercel env vars**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Architecture
- **Framework**: Next.js 14, TypeScript, Tailwind CSS, Recharts
- **Database**: Supabase (PostgreSQL) with RLS policies
- **State**: `useTripData` hook manages all trip config state; `useHistoricalData` for history
- **Excel Export**: `xlsx` library for client-side Excel generation

## Key Files
| File | Purpose |
|------|---------|
| `src/lib/types.ts` | All TypeScript interfaces (UiPreferences, TripConfiguration, HistoricalTrip, PaxCalculation) |
| `src/lib/calculations.ts` | `calculateForPax()` / `calculateAllPax()` — core pricing math with clamping |
| `src/lib/supabase.ts` | DB layer, row conversions, migrations, saveToHistory, deleteHistoricalTrip |
| `src/lib/constants.ts` | DEFAULT_CONFIG, CATEGORY_COLORS, CATEGORY_LABELS |
| `src/lib/excelExport.ts` | Excel export functions for Summary and History tabs |
| `src/hooks/useTripData.ts` | Trip config CRUD, save-to-history, create/delete trips |
| `src/hooks/useHistoricalData.ts` | Historical trip data, category filter, delete, refresh |
| `src/components/PricingTool.tsx` | Main container, tab routing, history refresh coordination |
| `src/components/InputsTab.tsx` | Core trip inputs (discounts, single supplement, staff, hotels, transport, etc.) |
| `src/components/ExtensionTab.tsx` | Extension trip inputs (inherit/custom for rates, hotels, staff) |
| `src/components/SummaryTab.tsx` | Revenue/cost/margin tables, charts, Gross Margin Summary, Export button |
| `src/components/HistoryTab.tsx` | Historical performance, year/category filters, summary stats, Export button |
| `src/components/Header.tsx` | Trip selector, save, save-to-history modal with pax/category picker |

## Database Tables

### `trip_configurations`
Full trip configs with JSONB columns for nested data. Key columns:
- `hotels_meals`, `logistics`, `staff_config`, `transport_config`, `trip_specific` (JSONB)
- `single_supplement_config`, `extension_config` (JSONB — authoritative source for these sections)
- `early_bird_count_by_pax`, `loyalty_count_by_pax` (JSONB)
- `ui_preferences` (JSONB — stores simple/per-pax toggle state)
- `pax_min`, `pax_max`, `pax_step`

### `historical_trips`
Historical performance data:
- `year` (integer) — separates 2025 reference data from current year entries
- `trip_config_id` (UUID FK) — links back to trip_configurations for "Load" feature
- `trip_date` — set automatically on save
- `pax`, `price_per_pax`, `revenue`, `gross_profit`, `margin`, `category`, `notes`

## Conventions & Patterns

### UI State
- UI toggle state (per-pax vs simple) stored in `config.uiPreferences` and persisted to DB via `ui_preferences` JSONB column
- Extension sections use "Match Core Inputs" / "Custom" toggle to inherit or override main trip values
- Extension single supplement in "Match Core Inputs" mode inherits rates but has its own editable guest count
- `selectedStaffPax` resets via useEffect when `paxMin` changes (prevents stale tab selection on trip switch)

### Data Handling
- Default fallback values are `0` — not legacy values like `2`
- `DEFAULT_CONFIG` must be deep-cloned when used (via `JSON.parse(JSON.stringify(...))`) to prevent mutation — applies to createNewTrip, selectTrip(null), AND deleteTrip
- `configToRow` writes `single_supplement_config` as authoritative; scalar `single_supplement` and `single_room_extra` columns kept for legacy migration only
- `rowToConfig` handles migration from old formats (flat staff arrays, old prePost config, etc.) and deep-merges extension config with defaults
- `saveToHistory` always inserts new entries (no upsert) — users delete old ones manually
- `saveTripsToHistory` always saves the trip config first to ensure calculations use latest inputs
- Year is set dynamically via `new Date().getFullYear()`, not hardcoded
- Discount counts (earlyBird, loyalty) and single supplement counts are clamped to pax count in calculations
- `paxStep` is forced to integer >= 1 in all UI components and calculateAllPax (prevents fractional pax and infinite loops)

### Excel Export
- Summary tab: exports 3 sheets (Gross Margin, Revenue Breakdown, Cost Breakdown)
- History tab: exports filtered trips (respects both year AND category filters)
- Filenames sanitized for filesystem characters
- Uses `xlsx` library (in dependencies, not devDependencies)

### History Tab
- Current year entries have Load and Delete buttons; 2025 entries are read-only reference data
- Year filter dropdowns on both Summary Statistics and Margin by Trip chart
- Year handling is dynamic (`new Date().getFullYear()`) — not hardcoded to 2026
- History tab auto-refreshes after Save to History via `refreshKey` prop from PricingTool
- When Supabase is configured, always uses Supabase data (no fallback to local JSON)
- Delete has try/catch error handling for network failures

### Build & Deploy
- Always run `npx next build` before pushing to catch TypeScript errors
- Git author: dt@milkywaypark.com
- Branch `main` triggers Vercel auto-deploy (not `master`)
- Vercel may need manual redeploy sometimes — check dashboard if changes don't appear
- `update_2025_history.sql` in project root is a one-time migration script (already run, do not commit)

## Known Fixed Bugs (for reference)
- DEFAULT_CONFIG was shared by reference — now deep-cloned on every use (including deleteTrip)
- SummaryTab crashed on empty calculations (paxMin > paxMax) — now shows message
- Extension staff pax selector was hidden in simple mode — now always visible
- historyPax state went stale when switching trips — now resets on pax range change
- selectedStaffPax went stale on trip switch — now resets via useEffect
- History entries overwrote each other (upsert by trip_config_id) — now always inserts
- Loading a deleted trip silently failed — now shows error message
- Vercel was watching `master` branch but repo used `main` — renamed to `main`
- Supabase anon key with invisible characters caused "Invalid Header" errors — re-pasted cleanly
- Discount counts could exceed pax count causing negative revenue — now clamped
- Fractional paxStep caused infinite loops / nonsensical pax buttons — now forced to integer >= 1
- paxMax could be set below paxMin — now enforced in input
- Extension staff edit on empty pax entry created corrupted partial objects — now uses fallback data
- Double-click Save could create duplicate trips — now guarded with saving flag
- History delete had no error handling — now has try/catch
- Excel export ignored year filter — now uses year-filtered data
- Old extension configs missing new fields crashed ExtensionTab — now deep-merged with defaults
- Total Profit stat was always green — now red when negative
- Notes column was truncated — now wraps with inline styles
