import type { MetadataRoute } from 'next'
export default function sitemap(): MetadataRoute.Sitemap { return [{ url: 'https://signal-ats.example', lastModified: new Date() }, { url: 'https://signal-ats.example/privacy', lastModified: new Date() }] }
