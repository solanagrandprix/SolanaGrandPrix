# Fix Database Migration Error on Production Server

## Error Message
```
Database migration required. Please run: npx prisma generate && npx prisma migrate deploy
```

## What This Means
Your production database schema doesn't match your Prisma schema. The migrations haven't been applied to the production database yet.

## Fix Steps (Run on Production Server)

### Step 1: Connect to Your Production Server
SSH into your server or access your production environment.

### Step 2: Navigate to Project Directory
```bash
cd /path/to/your/project
# Example: cd /var/www/solanagp
```

### Step 3: Install Dependencies (if needed)
```bash
npm install --production
```

### Step 4: Generate Prisma Client
```bash
npx prisma generate
```
This creates the Prisma client for your production environment.

### Step 5: Check Migration Status
```bash
npx prisma migrate status
```
This shows which migrations have been applied and which are pending.

### Step 6: Apply Migrations
```bash
npx prisma migrate deploy
```
This applies all pending migrations to your production database.

### Step 7: Verify Database Connection
```bash
# Test that everything works
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.user.findFirst().then(() => { console.log('✅ Database OK'); process.exit(0); }).catch(err => { console.error('❌ Error:', err.message); process.exit(1); });"
```

### Step 8: Restart Your Server
```bash
# If using PM2:
pm2 restart all

# If using systemd:
sudo systemctl restart your-service-name

# If using npm:
npm restart

# Or just restart your Node.js process
```

## Complete Production Deployment Command Sequence

Run these commands **on your production server** in order:

```bash
# 1. Go to project directory
cd /path/to/your/project

# 2. Pull latest code (if using git)
git pull origin main

# 3. Install dependencies
npm install --production

# 4. Generate Prisma client for production
npx prisma generate

# 5. Apply database migrations
npx prisma migrate deploy

# 6. Restart server
pm2 restart all
# OR: sudo systemctl restart your-service
# OR: npm restart
```

## Important Notes

### Database URL
Make sure your `.env` file on production has the correct `DATABASE_URL`:
```env
DATABASE_URL="file:./prisma/production.db"
# OR if using a different path:
DATABASE_URL="file:/var/www/solanagp/prisma/production.db"
```

### Environment Variables
Ensure your production `.env` file exists and has all required variables:
```env
DATABASE_URL="file:./prisma/production.db"
NODE_ENV="production"
PORT=3000
# ... other variables
```

### File Permissions
Make sure the server process can read/write the database file:
```bash
# If database file doesn't exist yet, Prisma will create it
# Ensure directory is writable:
chmod 755 prisma/
chown www-data:www-data prisma/  # Adjust user:group as needed
```

## Troubleshooting

### Error: "Migration already applied"
If you get conflicts:
```bash
npx prisma migrate resolve --applied 20260104000000_add_driver_profile_fields
npx prisma migrate deploy
```

### Error: "Failed to connect to database"
- Check `DATABASE_URL` in `.env`
- Verify database file path exists and is accessible
- Check file permissions

### Error: "Prisma Client not generated"
```bash
rm -rf node_modules/.prisma
npx prisma generate
```

### Still Getting Migration Error After Running Commands
1. Check server logs for the exact error
2. Verify migrations were applied: `npx prisma migrate status`
3. Verify Prisma client is generated: `ls node_modules/.prisma/client/`
4. Restart server after making changes

## Quick One-Liner Fix

If you have SSH access and just want to fix it quickly:

```bash
cd /path/to/project && npm install --production && npx prisma generate && npx prisma migrate deploy && pm2 restart all
```

Replace `/path/to/project` with your actual project path and `pm2 restart all` with your restart command.
