const TIERS = [
  { name: '坚韧黑铁', color: '#6b7280', subSize: 10 },
  { name: '英勇黄铜', color: '#b45309', subSize: 10 },
  { name: '不屈白银', color: '#94a3b8', subSize: 10 },
  { name: '荣耀黄金', color: '#eab308', subSize: 10 },
  { name: '华贵铂金', color: '#06b6d4', subSize: 10 },
  { name: '流光翡翠', color: '#22c55e', subSize: 10 },
  { name: '璀璨钻石', color: '#8b5cf6', subSize: 20 },
  { name: '超凡大师', color: '#ec4899', subSize: 20 },
  { name: '傲世宗师', color: '#ef4444', subSize: 20 },
  { name: '最强王者', color: '#f59e0b', subSize: 0 },
]

const SUB_LABELS = ['I', 'II', 'III', 'IV']

// 预计算每个大段位的起始分数
// 黑铁0 黄铜40 白银80 黄金120 铂金160 翡翠200 钻石240 大师320 宗师400 王者480
const TIER_STARTS = []
let _offset = 0
for (const t of TIERS) {
  TIER_STARTS.push(_offset)
  _offset += t.subSize * 4
}

export const TIER_RULES = TIERS.map((t, i) => ({
  name: t.name,
  color: t.color,
  start: TIER_STARTS[i],
  end: i === 9 ? null : TIER_STARTS[i] + t.subSize * 4 - 1,
  subSize: t.subSize,
}))

export function getTier(totalScore) {
  const score = Math.max(0, totalScore || 0)

  // 最强王者: >= 480
  if (score >= TIER_STARTS[9]) {
    const t = TIERS[9]
    return { major: 9, majorName: t.name, sub: 0, label: t.name, color: t.color }
  }

  // 从高到低查找所属段位
  let major = 0
  for (let i = TIERS.length - 2; i >= 0; i--) {
    if (score >= TIER_STARTS[i]) {
      major = i
      break
    }
  }

  const t = TIERS[major]
  const inTier = score - TIER_STARTS[major]
  const sub = Math.floor(inTier / t.subSize)
  return {
    major,
    majorName: t.name,
    sub: sub + 1,
    label: `${t.name} ${SUB_LABELS[sub]}`,
    color: t.color,
  }
}
