# Fix Migration Error

## Problem
The migration `20260104000000_add_driver_profile_fields` is failing because the columns already exist in your database.

## Solution

Since the columns (`preferredClasses`, `country`, `timezone`, `twitch`, `twitter`, `discord`, `driverNotes`) already exist in your database, you need to mark this migration as already applied.

### Step 1: Mark the migration as applied

Run this command:

```bash
npx prisma migrate resolve --applied 20260104000000_add_driver_profile_fields
```

This tells Prisma that the migration has already been applied to your database, even though it wasn't run through Prisma's migration system.

### Step 2: Continue with deployment

After marking it as applied, run:

```bash
npx prisma migrate deploy
```

This will apply any remaining migrations that haven't been applied yet.

### Step 3: Generate Prisma Client

```bash
npx prisma generate
```

## Why this happened

This typically happens when:
- Columns were added manually to the database
- A previous migration attempt partially succeeded
- The database was created/modified outside of Prisma migrations

## Verification

After fixing, verify everything is working:

```bash
npx prisma migrate status
```

This should show all migrations as applied.
