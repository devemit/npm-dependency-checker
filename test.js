#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🧪 Testing npm-dependency-check CLI tool...\n');

// Test 1: Help command
console.log('1. Testing help command...');
try {
   execSync('node src/cli.js --help', { encoding: 'utf8' });
   console.log('✅ Help command works');
} catch (error) {
   console.log('❌ Help command failed:', error.message);
}

// Test 2: Check command
console.log('\n2. Testing check command...');
try {
   const checkOutput = execSync('node src/cli.js check --format json', { encoding: 'utf8' });
   const result = JSON.parse(checkOutput.split('\n').slice(1).join('\n'));
   console.log('✅ Check command works');
   console.log(`   Found ${result.summary.total} dependencies`);
   console.log(`   ${result.summary.outdated} outdated, ${result.summary.upToDate} up to date`);
} catch (error) {
   console.log('❌ Check command failed:', error.message);
}

// Test 3: Update command
console.log('\n3. Testing update command...');
try {
   execSync('node src/cli.js update --dry-run', { encoding: 'utf8' });
   console.log('✅ Update command works');
} catch (error) {
   console.log('❌ Update command failed:', error.message);
}

// Test 4: Audit command
console.log('\n4. Testing audit command...');
try {
   execSync('node src/cli.js audit --severity low', { encoding: 'utf8' });
   console.log('✅ Audit command works');
} catch (error) {
   console.log('❌ Audit command failed:', error.message);
}

// Test 5: Performance test
console.log('\n5. Testing performance with parallel requests...');
try {
   const startTime = Date.now();
   execSync('node src/cli.js check --parallel 20 --format json', {
      encoding: 'utf8',
   });
   const endTime = Date.now();
   const duration = endTime - startTime;
   console.log(`✅ Performance test completed in ${duration}ms`);
} catch (error) {
   console.log('❌ Performance test failed:', error.message);
}

console.log('\n🎉 All tests completed!');
console.log('\n📋 Next steps:');
console.log('1. Run "npm link" to make the tool globally available');
console.log('2. Test with "npm-dependency-check check" in any project');
console.log('3. Customize the tool for your specific needs');
