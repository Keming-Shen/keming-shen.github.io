'use strict'
// Milestones: Asada, MIT 2.12 Ch.1 pp.1–2; MIT Manipulation 2024 lecture21 p.8;
// Stanford Report, "Stanford’s robotics legacy" (2019); Waseda, "The Robots
// of Waseda: A 50-Year Journey in Humanoid Innovation" (2026).
// Dates are historical facts. The SVG is a new diagram, not a copied photograph.
const fs = require('fs')
const path = require('path')
const output = process.argv[2] || '00-robotics-history.svg'
const events = [
  ['≤1948', '主从操作系统', '操作者远程操纵机械臂'],
  ['1954', 'Devol 的零件转移设备', '专利申请：示教与回放'],
  ['1961', 'Unimate', '可编程工业机器人'],
  ['1969', 'Stanford Arm', '机械臂研究与教学平台'],
  ['1973', 'WABOT-1', '步行、抓取与简单语言交流']
]
const rows = events.map(([year, title, description], i) => {
  const y = 142 + i * 100
  return `<g><circle cx="155" cy="${y}" r="9" fill="#386db6"/><text x="127" y="${y + 9}" text-anchor="end" class="year">${year}</text><text x="192" y="${y + 3}" class="event">${title}</text><text x="192" y="${y + 36}" class="detail">${description}</text></g>`
}).join('\n')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="620" viewBox="0 0 640 620" role="img" aria-labelledby="title desc">
<title id="title">机器人早期发展，1948 年前至 1973 年</title>
<desc id="desc">主从操作系统、Devol 专利、Unimate、Stanford Arm 和 WABOT-1 的历史节点。节点沿时间排列，不代表前者直接派生后者。</desc>
<style>text{font-family:'Microsoft YaHei','Noto Sans CJK SC',sans-serif;fill:#243954}.year{font-size:25px;font-weight:600}.event{font-size:25px;font-weight:600}.detail{font-size:22px;fill:#51647d}</style>
<rect width="640" height="620" rx="20" fill="#f1f6fc"/>
<text x="40" y="58" font-size="28" font-weight="600">机器人早期发展</text>
<text x="40" y="91" font-size="20" fill="#51647d">远程操作 · 可编程操作 · 综合感知与运动</text>
<path d="M155 142 V542" stroke="#bacfe9" stroke-width="4"/>
${rows}
</svg>\n`
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
fs.writeFileSync(output, svg)
console.log(output)
