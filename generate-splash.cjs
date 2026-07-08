const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcIcon = 'src/assets/images/app_logo_final_1783550479368.jpg';
const resDir = 'android/app/src/main/res';

const splashFiles = [
  'drawable-land-night-hdpi/splash.png',
  'drawable-port-night-ldpi/splash.png',
  'drawable-land-xxxhdpi/splash.png',
  'drawable-port-night-xxxhdpi/splash.png',
  'drawable/splash.png',
  'drawable-land-hdpi/splash.png',
  'drawable-land-mdpi/splash.png',
  'drawable-port-xhdpi/splash.png',
  'drawable-land-night-ldpi/splash.png',
  'drawable-port-night-mdpi/splash.png',
  'drawable-port-hdpi/splash.png',
  'drawable-land-night-xxhdpi/splash.png',
  'drawable-port-night-hdpi/splash.png',
  'drawable-land-xhdpi/splash.png',
  'drawable-land-night-mdpi/splash.png',
  'drawable-port-mdpi/splash.png',
  'drawable-port-night-xxhdpi/splash.png',
  'drawable-port-xxhdpi/splash.png',
  'drawable-land-night-xxxhdpi/splash.png',
  'drawable-port-night-xhdpi/splash.png',
  'drawable-land-night-xhdpi/splash.png',
  'drawable-port-ldpi/splash.png',
  'drawable-port-xxxhdpi/splash.png',
  'drawable-night/splash.png',
  'drawable-land-xxhdpi/splash.png',
  'drawable-land-ldpi/splash.png'
];

async function generateSplashes() {
  console.log('Generating clean Android splash screens...');
  for (const relPath of splashFiles) {
    const fullPath = path.join(resDir, relPath);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const isLand = relPath.includes('-land');
    let density = 'mdpi';
    if (relPath.includes('xxxhdpi')) density = 'xxxhdpi';
    else if (relPath.includes('xxhdpi')) density = 'xxhdpi';
    else if (relPath.includes('xhdpi')) density = 'xhdpi';
    else if (relPath.includes('hdpi')) density = 'hdpi';
    else if (relPath.includes('ldpi')) density = 'ldpi';
    else if (relPath.includes('mdpi')) density = 'mdpi';

    let width = 480;
    let height = 800;

    if (isLand) {
      if (density === 'ldpi') { width = 320; height = 240; }
      else if (density === 'mdpi') { width = 480; height = 320; }
      else if (density === 'hdpi') { width = 800; height = 480; }
      else if (density === 'xhdpi') { width = 1280; height = 720; }
      else if (density === 'xxhdpi') { width = 1920; height = 1080; }
      else if (density === 'xxxhdpi') { width = 2560; height = 1440; }
    } else {
      if (density === 'ldpi') { width = 240; height = 320; }
      else if (density === 'mdpi') { width = 320; height = 480; }
      else if (density === 'hdpi') { width = 480; height = 800; }
      else if (density === 'xhdpi') { width = 720; height = 1280; }
      else if (density === 'xxhdpi') { width = 1080; height = 1920; }
      else if (density === 'xxxhdpi') { width = 1440; height = 2560; }
    }

    // Determine logo size (30% of the minimum dimension)
    const logoSize = Math.round(Math.min(width, height) * 0.30);

    // Create the centered logo buffer
    const logoBuffer = await sharp(srcIcon)
      .resize(logoSize, logoSize)
      .toBuffer();

    // Create the splash image
    await sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 2, g: 6, b: 23, alpha: 1 } // #020617
      }
    })
      .composite([{ input: logoBuffer, gravity: 'center' }])
      .png()
      .toFile(fullPath);

    console.log(`Generated: ${relPath} (${width}x${height})`);
  }
  console.log('Splash screens generation complete!');
}

generateSplashes().catch(err => {
  console.error('Error generating splash screens:', err);
  process.exit(1);
});
