#!/usr/bin/env node
/**
 * Convert SVG logos to PNG format using sharp
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const conversions = [
  {
    input: 'public/scribe-house-logo.svg',
    output: 'public/scribe-house-logo.png',
    width: 256,
    height: 256,
  },
  {
    input: 'public/scribe-house-logo-horizontal.svg',
    output: 'public/scribe-house-logo-horizontal.png',
    width: 512,
    height: 256,
  },
  {
    input: 'public/favicon.svg',
    output: 'public/favicon.png',
    width: 192,
    height: 192,
  },
];

async function convertLogosPNG() {
  let successCount = 0;

  for (const conversion of conversions) {
    const inputPath = path.join(__dirname, conversion.input);
    const outputPath = path.join(__dirname, conversion.output);

    if (!fs.existsSync(inputPath)) {
      console.log(`✗ SVG file not found: ${conversion.input}`);
      continue;
    }

    try {
      await sharp(inputPath, { density: 300 })
        .resize(conversion.width, conversion.height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png({ quality: 90 })
        .toFile(outputPath);

      console.log(`✓ Converted ${conversion.input} → ${conversion.output}`);
      successCount++;
    } catch (error) {
      console.log(`✗ Failed to convert ${conversion.input}: ${error.message}`);
    }
  }

  console.log(`\nSuccessfully converted ${successCount}/${conversions.length} logos to PNG`);
  process.exit(successCount === conversions.length ? 0 : 1);
}

convertLogosPNG();
