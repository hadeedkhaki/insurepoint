// Read a user-uploaded image file as a JPEG data URL. Handles HEIC/HEIF
// (iPhone photos) by converting to JPEG client-side so the preview renders
// and the backend vision API accepts it.
export async function readImageFile(file) {
  const isHeic =
    /image\/hei[cf]/i.test(file.type) ||
    /\.(heic|heif)$/i.test(file.name);

  let blob = file;
  if (isHeic) {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(blob);
  });
}

// Shared accept string for file inputs — broad image support including HEIC.
export const IMAGE_ACCEPT = 'image/*,.heic,.heif,.avif';
