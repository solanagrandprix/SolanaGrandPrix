# Fix "Read-only file system" Error

## Error Message
```
Error: Schema engine error:
Creating SQLite database parent directory.
Read-only file system (os error 30)
```

## What This Means
Prisma is trying to create the database file, but the directory is read-only or you don't have write permissions.

## Solutions

### Solution 1: Check DATABASE_URL Location

Your `.env` file might be pointing to a read-only location. Check:

```bash
cat .env | grep DATABASE_URL
# Or on Windows PowerShell:
Select-String -Path .env -Pattern "DATABASE_URL"
```

**Common Issues:**
- Database path points to `/var/` or `/usr/` (system directories - usually read-only)
- Database path points to a directory that doesn't exist
- Database path points to a protected directory

### Solution 2: Use a Writable Directory

Change your `DATABASE_URL` in `.env` to point to a writable directory:

**On Linux/Production Server:**
```env
# Option 1: In your project directory (recommended)
DATABASE_URL="file:./prisma/production.db"

# Option 2: In your home directory
DATABASE_URL="file:/home/yourusername/solanagp.db"

# Option 3: In /tmp (temporary, will be lost on reboot)
DATABASE_URL="file:/tmp/solanagp.db"
```

**On Windows (if that's your production):**
```env
DATABASE_URL="file:./prisma/production.db"
# Or full path:
DATABASE_URL="file:C:/path/to/your/project/prisma/production.db"
```

### Solution 3: Fix Directory Permissions

If you need to use a specific directory, make it writable:

```bash
# Create the directory if it doesn't exist
mkdir -p prisma/

# Set proper permissions (Linux/Mac)
chmod 755 prisma/
chmod 644 prisma/production.db  # if file exists

# Change ownership (if using a web server user)
chown -R www-data:www-data prisma/  # Adjust user:group as needed
# Or for Node.js user:
chown -R node:node prisma/
```

**On Windows:**
- Right-click the `prisma` folder
- Properties → Security → Edit
- Add your user with "Full control"

### Solution 4: Run as Correct User

Make sure you're running the migration command as a user that has write permissions:

```bash
# Check current user
whoami

# If using a service (like systemd or PM2), check which user it runs as
# You may need to run migrations as that user
```

If your Node.js server runs as user `www-data`, run migrations as that user:
```bash
sudo -u www-data npx prisma migrate deploy
```

### Solution 5: Check Disk Space

Sometimes "read-only" errors can occur if the disk is full:

```bash
df -h
# Check if your disk has space available
```

## Quick Fix Steps

### Step 1: Update .env File
Edit your `.env` file on the production server:

```env
DATABASE_URL="file:./prisma/production.db"
NODE_ENV="production"
PORT=3000
```

**Important:** Use a relative path (`./prisma/production.db`) so it's relative to your project directory.

### Step 2: Ensure Directory Exists
```bash
cd /path/to/your/project
mkdir -p prisma/
```

### Step 3: Check and Fix Permissions
```bash
# Make sure the directory is writable
chmod 755 prisma/

# If using a web server, set ownership
# Replace 'www-data' with your actual web server user
chown www-data:www-data prisma/ -R
```

### Step 4: Try Migration Again
```bash
npx prisma generate
npx prisma migrate deploy
```

### Step 5: Verify
```bash
ls -la prisma/
# You should see production.db and production.db-journal files
```

## If Still Not Working

### Check Current Database Path
```bash
# See what path Prisma is trying to use
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
```

### Use Absolute Path (if needed)
If relative paths don't work, use an absolute path to a writable location:

```env
DATABASE_URL="file:/home/yourusername/solanagp/prisma/production.db"
```

Then ensure that full path is writable:
```bash
mkdir -p /home/yourusername/solanagp/prisma
chmod 755 /home/yourusername/solanagp/prisma
```

### Check File System Type
Some mounted file systems might be read-only:
```bash
mount | grep your-disk
# Check if anything is mounted read-only
```

## Production Best Practices

1. **Use relative path in project directory:**
   ```env
   DATABASE_URL="file:./prisma/production.db"
   ```

2. **Ensure project directory is writable:**
   ```bash
   chmod 755 /path/to/your/project
   chmod 755 /path/to/your/project/prisma
   ```

3. **Set proper ownership:**
   ```bash
   chown -R youruser:youruser /path/to/your/project
   # Or if using a service account:
   chown -R www-data:www-data /path/to/your/project
   ```

4. **Create .gitkeep to preserve directory:**
   ```bash
   touch prisma/.gitkeep
   # Add to .gitignore: prisma/*.db but keep prisma/.gitkeep
   ```

## Common Production Server Locations

**Good locations for database:**
- `/home/username/project/prisma/` ✅
- `/var/www/project/prisma/` ✅ (if permissions set correctly)
- `./prisma/` ✅ (relative to project)

**Bad locations:**
- `/usr/` ❌ (system directory, usually read-only)
- `/etc/` ❌ (system directory, usually read-only)
- `/root/` ❌ (may have permission issues)
