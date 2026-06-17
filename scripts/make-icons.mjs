import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = 'C:\\Users\\seohe\\Downloads\\icon1-2.png'
const pub = path.join(__dirname, '..', 'public')

async function makeIcon(size) {
  // 아이콘을 캔버스의 63%로 축소 → 사방 약 18.5% 여백
  const iconSize = Math.round(size * 0.63)
  const padTotal = size - iconSize
  const padA = Math.floor(padTotal / 2)
  const padB = padTotal - padA

  await sharp(src)
    .resize(iconSize, iconSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: padA,
      bottom: padB,
      left: padA,
      right: padB,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(pub, `icon1-2-${size}.png`))

  console.log(`✓ icon1-2-${size}.png (캔버스 ${size}px, 아이콘 ${iconSize}px, 여백 ${padA}px)`)
}

await Promise.all([makeIcon(512), makeIcon(192)])
console.log('완료')
