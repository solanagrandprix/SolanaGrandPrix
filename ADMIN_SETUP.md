# Admin Panel Setup Guide

## 🚀 Quick Setup

### 1. Add the `isAdmin` field to your database

Run this command to add the new column:
```bash
node setup-admin.js
```

Then regenerate the Prisma client:
```bash
npx prisma generate
```

### 2. Make yourself an admin

**Option A: Using Prisma Studio (Easiest)**
```bash
npx prisma studio
```
- Open Prisma Studio in your browser
- Navigate to the `User` table
- Find your user and set `isAdmin` to `true` (or `1` for SQLite)
- Save

**Option B: Direct SQL**
```bash
# For SQLite, you can use sqlite3 or Prisma Studio
# In Prisma Studio, go to User table and edit your user
```

**Option C: Using the setup script**
The setup script will show you instructions. You can also manually edit the database.

### 3. Access the Admin Panel

1. Make sure you're logged in to your account
2. Navigate to: `http://localhost:3000/admin`
3. You should see the admin panel if you have admin privileges

## 🔒 Security Features

- **Authentication Required**: Must be logged in to access admin panel
- **Authorization Check**: Only users with `isAdmin: true` can access
- **Middleware Protection**: All admin API endpoints are protected
- **Self-Protection**: Admins cannot modify their own admin status (safety measure)

## 📋 Admin Panel Features

### Statistics Dashboard
- Total Users count
- Total Admins count
- Total Drivers count
- New users in last 7 days

### User Management
- View all users in a table
- See user roles (Admin/User badges)
- View driver profile status
- View user creation dates
- Toggle admin privileges (cannot modify yourself)

### User Details
- Click "View" to see detailed user information
- Includes driver profile data if available

## 🔧 Admin API Endpoints

All endpoints require admin authentication via Bearer token:

- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user details
- `POST /api/admin/users/:id` - Update user (currently only `isAdmin` field)
- `GET /api/admin/stats` - Get platform statistics

## ⚠️ Important Notes

1. **First Admin**: You must manually set the first admin user in the database, as there's no automatic first admin assignment for security reasons.

2. **Database Migration**: The `setup-admin.js` script adds the column. If it fails, you can manually add it using:
   ```sql
   ALTER TABLE User ADD COLUMN isAdmin INTEGER DEFAULT 0;
   ```

3. **Security**: Never expose admin endpoints without authentication. All admin routes are protected by the `requireAdmin` middleware.

4. **Regenerating Prisma Client**: After adding the column, always run `npx prisma generate` to update the client.

## 🛠️ Troubleshooting

**"Admin access required" error:**
- Make sure you've set `isAdmin: true` (or `1`) in the database for your user
- Make sure you're logged in with the correct account
- Try logging out and back in

**"Column already exists" error:**
- The column is already added, you can skip this step
- Just regenerate Prisma client: `npx prisma generate`

**Can't access admin panel:**
- Verify your user has `isAdmin: true` in the database
- Check browser console for error messages
- Verify you're logged in (check localStorage for `sgp_token`)
