#!/usr/bin/env node
/**
 * CSS Verification Script
 * Ensures Tailwind CSS is properly compiled and accessible
 * Runs after Next.js boots to validate the build succeeded
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const MAX_ATTEMPTS = 15;
const ATTEMPT_DELAY = 2000; // 2 seconds
let attempts = 0;

function checkCSSFile() {
  const cssPath = path.join(__dirname, '.next/static/css/app');
  try {
    if (!fs.existsSync(cssPath)) {
      console.error(`❌ CSS output directory missing: ${cssPath}`);
      return false;
    }
    const files = fs.readdirSync(cssPath);
    const hasCss = files.some(f => f.endsWith('.css'));
    if (!hasCss) {
      console.error(`❌ No CSS files found in ${cssPath}`);
      return false;
    }
    console.log(`✅ CSS files present: ${files.filter(f => f.endsWith('.css')).join(', ')}`);
    return true;
  } catch (e) {
    console.error(`❌ Error checking CSS directory: ${e.message}`);
    return false;
  }
}

function checkCSSEndpoint() {
  return new Promise((resolve) => {
    const url = new URL('http://localhost:3000/_next/static/css/app/layout.css');
    const req = http.request(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('.container')) {
          console.log(`✅ CSS endpoint responds with valid Tailwind output (${data.length} bytes)`);
          resolve(true);
        } else {
          console.error(`❌ CSS endpoint returned status ${res.statusCode} or invalid content`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Failed to reach CSS endpoint: ${err.message}`);
      resolve(false);
    });

    req.end();
  });
}

async function verify() {
  console.log(`[CSS Verification] Starting verification...`);
  
  // Check filesystem first
  if (!checkCSSFile()) {
    console.error(`❌ CSS files not properly generated. Check Tailwind build.`);
    process.exit(1);
  }

  // Poll endpoint until ready
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    console.log(`[Attempt ${attempts}/${MAX_ATTEMPTS}] Testing CSS endpoint...`);
    
    const endpointOk = await checkCSSEndpoint();
    if (endpointOk) {
      console.log(`✅ CSS Verification PASSED - UI should render correctly`);
      process.exit(0);
    }
    
    if (attempts < MAX_ATTEMPTS) {
      console.log(`⏳ Retrying in ${ATTEMPT_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, ATTEMPT_DELAY));
    }
  }

  console.error(`❌ CSS Verification FAILED after ${MAX_ATTEMPTS} attempts`);
  console.error(`   The stylesheet is not accessible. Your UI will render as raw HTML.`);
  console.error(`   Check Next.js build output above for errors.`);
  process.exit(1);
}

verify().catch((err) => {
  console.error(`❌ Verification script error: ${err.message}`);
  process.exit(1);
});
