# PowerShell script to resolve the failed migration

Write-Host "Step 1: Rolling back the failed migration..." -ForegroundColor Yellow
npx prisma migrate resolve --rolled-back 20260104000000_add_driver_profile_fields

Write-Host "`nStep 2: Marking migration as applied (columns already exist)..." -ForegroundColor Yellow
npx prisma migrate resolve --applied 20260104000000_add_driver_profile_fields

Write-Host "`nStep 3: Deploying remaining migrations..." -ForegroundColor Yellow
npx prisma migrate deploy

Write-Host "`nStep 4: Checking migration status..." -ForegroundColor Yellow
npx prisma migrate status

Write-Host "`nDone! If all migrations show as applied, you're ready to deploy." -ForegroundColor Green
