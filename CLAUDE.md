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

## Architecture
- **Framework**: Next.js 14, TypeScript, Tailwind CSS, Recharts
- **Database**: Supabase (PostgreSQL) with RLS policies
- **State**: `useTripData` hook manages all trip config state; `useHistoricalData` for history

## Key Files
| File | Purpose |
|------|---------|
| `src/lib/types.ts` | All TypeScript interfaces |
| `src/lib/calculations.ts` | `calculateForPax()` — core pricing math |
| `src/lib/supabase.ts` | DB layer, row conversions, migrations |
| `src/lib/constants.ts` | DEFAULT_CONFIG, category colors/labels |
| `src/hooks/useTripData.ts` | Trip config CRUD, save-to-history |
| `src/hooks/useHistoricalData.ts` | Historical trip data + delete |
| `src/components/PricingTool.tsx` | Main container, tab routing |
| `src/components/InputsTab.tsx` | Core trip inputs (discounts, staff, hotels, etc.) |
| `src/components/ExtensionTab.tsx` | Extension trip inputs |
| `src/components/SummaryTab.tsx` | Revenue/cost/margin tables |
| `src/components/HistoryTab.tsx` | 2025/2026 history, charts, load/delete |
| `src/components/Header.tsx` | Trip selector, save, save-to-history modal |

## Conventions
- UI toggle state (per-pax vs simple) is stored in `config.uiPreferences` (in-memory only, not in DB)
- Extension sections use "Match Core Inputs" / "Custom" to inherit or override main trip values
- Default fallback values are `0` — not legacy values
- `configToRow` intentionally excludes `ui_preferences` (no DB column)
- Always run `npx next build` before pushing to catch TypeScript errors
- Git author: dt@milkywaypark.com
