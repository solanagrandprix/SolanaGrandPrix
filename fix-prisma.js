// Fix Prisma Client generation issue
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Prisma Client...\n');

try {
  // Step 1: Remove old Prisma client
  console.log('1. Removing old Prisma client...');
  const prismaClientPath = path.join(__dirname, 'node_modules', '.prisma');
  if (fs.existsSync(prismaClientPath)) {
    fs.rmSync(prismaClientPath, { recursive: true, force: true });
    console.log('   ✓ Removed old Prisma client');
  }

  // Step 2: Regenerate Prisma client
  console.log('\n2. Regenerating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit', cwd: __dirname });
  console.log('   ✓ Prisma client regenerated');

  console.log('\n✅ Prisma Client fixed! You can now start your server.');
} catch (error) {
  console.error('\n❌ Error fixing Prisma:', error.message);
  console.log('\nTry running these commands manually:');
  console.log('  npm install');
  console.log('  npx prisma generate');
  process.exit(1);
}
