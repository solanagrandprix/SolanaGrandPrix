const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Check if User table exists and has data
    const userCount = await prisma.user.count();
    console.log(`✅ User table accessible - ${userCount} users found`);
    
    // Check if Driver table exists and has data
    const driverCount = await prisma.driver.count();
    console.log(`✅ Driver table accessible - ${driverCount} drivers found`);
    
    // Try to query a user with driver
    const testUser = await prisma.user.findFirst({
      include: { driver: true },
    });
    
    if (testUser) {
      console.log(`✅ Sample user found: ${testUser.username}`);
      if (testUser.driver) {
        console.log(`✅ Driver profile found: ${testUser.driver.displayName}`);
        console.log(`   - DriverKey: ${testUser.driver.driverKey}`);
        console.log(`   - Has customization: ${!!testUser.driver.cardCustomization}`);
      }
    }
    
    // Check for missing columns by trying to query them
    console.log('\nChecking Driver columns...');
    const drivers = await prisma.driver.findMany({ take: 1 });
    if (drivers.length > 0) {
      const driver = drivers[0];
      console.log('✅ Driver columns accessible:');
      console.log(`   - preferredClasses: ${driver.preferredClasses !== undefined ? 'exists' : 'MISSING'}`);
      console.log(`   - country: ${driver.country !== undefined ? 'exists' : 'MISSING'}`);
      console.log(`   - timezone: ${driver.timezone !== undefined ? 'exists' : 'MISSING'}`);
      console.log(`   - cardCustomization: ${driver.cardCustomization !== undefined ? 'exists' : 'MISSING'}`);
    }
    
    console.log('\n✅ Database check complete - everything looks good!');
    
  } catch (err) {
    console.error('❌ Database error:', err.message);
    console.error('Error code:', err.code);
    if (err.meta) {
      console.error('Error details:', err.meta);
    }
    console.error('\nFull error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
