'use client'

import { createClient } from '@/lib/supabase/client'

// Resizes a photo in the browser (max 1600px, WebP) before upload, so large
// phone photos upload quickly on mobile data and pages stay light.
export async function compressImage(file: File, max = 1600, quality = 0.84): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/webp', quality))
}

export async function uploadProductImage(file: File, folder: string) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  const blob = await compressImage(file)
  const path = `${folder}/${crypto.randomUUID()}.webp`
  const supabase = createClient()
  const { error } = await supabase.storage.from('product-images').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) throw new Error(error.message.includes('row-level') ? 'You don’t have permission to upload images' : 'Upload failed — please try again')
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}
