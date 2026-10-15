/**
 * Browser URL for the profile photo uploaded through /api/profile/avatar, or
 * undefined when there is none. The object id versions the URL, so a new
 * photo bypasses the long-lived browser cache.
 */
export function avatarUrl(userId: string, image: string | null | undefined) {
  const prefix = `avatars/${userId}/`;
  if (!image?.startsWith(prefix)) return undefined;
  return `/api/profile/avatar?v=${encodeURIComponent(image.slice(prefix.length))}`;
}
