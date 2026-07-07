const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcIcon = 'src/assets/images/app_logo_1783375653854.jpg';
const resDir = 'android/app/src/main/res';

const sizes = {
  ldpi: { icon: 36, adaptive: 81 },
  mdpi: { icon: 48, adaptive: 108 },
  hdpi: { icon: 72, adaptive: 162 },
  xhdpi: { icon: 96, adaptive: 216 },
  xxhdpi: { icon: 144, adaptive: 324 },
  xxxhdpi: { icon: 192, adaptive: 432 }
};

async function generate() {
  console.log('Generating Android Launcher Icons from ' + srcIcon);

  // Generate public PWA web icons first to replace the corrupted ones
  console.log('Generating public PWA web icons...');
  await sharp(srcIcon).resize(192, 192).toFile('public/icon-192.png');
  await sharp(srcIcon).resize(512, 512).toFile('public/icon-512.png');
  await sharp(srcIcon).resize(192, 192).toFile('public/icon-maskable-192.png');
  await sharp(srcIcon).resize(512, 512).toFile('public/icon-maskable-512.png');
  await sharp(srcIcon).resize(512, 512).toFile('public/app-icon.jpg');
  await sharp(srcIcon).resize(512, 512).jpeg({ quality: 95 }).toFile('public/app_logo.jpg');
  console.log('Public PWA icons generated successfully!');

  // Generate native Android mipmap icons
  for (const [density, config] of Object.entries(sizes)) {
    const dir = path.join(resDir, `mipmap-${density}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 1. ic_launcher.png (standard icon)
    await sharp(srcIcon)
      .resize(config.icon, config.icon)
      .toFile(path.join(dir, 'ic_launcher.png'));

    // 2. ic_launcher_round.png (round icon)
    const radius = config.icon / 2;
    const circleSvg = Buffer.from(
      `<svg><circle cx="${radius}" cy="${radius}" r="${radius}"/></svg>`
    );
    await sharp(srcIcon)
      .resize(config.icon, config.icon)
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // 3. ic_launcher_foreground.png (adaptive foreground, centered with padding)
    const fgSize = config.adaptive;
    const innerSize = Math.round(fgSize * 0.65);
    const innerIcon = await sharp(srcIcon)
      .resize(innerSize, innerSize)
      .toBuffer();

    await sharp({
      create: {
        width: fgSize,
        height: fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: innerIcon, gravity: 'center' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    // 4. ic_launcher_background.png (adaptive background, solid #020617)
    await sharp({
      create: {
        width: fgSize,
        height: fgSize,
        channels: 4,
        background: { r: 2, g: 6, b: 23, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(dir, 'ic_launcher_background.png'));
  }

  console.log('Successfully generated all launcher icons!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
