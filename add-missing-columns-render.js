// Script to add missing columns to Render.com database
// Run this in Render Shell: node add-missing-columns-render.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to database...\n');

  try {
    // Check if isAdmin column exists in User table
    console.log('1. Checking User table...');
    try {
      await prisma.$executeRawUnsafe('SELECT "isAdmin" FROM "User" LIMIT 1');
      console.log('   ✅ User.isAdmin column already exists');
    } catch (err) {
      if (err.message.includes('no such column: isAdmin')) {
        console.log('   ➕ Adding User.isAdmin column...');
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" ADD COLUMN "isAdmin" INTEGER DEFAULT 0;
        `);
        console.log('   ✅ User.isAdmin column added');
      } else {
        throw err;
      }
    }

    // Check if cardCustomization column exists in Driver table
    console.log('\n2. Checking Driver table...');
    try {
      await prisma.$executeRawUnsafe('SELECT "cardCustomization" FROM "Driver" LIMIT 1');
      console.log('   ✅ Driver.cardCustomization column already exists');
    } catch (err) {
      if (err.message.includes('no such column: cardCustomization')) {
        console.log('   ➕ Adding Driver.cardCustomization column...');
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Driver" ADD COLUMN "cardCustomization" TEXT;
        `);
        console.log('   ✅ Driver.cardCustomization column added');
      } else {
        throw err;
      }
    }

    // Check for other missing columns that might be needed
    const driverColumnsToCheck = [
      'iracing',
      'solanaWallet',
      'wins',
      'podiums',
      'updatedAt'
    ];

    console.log('\n3. Checking other Driver columns...');
    for (const col of driverColumnsToCheck) {
      try {
        await prisma.$executeRawUnsafe(`SELECT "${col}" FROM "Driver" LIMIT 1`);
        console.log(`   ✅ Driver.${col} already exists`);
      } catch (err) {
        if (err.message.includes(`no such column: ${col}`)) {
          console.log(`   ➕ Adding Driver.${col}...`);
          
          if (col === 'updatedAt') {
            await prisma.$executeRawUnsafe(`
              ALTER TABLE "Driver" ADD COLUMN "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP;
            `);
          } else if (col === 'wins' || col === 'podiums') {
            await prisma.$executeRawUnsafe(`
              ALTER TABLE "Driver" ADD COLUMN "${col}" INTEGER DEFAULT 0;
            `);
          } else {
            await prisma.$executeRawUnsafe(`
              ALTER TABLE "Driver" ADD COLUMN "${col}" TEXT;
            `);
          }
          console.log(`   ✅ Driver.${col} added`);
        }
      }
    }

    // Verify the fix worked
    console.log('\n4. Verifying fixes...');
    await prisma.user.findFirst({
      select: {
        id: true,
        username: true,
        isAdmin: true,
        createdAt: true
      }
    });
    console.log('   ✅ User table query works');

    await prisma.driver.findFirst({
      select: {
        id: true,
        driverKey: true,
        cardCustomization: true
      }
    });
    console.log('   ✅ Driver table query works');

    console.log('\n✅ All missing columns added successfully!');
    console.log('   You can now restart your Render service.\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('Code:', err.code || 'N/A');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingColumns();
