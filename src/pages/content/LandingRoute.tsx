import { useParams } from 'react-router-dom';
import CmsContentPage from './CmsContentPage';

/** Maps /uae-visa[/:slug] and /dubai-visa routes to CMS landing pages. */
export default function LandingRoute({ dubai = false }: { dubai?: boolean }) {
  const { slug } = useParams<{ slug: string }>();
  const fullSlug = dubai ? 'dubai-visa' : slug ? `uae-visa/${slug}` : 'uae-visa';
  const visaContext = dubai ? 'dubai' : slug;
  return <CmsContentPage slug={fullSlug} contentType="LANDING" visaContext={visaContext} />;
}
