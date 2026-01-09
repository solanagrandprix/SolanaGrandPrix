const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addEmailColumns() {
  try {
    console.log('Adding email-related columns to User table...');
    
    // Check if email column already exists
    const tableInfo = await prisma.$queryRaw`
      PRAGMA table_info(User)
    `;
    
    const hasEmail = tableInfo.some(col => col.name === 'email');
    
    if (hasEmail) {
      console.log('✅ Email columns already exist. Migration not needed.');
      await prisma.$disconnect();
      return;
    }
    
    console.log('Adding email column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN "email" TEXT;
    `);
    
    console.log('Adding emailVerified column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN "emailVerified" INTEGER NOT NULL DEFAULT 0;
    `);
    
    console.log('Adding verificationToken column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN "verificationToken" TEXT;
    `);
    
    console.log('Adding verificationSentAt column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN "verificationSentAt" DATETIME;
    `);
    
    console.log('Adding verifiedAt column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN "verifiedAt" DATETIME;
    `);
    
    // Create unique index on email (SQLite doesn't support unique constraints directly in ALTER TABLE)
    console.log('Creating unique index on email...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
      `);
    } catch (e) {
      // Index might already exist, that's okay
      console.log('Note: Email index may already exist');
    }
    
    // Create unique index on verificationToken
    console.log('Creating unique index on verificationToken...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "User_verificationToken_key" ON "User"("verificationToken");
      `);
    } catch (e) {
      // Index might already exist, that's okay
      console.log('Note: VerificationToken index may already exist');
    }
    
    console.log('✅ All email columns added successfully!');
    
  } catch (err) {
    if (err.message && err.message.includes('duplicate column')) {
      console.log('⚠️ Some columns already exist. Continuing...');
    } else {
      console.error('❌ Error adding email columns:', err.message);
      throw err;
    }
  } finally {
    await prisma.$disconnect();
  }
}

addEmailColumns()
  .then(() => {
    console.log('\n✅ Migration complete!');
    console.log('Now run: npx prisma generate');
    console.log('Then restart your server');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Migration failed:', err.message);
    console.error('Error code:', err.code || 'N/A');
    if (err.message && err.message.includes('duplicate column')) {
      console.log('\n⚠️  Some columns already exist. This is okay - continuing...');
      console.log('Run: npx prisma generate');
      process.exit(0);
    }
    process.exit(1);
  });
