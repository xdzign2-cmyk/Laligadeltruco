# Architecture Documentation: Registro Diario & Data Persistence

## Overview
This document explains the current data persistence architecture for the **"Registro Diario"** (Daily Register) table in the Operative Dashboard (`Dashboard.tsx`).

The system uses a **Hybrid Persistence Model** that combines remote database aggregation with local manual overrides.

## Data Flow Diagram

```mermaid
graph TD
    A[User Opens Dashboard] --> B{Fetch Data}
    B --> C[Fetch 'registros_operativos' from Supabase]
    B --> D[Load 'fmx_op_master' from LocalStorage]
    C --> E[Aggregate Transactions by Date]
    E --> F[Calculate Daily Totals (Barco/Cueva)]
    D --> G[Identify Manual Overrides]
    F --> H[Merge Logic]
    G --> H
    H --> I[Final 'rows' State]
    I --> J[Render Table]
    
    K[User Edits Row] --> L[handleSaveOp]
    L --> M[Update Local State]
    L --> N[Save to LocalStorage ('fmx_op_master')]
    N --> O[NO Sync to Supabase (Current Limitation)]
```

## Detailed Explanation

### 1. Data Source: Supabase (`registros_operativos`)
The primary source of truth for the dashboard is the `registros_operativos` table in Supabase. This table contains individual transaction logs.
- The `syncData` function fetches these logs for the selected period.
- It aggregates them to calculate the total profit (`ganancia_calculada`) and table counts (`mesas`) for "Barco" and "Cueva" for each day.

### 2. Manual Overrides: LocalStorage (`fmx_op_master`)
When a user manually adds or edits a daily entry (Registro Diario) using the form, the system treats this as a "Manual Override".
- **Function:** `handleSaveOp`
- **Storage:** These manual edits are saved **exclusively** to the browser's `localStorage` under the key `fmx_op_master`.
- **Flag:** The row is marked with `isManual: true`.

### 3. Synchronization Logic (`syncData`)
The dashboard attempts to harmonize the calculated data from the DB with the user's manual inputs to prevent flickering:
1.  **Generate Dates:** Creates a list of dates for the selected period.
2.  **Apply Manual Overrides:** It checks `localStorage` for any saved overrides for each date. If found, it uses the local data *instead* of waiting for the DB.
3.  **Fetch & Aggregate:** It fetches real data from Supabase.
4.  **Merge Priority:**
    - If a row is marked as `isManual: true` (from LocalStorage), the system **ignores** the aggregated data from Supabase for that specific row and preserves the user's manual input.
    - If a row is *not* manual, it updates it with the calculated values from Supabase.

## Current Limitations (The "Saving" Issue)
The user reported issue ("I cant save the values after adding the new date register") stems from the fact that **manual entries are never pushed to the backend**.

- **Persistence:** Saved only in the current browser. If you clear cache, use Incognito, or switch computers, the manual entries will be lost.
- **Consistency:** Other users (e.g., Admins) will not see the manual entries created by the Operative user, because they are not synchronized to Supabase.
- **Aggregation vs. Manual:** Currently, the manual entry is a "display overlay". It does not create actual transaction records in the database.

## Proposed Resolution
To ensure data is "saved automatically and consistent", the architecture needs to be updated to:
1.  **Push Manual Entries to DB:** When `handleSaveOp` is called, it should upsert a record to a new table (e.g., `daily_overrides` or `registros_diarios`) in Supabase, in addition to LocalStorage.
2.  **Sync Manual Entries:** The `syncData` function should fetch these overrides from Supabase so all users see the same manual data.
