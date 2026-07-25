#!/usr/bin/env node
/**
 * Joblink Live Reload Helper Script
 * Enables hot reload development workflow for Android emulator
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const devConfigPath = path.join(__dirname, 'capacitor.dev.config.ts');
const prodConfigPath = path.join(__dirname, 'capacitor.config.ts');
const configPath = path.join(__dirname, 'capacitor.config.ts');

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.100.5'; // Fallback
}

const command = process.argv[2];
const customIP = process.argv[3];
const localIP = customIP || getLocalIP();

if (command === 'dev') {
  console.log('🚀 Switching to DEVELOPMENT mode (Live Reload)...');
  console.log(`📱 Dev Server URL: http://${localIP}:8000`);
  console.log('📧 Make sure React dev server is running: npm start');
  console.log('⚡ The emulator will reload when you save files');
  
  // Read dev config and replace IP
  let devConfig = fs.readFileSync(devConfigPath, 'utf8');
  devConfig = devConfig.replace(/url: 'http:\/\/[^:]+:8000'/g, `url: 'http://${localIP}:8000'`);
  fs.writeFileSync(configPath, devConfig);
  
  console.log('✅ Switched to live reload config');
  console.log('\n📋 Next steps:');
  console.log('  1. npm start (in another terminal)');
  console.log('  2. npx cap sync android');
  console.log('  3. cd android && ./gradlew.bat assembleDebug');
  console.log('  4. adb install -r android/app/build/outputs/apk/debug/app-debug.apk');
  console.log('\n💡 Edit files in src/ and changes will reload in emulator!');
  
} else if (command === 'prod') {
  console.log('📦 Switching to PRODUCTION mode (Build only)...');
  
  // Copy prod config to active config
  const prodConfig = fs.readFileSync(prodConfigPath, 'utf8');
  fs.writeFileSync(configPath, prodConfig);
  
  console.log('✅ Switched to production config');
  
} else {
  console.log('Joblink Live Reload Helper');
  console.log('\nUsage:');
  console.log('  node live-reload.js dev [IP]   - Enable live reload for development');
  console.log('  node live-reload.js prod       - Switch to production mode');
  console.log('\nExamples:');
  console.log('  node live-reload.js dev                    # Auto-detect local IP');
  console.log('  node live-reload.js dev 192.168.1.100      # Use custom IP');
}
