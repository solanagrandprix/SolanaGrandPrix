const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllMissingColumns() {
  try {
    console.log('=== Checking and Adding Missing Columns ===\n');
    
    // Check Driver table columns using raw SQL
    const driverColumns = await prisma.$queryRawUnsafe(`
      PRAGMA table_info(Driver)
    `);
    const driverColumnNames = driverColumns.map(col => col.name);
    console.log('Existing Driver columns:', driverColumnNames.join(', '));
    console.log('');
    
    const columnsToAdd = [
      { name: 'iracing', type: 'TEXT' },
      { name: 'solanaWallet', type: 'TEXT' },
      { name: 'cardCustomization', type: 'TEXT' },
    ];
    
    for (const col of columnsToAdd) {
      const exists = driverColumnNames.includes(col.name);
      if (!exists) {
        console.log(`Adding ${col.name} column...`);
        try {
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "Driver" ADD COLUMN "${col.name}" ${col.type};
          `);
          console.log(`✅ ${col.name} column added\n`);
        } catch (err) {
          if (err.message && err.message.includes('duplicate column')) {
            console.log(`⚠️  ${col.name} column already exists\n`);
          } else {
            console.error(`❌ Error adding ${col.name}:`, err.message);
            throw err;
          }
        }
      } else {
        console.log(`✅ ${col.name} column already exists\n`);
      }
    }
    
    console.log('=== All columns verified! ===');
    console.log('Now run: npx prisma generate');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Error code:', err.code);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

fixAllMissingColumns()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFailed:', err);
    process.exit(1);
  });
