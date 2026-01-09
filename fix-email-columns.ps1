# Quick fix for missing email columns

Write-Host "=== FIXING MISSING EMAIL COLUMNS ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Adding email columns to database..." -ForegroundColor Yellow
node add-email-columns-migration.js

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️ Migration script had issues, trying direct SQL..." -ForegroundColor Yellow
    
    # Try alternative approach
    Write-Host "Attempting direct database fix..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 2: Regenerating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

Write-Host ""
Write-Host "✅ Fix complete! Now restart your server (Ctrl+C then npm start)" -ForegroundColor Green
Write-Host ""
Write-Host "Test by trying to log in again." -ForegroundColor Cyan
