import { useParams } from 'react-router-dom';
import CmsContentPage from './CmsContentPage';

/** Maps /guides/:slug and /news/:slug to CMS content pages. */
export default function CmsContentPageWrapper({ type }: { type: 'GUIDE' | 'NEWS' }) {
  const { slug } = useParams<{ slug: string }>();
  const prefix = type === 'GUIDE' ? 'guides' : 'news';
  return <CmsContentPage slug={`${prefix}/${slug ?? ''}`} contentType={type} />;
}
