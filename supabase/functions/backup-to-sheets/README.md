# Supabase Edge Function: backup-to-sheets

## Deployment Instructions

### Step 1: Copy Function Code

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ybhqhfcbyurxyunthnfy/functions)
2. Click "Create a new function"
3. Name it: `backup-to-sheets`
4. Copy the contents of `supabase/functions/backup-to-sheets/index.ts` into the editor
5. Click "Deploy function"

### Step 2: Set Environment Secret

1. In Supabase Dashboard, go to Project Settings → Edge Functions → Secrets
2. Add a new secret:
   - **Name**: `GOOGLE_CREDENTIALS`
   - **Value**: Copy the entire JSON from your `.env` file's `VITE_GOOGLE_CREDENTIALS` value

### Step 3: Test the Function

The function will be available at:
```
https://ybhqhfcbyurxyunthnfy.supabase.co/functions/v1/backup-to-sheets
```

You can test it with curl:
```bash
curl -X POST 'https://ybhqhfcbyurxyunthnfy.supabase.co/functions/v1/backup-to-sheets' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"data": [{"fullDate": "2026-01-23", "barco": 1000, "cueva": 2000}]}'
```

### Step 4: Verify

Check your Google Spreadsheet to see if the data was written:
https://docs.google.com/spreadsheets/d/1QsD9nzEXdgkRYOFj59xsBhCTiqoqPy-CaWYS0s3dtr4

## Function Details

- **Endpoint**: `/functions/v1/backup-to-sheets`
- **Method**: POST
- **Body**: `{ "data": [...registro diario rows...] }`
- **Response**: `{ "success": true, "message": "...", "rowCount": N }`

## Troubleshooting

If you get errors:
1. Check that `GOOGLE_CREDENTIALS` secret is set correctly
2. Verify the spreadsheet is shared with the service account email
3. Check Edge Function logs in Supabase Dashboard
