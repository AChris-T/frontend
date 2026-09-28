import { mediaUrl } from '@/lib/constants';

/**
 * Small preview of a report photo. Uses the backend-generated thumbnail
 * (~30 KB) when there is one, so lists and map popups never download the
 * multi-MB original; falls back to the original, lazily loaded.
 */
export default function Thumbnail({ report, className = '', alt = '', fit = 'cover' }) {
  const url = mediaUrl(report.thumb_url || report.photo_url);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`}
    />
  );
}
