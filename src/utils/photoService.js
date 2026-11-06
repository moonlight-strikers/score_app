import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const BUCKET_NAME = 'player-photos';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const TARGET_SIZE = 300; // 300 x 300 px circular profile size

/**
 * Open native photo picker on Android APK or browser file picker on Web
 * @returns {Promise<string|null>} DataUrl of chosen image, or null if cancelled
 */
export async function pickImageFromDevice() {
  // 1. Android APK native photo picker via Capacitor Camera plugin
  if (Capacitor.isNativePlatform()) {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos, // Uses Android System Photo Picker
        correctOrientation: true,
      });
      return photo.dataUrl || null;
    } catch (err) {
      // User cancelled photo selection
      const msg = err?.message || String(err);
      if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('User cancelled')) {
        return null;
      }
      console.warn('Native photo picker warning, trying fallback:', err);
    }
  }

  // 2. Web browser file input picker
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp';
    input.style.display = 'none';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert('File size exceeds 5 MB. Please choose a smaller photo.');
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };

    input.oncancel = () => resolve(null);

    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 1000);
  });
}

/**
 * Resize and center-crop image to 300x300 square WebP/JPEG blob
 * @param {string} dataUrl
 * @returns {Promise<{ blob: Blob, previewUrl: string }>}
 */
export function processAndResizeImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Center-crop square calculations
        const srcWidth = img.naturalWidth || img.width;
        const srcHeight = img.naturalHeight || img.height;
        const minDim = Math.min(srcWidth, srcHeight);
        const startX = (srcWidth - minDim) / 2;
        const startY = (srcHeight - minDim) / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
          img,
          startX,
          startY,
          minDim,
          minDim,
          0,
          0,
          TARGET_SIZE,
          TARGET_SIZE
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            const previewUrl = canvas.toDataURL('image/jpeg', 0.88);
            resolve({ blob, previewUrl });
          },
          'image/jpeg',
          0.88
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for processing'));
    img.src = dataUrl;
  });
}

/**
 * Upload processed image blob to Supabase Storage in player-photos bucket
 * @param {string|Blob} arg1 playerId or Blob
 * @param {Blob|string} arg2 Blob or playerId
 * @param {string|null} oldPhotoUrl
 * @returns {Promise<string>} Public URL of the uploaded photo
 */
export async function uploadPlayerPhoto(arg1, arg2, oldPhotoUrl = null) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  // Support both (playerId, blob) and (blob, playerId) defensively
  let playerId;
  let blob;
  if (arg1 instanceof Blob || (arg1 && typeof arg1 === 'object' && typeof arg1.slice === 'function')) {
    blob = arg1;
    playerId = arg2;
  } else {
    playerId = arg1;
    blob = arg2;
  }

  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Invalid image file provided for upload.');
  }

  const safePlayerId = String(playerId || 'player').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `avatar_${Date.now()}.jpg`;
  const filePath = `${safePlayerId}/${fileName}`;

  // 1. Upload new photo with upsert
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Supabase Storage upload error:', uploadError);
    throw new Error(uploadError.message || 'Failed to upload image to Supabase Storage');
  }

  // 2. Get Public URL
  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  const newPublicUrl = publicData?.publicUrl || '';

  // 3. Clean up old photo if it exists and belongs to this bucket
  if (oldPhotoUrl && oldPhotoUrl !== newPublicUrl) {
    cleanupOldPhoto(oldPhotoUrl).catch((err) =>
      console.warn('Old photo cleanup skipped:', err)
    );
  }

  return newPublicUrl;
}

/**
 * Extract storage file path and delete old photo from bucket
 * @param {string} photoUrl
 */
export async function cleanupOldPhoto(photoUrl) {
  if (!isSupabaseConfigured || !photoUrl) return;

  try {
    // URL pattern: .../player-photos/[playerId]/[fileName]
    const marker = `/${BUCKET_NAME}/`;
    const idx = photoUrl.indexOf(marker);
    if (idx !== -1) {
      const relativePath = decodeURIComponent(photoUrl.substring(idx + marker.length));
      if (relativePath && !relativePath.startsWith('http')) {
        await supabase.storage.from(BUCKET_NAME).remove([relativePath]);
      }
    }
  } catch (err) {
    console.warn('Error deleting old photo object:', err);
  }
}

/**
 * Generate 1-2 letter initials from a player's full name
 * @param {string} name
 * @returns {string} e.g. "AS" for "Ashok" or "VK" for "Virat Kohli"
 */
export function getPlayerInitials(name = '') {
  const clean = name.trim().toUpperCase();
  if (!clean) return 'P';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`;
  }
  return clean.slice(0, 2);
}

// In-memory cache for signed URLs to prevent generating URLs on every render
const signedUrlCache = new Map();

/**
 * Get a valid signed or public URL for a player photo.
 * Caches signed URLs until near expiry (default 1 hour = 3600s).
 * @param {string} photoUrlOrPath
 * @param {number} expiresInSeconds
 * @returns {Promise<string>}
 */
export async function getSignedPhotoUrl(photoUrlOrPath, expiresInSeconds = 3600) {
  if (!photoUrlOrPath) return '';

  // Extract relative storage path
  let relativePath = photoUrlOrPath;
  const marker = `/${BUCKET_NAME}/`;
  const idx = photoUrlOrPath.indexOf(marker);
  if (idx !== -1) {
    relativePath = decodeURIComponent(photoUrlOrPath.substring(idx + marker.length));
  } else if (photoUrlOrPath.startsWith(`${BUCKET_NAME}/`)) {
    relativePath = photoUrlOrPath.substring(`${BUCKET_NAME}/`.length);
  }

  // Strip query parameters from relative path if any
  if (relativePath.includes('?')) {
    relativePath = relativePath.split('?')[0];
  }

  // If it's a regular external HTTP URL (not pointing to our storage bucket), return it directly
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  // Check cache for valid signed URL
  const now = Date.now();
  const cached = signedUrlCache.get(relativePath);
  if (cached && cached.expiresAt > now + 60 * 1000) {
    return cached.url;
  }

  // Generate signed URL if Supabase is configured
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(relativePath, expiresInSeconds);

      if (!error && data?.signedUrl) {
        signedUrlCache.set(relativePath, {
          url: data.signedUrl,
          expiresAt: now + (expiresInSeconds - 60) * 1000
        });
        return data.signedUrl;
      }
    } catch (err) {
      console.warn('Supabase createSignedUrl error, falling back:', err);
    }

    // Fall back to public URL if signed URL creation fails
    try {
      const { data: pubData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(relativePath);
      if (pubData?.publicUrl) {
        return pubData.publicUrl;
      }
    } catch (e) {}
  }

  return photoUrlOrPath;
}

