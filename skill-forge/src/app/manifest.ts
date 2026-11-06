import type { MetadataRoute } from 'next';
import { legal } from '@/lib/legal';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: legal.siteName,
    short_name: 'Skill Forge',
    description: "Trasforma appunti o un'idea in una skill completa per agenti AI.",
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f1e8',
    theme_color: '#c25a3a',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
