const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addMissingColumns() {
  try {
    console.log('Checking and adding missing columns...\n');
    
    // Check User table columns
    const userColumns = await prisma.$queryRaw`
      PRAGMA table_info(User)
    `;
    const userColumnNames = userColumns.map(col => col.name);
    
    console.log('User table columns:', userColumnNames.join(', '));
    
    // Check Driver table columns
    const driverColumns = await prisma.$queryRaw`
      PRAGMA table_info(Driver)
    `;
    const driverColumnNames = driverColumns.map(col => col.name);
    
    console.log('Driver table columns:', driverColumnNames.join(', '));
    console.log('');
    
    // Check if iracing column exists in Driver
    const hasIracing = driverColumnNames.includes('iracing');
    
    if (!hasIracing) {
      console.log('Adding iracing column to Driver table...');
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Driver" ADD COLUMN "iracing" TEXT;
        `);
        console.log('✅ iracing column added');
      } catch (err) {
        if (err.message.includes('duplicate column')) {
          console.log('⚠️  iracing column already exists');
        } else {
          throw err;
        }
      }
    } else {
      console.log('✅ iracing column already exists');
    }
    
    // Check if solanaWallet column exists in Driver
    const hasSolanaWallet = driverColumnNames.includes('solanaWallet');
    
    if (!hasSolanaWallet) {
      console.log('Adding solanaWallet column to Driver table...');
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Driver" ADD COLUMN "solanaWallet" TEXT;
        `);
        console.log('✅ solanaWallet column added');
      } catch (err) {
        if (err.message.includes('duplicate column')) {
          console.log('⚠️  solanaWallet column already exists');
        } else {
          throw err;
        }
      }
    } else {
      console.log('✅ solanaWallet column already exists');
    }
    
    // Check if cardCustomization column exists in Driver
    const hasCardCustomization = driverColumnNames.includes('cardCustomization');
    
    if (!hasCardCustomization) {
      console.log('Adding cardCustomization column to Driver table...');
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Driver" ADD COLUMN "cardCustomization" TEXT;
        `);
        console.log('✅ cardCustomization column added');
      } catch (err) {
        if (err.message.includes('duplicate column')) {
          console.log('⚠️  cardCustomization column already exists');
        } else {
          throw err;
        }
      }
    } else {
      console.log('✅ cardCustomization column already exists');
    }
    
    console.log('\n✅ All missing columns have been added!');
    console.log('Now run: npx prisma generate');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Error code:', err.code);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

addMissingColumns()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFailed to add columns:', err);
    process.exit(1);
  });
