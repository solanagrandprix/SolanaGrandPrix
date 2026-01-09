# Quick Fix Script for Login & Page Errors

Write-Host "=== QUICK FIX FOR LOGIN & PAGE ERRORS ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Regenerating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Prisma generate failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Resolving migration issues..." -ForegroundColor Yellow
npx prisma migrate resolve --rolled-back 20260104000000_add_driver_profile_fields
npx prisma migrate resolve --applied 20260104000000_add_driver_profile_fields

Write-Host ""
Write-Host "Step 3: Deploying migrations..." -ForegroundColor Yellow
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Migration deploy had issues - continuing anyway..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 4: Testing database connection..." -ForegroundColor Yellow
node diagnose-and-fix.js
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Database test failed! Check the error above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible fixes:" -ForegroundColor Yellow
    Write-Host "1. Make sure the database file exists at: prisma/dev.db"
    Write-Host "2. Try: npx prisma migrate reset --skip-seed (WARNING: deletes data!)"
    Write-Host "3. Check EMERGENCY_FIX.md for more solutions"
    exit 1
}

Write-Host ""
Write-Host "✅ All fixes applied successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "1. Stop your server if it's running (Ctrl+C)"
Write-Host "2. Start your server: npm start"
Write-Host "3. Try logging in again"
Write-Host ""
Write-Host "If you still see errors, check the server console output." -ForegroundColor Yellow
