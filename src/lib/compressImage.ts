const MAX_SIDE = 1600;
const QUALITY = 0.82;

/**
 * Shrinks a photo in the browser before upload: longest side capped at 1600px and
 * re-encoded as WebP (JPEG on browsers that cannot encode WebP). Returns the original
 * file for GIFs, undecodable formats, or when compression would not make it smaller.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

    let blob = await encode('image/webp');
    if (blob?.type !== 'image/webp') {
      // Older Safari cannot encode WebP and silently returns a large PNG, so use JPEG
      // instead, on white since JPEG has no transparency.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      blob = await encode('image/jpeg');
    }
    bitmap.close();

    if (!blob || blob.size >= file.size) return file;

    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const name = file.name.replace(/\.[^.]+$/, '') + '.' + extension;
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  }
}
