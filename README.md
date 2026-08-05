# Alpenglow Pricing Tool

A Next.js application for calculating and managing trip pricing for Alpenglow Expeditions.

## Features

- **Real-time pricing calculations** across different group sizes (4-16 pax)
- **Comprehensive cost modeling** including hotels, meals, staff, transport, and trip-specific expenses
- **Revenue analysis** with early bird discounts, loyalty discounts, and single supplements
- **Interactive charts** showing revenue vs costs and margin trends
- **Historical trip data** for comparison and analysis
- **Supabase integration** for persistent data storage (optional)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Navigate to the project directory:
   ```bash
   cd alpenglow-pricing
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Supabase Setup (Optional)

The app works in local mode without Supabase, but to enable persistent storage:

1. Create a free account at [supabase.com](https://supabase.com)

2. Create a new project

3. Go to the SQL Editor and run the contents of `supabase/schema.sql`

4. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

5. Add your Supabase credentials to `.env.local`:
   - Find your project URL and anon key in Project Settings > API
   - Update the values in `.env.local`

6. Restart the development server

## Usage

### Summary Tab
View pricing breakdowns across different group sizes:
- Revenue and cost totals
- Gross profit and margin calculations
- Visual charts for revenue vs costs and margin trends

### Inputs Tab
Configure all trip parameters:
- Core trip settings (price, duration)
- Discount structures (early bird, loyalty)
- Pre/post trip extensions
- Hotels and meals costs
- Staff configuration
- Transport costs
- Trip-specific expenses (permits, equipment, etc.)

### History Tab
View and filter historical trip performance:
- Filter by trip category
- Summary statistics
- Margin comparison charts

## Project Structure

```
alpenglow-pricing/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Main page
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── PricingTool.tsx     # Main container
│   │   ├── Header.tsx          # Header with controls
│   │   ├── Tabs.tsx            # Tab navigation
│   │   ├── SummaryTab.tsx      # Summary view
│   │   ├── InputsTab.tsx       # Configuration inputs
│   │   ├── HistoryTab.tsx      # Historical data
│   │   ├── TripSelector.tsx    # Trip dropdown
│   │   └── charts/             # Chart components
│   ├── lib/                    # Utilities
│   │   ├── supabase.ts         # Supabase client
│   │   ├── calculations.ts     # Pricing logic
│   │   ├── types.ts            # TypeScript types
│   │   └── constants.ts        # Default values
│   └── hooks/                  # React hooks
│       ├── useTripData.ts      # Trip data management
│       └── useHistoricalData.ts # Historical data
├── supabase/
│   └── schema.sql              # Database schema
├── package.json
└── README.md
```

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Supabase** - Database and authentication (optional)

## License

Private - Alpenglow Expeditions

<!-- deploy: GM Review sticky header redesign -->
