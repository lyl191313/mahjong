import { supabase } from './supabase.js'

/**
 * Storage 桶名，需在 Supabase：Storage → New bucket → 名称 `avatars`
 * 建议勾选 Public bucket（公开读），否则需改用签名 URL。
 *
 * 表字段：players.avatar 存公开 URL 字符串（代码已读写）。
 * 若表无列，在 SQL Editor 执行：
 *   alter table public.players add column if not exists avatar text;
 *
 * Storage 策略（示例，按你安全要求收紧）：
 *   - INSERT：authenticated 或 anon 仅本人路径（若未登录可先用 anon + 路径含 player uuid）
 *   - SELECT：public（公开桶可省略）
 */
export const AVATAR_BUCKET = 'avatars'

const MAX_BYTES = 2 * 1024 * 1024

export async function uploadPlayerAvatarFile(playerId, file) {
  if (!file?.size) throw new Error('请选择图片文件')
  if (file.size > MAX_BYTES) throw new Error('图片请小于 2MB')
  const m = /\.(jpe?g|png|gif|webp)$/i.exec(file.name) || []
  const ext = m[1] ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
  const path = `${playerId}/${Date.now()}.${ext}`
  const contentType =
    file.type || (ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : `image/${ext}`)

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  })
  if (error) throw error

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('无法生成头像访问地址，请确认桶为 Public')
  return data.publicUrl
}
