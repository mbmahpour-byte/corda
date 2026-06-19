import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { mkdirSync } from 'fs'

// Musical staff SVG mark, centered in a 512x512 canvas
// Staff: 3 lines, quarter note head + stem, all in gold #C9A84C
// Background: #080808

const GOLD = '#C9A84C'

function makeSVG(size) {
  const s = size
  const cx = s / 2
  const cy = s / 2

  // Staff + note proportions, scaled relative to size
  const staffW = s * 0.38
  const staffX = cx - staffW / 2
  const lineSpacing = s * 0.06
  const topLineY = cy - lineSpacing
  const midLineY = cy
  const botLineY = cy + lineSpacing
  const strokeW = s * 0.016

  // Note head (ellipse, tilted)
  const noteX = staffX + staffW * 0.72
  const noteHeadRX = s * 0.055
  const noteHeadRY = s * 0.038
  const noteHeadCY = botLineY + s * 0.005
  const stemX = noteX + noteHeadRX * 0.75
  const stemTopY = topLineY - lineSpacing * 0.5
  const stemW = strokeW * 0.9

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="#080808"/>
  <!-- Staff lines -->
  <line x1="${staffX}" y1="${topLineY}" x2="${staffX + staffW}" y2="${topLineY}" stroke="${GOLD}" stroke-width="${strokeW}" stroke-linecap="round"/>
  <line x1="${staffX}" y1="${midLineY}" x2="${staffX + staffW}" y2="${midLineY}" stroke="${GOLD}" stroke-width="${strokeW}" stroke-linecap="round"/>
  <line x1="${staffX}" y1="${botLineY}" x2="${staffX + staffW}" y2="${botLineY}" stroke="${GOLD}" stroke-width="${strokeW}" stroke-linecap="round"/>
  <!-- Note stem -->
  <line x1="${stemX}" y1="${stemTopY}" x2="${stemX}" y2="${noteHeadCY}" stroke="${GOLD}" stroke-width="${stemW}" stroke-linecap="round"/>
  <!-- Note head -->
  <ellipse cx="${noteX}" cy="${noteHeadCY}" rx="${noteHeadRX}" ry="${noteHeadRY}" fill="${GOLD}" transform="rotate(-18 ${noteX} ${noteHeadCY})"/>
</svg>`
}

async function generate(size, outPath) {
  const svg = makeSVG(size)
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outPath)
  console.log(`✓ ${outPath} (${size}x${size})`)
}

mkdirSync('public', { recursive: true })
await generate(192, 'public/icon-192.png')
await generate(512, 'public/icon-512.png')
