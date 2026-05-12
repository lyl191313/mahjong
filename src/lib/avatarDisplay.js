const COLORS = ['#4361ee', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']

export function isImageAvatarUrl(avatar) {
  if (!avatar || typeof avatar !== 'string') return false
  const t = avatar.trim()
  return /^https?:\/\//i.test(t) || t.startsWith('//')
}

function resolveAvatar(entity) {
  if (!entity) return { avatar: null, nickname: '?' }
  if (entity.players && typeof entity.players === 'object') {
    return {
      avatar: entity.players.avatar ?? null,
      nickname: entity.players.nickname ?? entity.nickname ?? '?',
    }
  }
  return {
    avatar: entity.avatar ?? null,
    nickname: entity.nickname ?? '?',
  }
}

function hashColor(nickname) {
  const n = (nickname || '?').charAt(0)
  return COLORS[n.charCodeAt(0) % COLORS.length]
}

/** 用于 :style，兼容「纯色 / 外链图片」 */
export function getAvatarStyle(entity) {
  const { avatar, nickname } = resolveAvatar(entity)
  if (isImageAvatarUrl(avatar)) {
    return {
      backgroundImage: `url(${avatar})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#e2e8f0',
    }
  }
  const bg =
    typeof avatar === 'string' && avatar.startsWith('#')
      ? avatar
      : hashColor(nickname)
  return { backgroundColor: bg }
}

/** 无有效图片 URL 时在圆圈里显示首字 */
export function showAvatarLetter(entity) {
  return !isImageAvatarUrl(resolveAvatar(entity).avatar)
}
