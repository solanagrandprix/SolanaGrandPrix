// Migration script to add email verification fields to User table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addEmailVerificationFields() {
  try {
    console.log('Adding email verification fields to User table...');
    
    // Check if columns already exist
    const tableInfo = await prisma.$queryRaw`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='User'
    `;
    
    if (tableInfo && tableInfo.length > 0) {
      const sql = tableInfo[0].sql;
      if (sql && sql.includes('email')) {
        console.log('Email verification fields already exist. Skipping migration.');
        return;
      }
    }
    
    // Add email field
    await prisma.$executeRawUnsafe(`
      ALTER TABLE User ADD COLUMN email TEXT;
    `);
    
    // Add emailVerified field
    await prisma.$executeRawUnsafe(`
      ALTER TABLE User ADD COLUMN emailVerified INTEGER NOT NULL DEFAULT 0;
    `);
    
    // Add verificationToken field
    await prisma.$executeRawUnsafe(`
      ALTER TABLE User ADD COLUMN verificationToken TEXT;
    `);
    
    // Add verificationSentAt field
    await prisma.$executeRawUnsafe(`
      ALTER TABLE User ADD COLUMN verificationSentAt DATETIME;
    `);
    
    // Add verifiedAt field
    await prisma.$executeRawUnsafe(`
      ALTER TABLE User ADD COLUMN verifiedAt DATETIME;
    `);
    
    // Add updatedAt field if it doesn't exist
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE User ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
      `);
    } catch (e) {
      if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) {
        throw e;
      }
    }
    
    // Create unique index on email
    try {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX User_email_key ON User(email);
      `);
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
        console.warn('Could not create email unique index:', e.message);
      }
    }
    
    console.log('✓ Successfully added email verification fields to User table');
  } catch (error) {
    if (error.message.includes('duplicate column name') || error.message.includes('already exists')) {
      console.log('Email verification fields already exist. Skipping migration.');
    } else {
      console.error('Error adding email verification fields:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

addEmailVerificationFields();
