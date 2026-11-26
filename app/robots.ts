import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/zlutak', '/sam-byt'],
    },
    sitemap: ['https://www.good-inventions.work/astroroast/sitemap.xml'],
  };
}
