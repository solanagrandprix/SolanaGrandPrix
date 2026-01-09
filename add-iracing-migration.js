const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addIracingField() {
  try {
    console.log('Adding iracing field to Driver table...');
    
    // Check if column already exists
    const tableInfo = await prisma.$queryRaw`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='Driver'
    `;
    
    if (tableInfo && tableInfo.length > 0) {
      const sql = tableInfo[0].sql;
      if (sql && sql.includes('iracing')) {
        console.log('iracing column already exists. Skipping migration.');
        return;
      }
    }
    
    // Add the column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE Driver ADD COLUMN iracing TEXT;
    `);
    
    console.log('✓ Successfully added iracing field to Driver table');
  } catch (error) {
    if (error.message.includes('duplicate column name') || error.message.includes('already exists')) {
      console.log('iracing column already exists. Skipping migration.');
    } else {
      console.error('Error adding iracing field:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

addIracingField();
