// Script to add isAdmin column to the database and optionally set first user as admin
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupAdmin() {
  try {
    console.log('Adding isAdmin column to User table...');
    
    // Add the column
    await prisma.$executeRawUnsafe('ALTER TABLE User ADD COLUMN isAdmin INTEGER DEFAULT 0');
    
    console.log('✓ Column added successfully!');
    
    // Ask if user wants to make first user admin
    const firstUser = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    
    if (firstUser) {
      console.log(`\nFirst user found: ${firstUser.username} (ID: ${firstUser.id})`);
      console.log('To make a user admin, you can:');
      console.log('1. Use the admin panel (if you already have admin access)');
      console.log('2. Run this SQL directly: UPDATE User SET isAdmin = 1 WHERE id = <user_id>');
      console.log('3. Or use Prisma Studio: npx prisma studio');
    }
    
    console.log('\n✓ Setup complete!');
    console.log('Now run: npx prisma generate');
    
  } catch (err) {
    if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
      console.log('⚠ Column already exists, skipping...');
    } else {
      console.error('❌ Error:', err.message);
      throw err;
    }
  } finally {
    await prisma.$disconnect();
  }
}

setupAdmin();
