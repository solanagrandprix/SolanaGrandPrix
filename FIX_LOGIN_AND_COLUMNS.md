# Fix Login and Missing Columns

## Steps to Fix

1. **Stop your server** (press `Ctrl+C` in the terminal where it's running)

2. **Add missing columns to database** - Run this PowerShell command:
   ```powershell
   node add-iracing-columns.js
   ```
   
   If that doesn't work, try using Prisma Studio to manually add columns, or use a SQLite GUI tool.

3. **Regenerate Prisma client**:
   ```powershell
   npx prisma generate
   ```

4. **Restart your server**:
   ```powershell
   node server.js
   ```

## Alternative: Manual SQL Fix

If the script doesn't work, you can manually add columns using any SQLite tool:

```sql
ALTER TABLE Driver ADD COLUMN iracing TEXT;
ALTER TABLE Driver ADD COLUMN solanaWallet TEXT;
ALTER TABLE Driver ADD COLUMN cardCustomization TEXT;
```

These columns are already defined in your Prisma schema, so they need to exist in the database.

## What Was Fixed

- Removed `email` field references from all queries (email verification disabled)
- Updated all Driver queries to use explicit `select` instead of loading all fields
- Removed `iracing` and `solanaWallet` from login query select (they may not exist yet)

The server code has been updated to handle missing columns gracefully, but the columns need to be added to the database for everything to work properly.
