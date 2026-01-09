const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function diagnoseAndFix() {
  console.log('=== DIAGNOSING DATABASE ISSUES ===\n');
  
  try {
    // Step 1: Test basic connection
    console.log('1. Testing database connection...');
    await prisma.$connect();
    console.log('   ✅ Database connected\n');
    
    // Step 2: Check User table
    console.log('2. Checking User table...');
    try {
      const userCount = await prisma.user.count();
      console.log(`   ✅ User table accessible - ${userCount} users found\n`);
    } catch (err) {
      console.error(`   ❌ User table error: ${err.message}\n`);
      throw err;
    }
    
    // Step 3: Check Driver table and columns
    console.log('3. Checking Driver table...');
    try {
      const driverCount = await prisma.driver.count();
      console.log(`   ✅ Driver table accessible - ${driverCount} drivers found\n`);
      
      // Try to query with all columns
      const testDriver = await prisma.driver.findFirst();
      if (testDriver) {
        console.log('   ✅ Sample driver found:');
        console.log(`      - ID: ${testDriver.id}`);
        console.log(`      - DriverKey: ${testDriver.driverKey || 'MISSING'}`);
        console.log(`      - DisplayName: ${testDriver.displayName || 'MISSING'}`);
        console.log(`      - Has cardCustomization: ${testDriver.cardCustomization !== undefined ? 'YES' : 'NO'}\n`);
      }
    } catch (err) {
      console.error(`   ❌ Driver table error: ${err.message}`);
      console.error(`   Error code: ${err.code}`);
      if (err.meta) {
        console.error(`   Error meta:`, err.meta);
      }
      throw err;
    }
    
    // Step 4: Check relationship between User and Driver
    console.log('4. Checking User-Driver relationship...');
    try {
      const userWithDriver = await prisma.user.findFirst({
        include: { driver: true },
      });
      if (userWithDriver) {
        console.log(`   ✅ Relationship works`);
        console.log(`      - User: ${userWithDriver.username}`);
        console.log(`      - Has driver: ${userWithDriver.driver ? 'YES' : 'NO'}\n`);
      }
    } catch (err) {
      console.error(`   ❌ Relationship error: ${err.message}\n`);
      throw err;
    }
    
    // Step 5: Test a simple query with all columns
    console.log('5. Testing full driver query...');
    try {
      const fullDriver = await prisma.driver.findFirst({
        select: {
          id: true,
          userId: true,
          driverKey: true,
          displayName: true,
          number: true,
          team: true,
          primaryCar: true,
          avatar: true,
          irating: true,
          license: true,
          starts: true,
          freeAgent: true,
          xpTotal: true,
          xpLevel: true,
          xpToNext: true,
          skillTier: true,
          bestFinish: true,
          winRate: true,
          totalPurse: true,
          preferredClasses: true,
          country: true,
          timezone: true,
          twitch: true,
          twitter: true,
          discord: true,
          iracing: true,
          solanaWallet: true,
          driverNotes: true,
          cardCustomization: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      console.log('   ✅ All columns accessible\n');
    } catch (err) {
      console.error(`   ❌ Column access error: ${err.message}`);
      console.error(`   This means a column is missing from the database\n`);
      throw err;
    }
    
    console.log('=== DIAGNOSIS COMPLETE ===');
    console.log('✅ All checks passed! Database is healthy.\n');
    console.log('If you still have issues, try:');
    console.log('1. Stop your server (Ctrl+C)');
    console.log('2. Run: npx prisma generate');
    console.log('3. Restart your server\n');
    
  } catch (err) {
    console.error('\n=== ERROR FOUND ===');
    console.error(`Error: ${err.message}`);
    console.error(`Code: ${err.code || 'N/A'}`);
    
    if (err.message.includes('no such column') || err.message.includes('Unknown column')) {
      console.error('\n🔧 FIX: Missing database columns detected!');
      console.error('This means your database schema is out of sync.');
      console.error('\nRun these commands:');
      console.error('1. npx prisma migrate resolve --rolled-back 20260104000000_add_driver_profile_fields');
      console.error('2. npx prisma migrate resolve --applied 20260104000000_add_driver_profile_fields');
      console.error('3. npx prisma migrate deploy');
      console.error('4. npx prisma generate');
      console.error('5. Restart your server\n');
    } else if (err.message.includes('no such table')) {
      console.error('\n🔧 FIX: Missing table detected!');
      console.error('Run: npx prisma migrate deploy\n');
    } else {
      console.error('\nFull error:', err);
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseAndFix();
