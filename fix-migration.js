const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMigration() {
  try {
    // Check if columns already exist by trying to query them
    const result = await prisma.$queryRaw`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='Driver'
    `;
    
    console.log('Driver table schema:', result);
    
    // Check if preferredClasses column exists
    const columns = await prisma.$queryRaw`
      PRAGMA table_info(Driver)
    `;
    
    console.log('\nExisting columns:');
    columns.forEach(col => {
      console.log(`- ${col.name} (${col.type})`);
    });
    
    const hasPreferredClasses = columns.some(col => col.name === 'preferredClasses');
    
    if (hasPreferredClasses) {
      console.log('\n✅ Columns already exist. Migration can be marked as applied.');
      console.log('Run: npx prisma migrate resolve --applied 20260104000000_add_driver_profile_fields');
    } else {
      console.log('\n❌ Columns do not exist. Migration needs to run.');
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigration();
