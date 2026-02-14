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

## Key Files
| File | Purpose |
|------|---------|
| `src/lib/types.ts` | All TypeScript interfaces (UiPreferences, TripConfiguration, HistoricalTrip, etc.) |
| `src/lib/calculations.ts` | `calculateForPax()` / `calculateAllPax()` — core pricing math |
| `src/lib/supabase.ts` | DB layer, row conversions, migrations, saveToHistory, deleteHistoricalTrip |
| `src/lib/constants.ts` | DEFAULT_CONFIG, CATEGORY_COLORS, CATEGORY_LABELS |
| `src/hooks/useTripData.ts` | Trip config CRUD, save-to-history, create/delete trips |
| `src/hooks/useHistoricalData.ts` | Historical trip data, category filter, delete, refresh |
| `src/components/PricingTool.tsx` | Main container, tab routing, history refresh coordination |
| `src/components/InputsTab.tsx` | Core trip inputs (discounts, single supplement, staff, hotels, transport, etc.) |
| `src/components/ExtensionTab.tsx` | Extension trip inputs (inherit/custom for rates, hotels, staff) |
| `src/components/SummaryTab.tsx` | Revenue/cost/margin tables, charts, Gross Margin Summary |
| `src/components/HistoryTab.tsx` | 2025/2026 history, year filter chart, load/delete for 2026 entries |
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

### Data Handling
- Default fallback values are `0` — not legacy values like `2`
- `DEFAULT_CONFIG` must be deep-cloned when used (via `JSON.parse(JSON.stringify(...))`) to prevent mutation
- `configToRow` writes `single_supplement_config` as authoritative; scalar `single_supplement` and `single_room_extra` columns kept for legacy migration only
- `rowToConfig` handles migration from old formats (flat staff arrays, old prePost config, etc.)
- `saveToHistory` always inserts new entries (no upsert) — users delete old ones manually
- `saveTripsToHistory` always saves the trip config first to ensure calculations use latest inputs
- Year is set dynamically via `new Date().getFullYear()`, not hardcoded

### History Tab
- 2026 entries have Load and Delete buttons; 2025 entries are read-only reference data
- Year filter dropdown on Margin by Trip chart (All / 2025 / 2026)
- History tab auto-refreshes after Save to History via `refreshKey` prop from PricingTool
- When Supabase is configured, always uses Supabase data (no fallback to local JSON)

### Build & Deploy
- Always run `npx next build` before pushing to catch TypeScript errors
- Git author: dt@milkywaypark.com
- Branch `main` triggers Vercel auto-deploy (not `master`)

## Known Fixed Bugs (for reference)
- DEFAULT_CONFIG was shared by reference — now deep-cloned on every use
- SummaryTab crashed on empty calculations (paxMin > paxMax) — now shows message
- Extension staff pax selector was hidden in simple mode — now always visible
- historyPax state went stale when switching trips — now resets on pax range change
- History entries overwrote each other (upsert by trip_config_id) — now always inserts
- Loading a deleted trip silently failed — now shows error message
- Vercel was watching `master` branch but repo used `main` — renamed to `main`
- Supabase anon key with invisible characters caused "Invalid Header" errors — re-pasted cleanly
