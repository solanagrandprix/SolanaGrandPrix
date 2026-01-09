# Deployment Checklist - Update Live Website

This document lists all the files that have been modified and need to be deployed to your live server.

## 📦 Files Modified (Need to Upload)

### Backend Files
- ✅ `server.js` - Main server file with all API endpoints
  - Added featured driver functionality
  - Updated card customization endpoints
  - Enhanced security features

### Frontend Files
- ✅ `public/auth.html` - Unified login/signup page (removed check session)
- ✅ `public/card-builder.html` - Card builder with scrollable menu, larger preview, PNG/GIF export
- ✅ `public/driver.html` - Driver profile page (removed name from title, smaller card)
- ✅ `public/index.html` - Updated footer
- ✅ `public/leaderboard.html` - Updated footer
- ✅ `public/admin.html` - Added featured driver selection dropdown
- ✅ `public/home.html` - Updated to use featured driver from API, updated footer
- ✅ `public/account.html` - Updated footer
- ✅ `public/season.html` - Updated footer
- ✅ `public/layout.css` - Global styles (if modified)
- ✅ `public/card-customization.js` - Card customization utility (if modified)
- ✅ `public/global-user.js` - User management (if modified)

### Database Schema
- ✅ `prisma/schema.prisma` - Database schema (check if migrations needed)

## 🗄️ Database Migrations

If your live database doesn't have the latest schema, you may need to run migrations:

1. **Check if these fields exist in your live database:**
   - `Driver.cardCustomization` (String, nullable)
   - `User.isAdmin` (Boolean, default false)

2. **If missing, run migrations on your live server:**
   ```bash
   npx prisma migrate deploy
   # OR if using dev migrations:
   npx prisma migrate dev
   ```

3. **Regenerate Prisma Client:**
   ```bash
   npx prisma generate
   ```

## 🚀 Deployment Steps

### Option 1: Using Git (Recommended)
If your live server has git:

```bash
# On your local machine, commit changes
git add .
git commit -m "Update: Featured driver, card builder improvements, unified auth"

# Push to your repository
git push origin main  # or master, depending on your branch

# On your live server
git pull origin main
npm install  # Install any new dependencies
npx prisma generate  # Regenerate Prisma client
npx prisma migrate deploy  # Run migrations if needed
pm2 restart all  # or however you restart your server
```

### Option 2: Manual File Upload
If you're uploading files manually:

1. **Upload all modified files** listed above to your live server
2. **Ensure file permissions are correct** (especially for uploads directory)
3. **Run on live server:**
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate deploy  # If migrations needed
   ```
4. **Restart your server:**
   ```bash
   # If using PM2:
   pm2 restart all
   
   # If using systemd:
   sudo systemctl restart your-service-name
   
   # Or manually:
   # Stop current process and restart with: node server.js
   ```

## ⚙️ Environment Variables

Make sure your live server has these environment variables set (if needed):
- `DATABASE_URL` - Your database connection string
- `PORT` - Server port (defaults to 3000 if not set)
- `NODE_ENV` - Set to "production" for production

## 📁 Directory Structure

Ensure these directories exist on your live server:
- `public/uploads/avatars/` - For avatar uploads (will be created automatically)

## ✅ Post-Deployment Verification

After deploying, verify:

1. **Home Page:**
   - [ ] Featured driver card displays correctly
   - [ ] Card customizations apply if driver has saved customizations

2. **Admin Panel:**
   - [ ] Can access `/admin` page
   - [ ] Featured driver dropdown loads all drivers
   - [ ] Can select and save featured driver
   - [ ] Changes reflect on home page

3. **Card Builder:**
   - [ ] Left menu is scrollable
   - [ ] Card preview is 50% larger
   - [ ] Can export as PNG
   - [ ] Can export as GIF
   - [ ] Can save card customizations
   - [ ] Only own card can be edited

4. **Auth Page:**
   - [ ] Login/signup toggle works
   - [ ] No check session section
   - [ ] Can create accounts and login

5. **Driver Profile:**
   - [ ] Title shows "Driver Profile" (no name)
   - [ ] Card is smaller (not stretched)
   - [ ] All features work

6. **Footers:**
   - [ ] All pages show "Solana Grand Prix" only

## 🔧 Troubleshooting

### If featured driver doesn't work:
- Check that `/api/featured-driver` endpoint is accessible
- Verify the featured driver key is set in server memory
- Check server logs for errors

### If card export doesn't work:
- Verify html2canvas and gif.js libraries load (check browser console)
- Check that scripts are loading in correct order
- Ensure CDN links are accessible

### If database errors occur:
- Run `npx prisma generate` to regenerate client
- Check that migrations are applied: `npx prisma migrate status`
- Verify DATABASE_URL is correct

## 📝 Notes

- The featured driver is stored in server memory (resets on server restart)
- For persistence, you may want to store it in the database later
- All uploaded avatars are stored in `public/uploads/avatars/`
- Make sure this directory is writable and persists across deployments
