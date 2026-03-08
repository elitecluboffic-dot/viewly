/**
 * Cloudflare Worker — Auto Sitemap Generator
 * viewly.labibalwasi.com
 *
 * Cara pasang:
 * 1. Buka Cloudflare Dashboard → Workers & Pages → Create Worker
 * 2. Paste seluruh kode ini → Save & Deploy
 * 3. Di Workers & Pages → Settings → Triggers → Add Route:
 *    Route: viewly.labibalwasi.com/sitemap.xml
 *    Zone:  labibalwasi.com
 * 4. Selesai! /sitemap.xml sekarang auto-generate dari isi gallery.
 */

const SITE_URL = 'https://viewly.labibalwasi.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Hanya intercept /sitemap.xml
    if (url.pathname !== '/sitemap.xml') {
      return fetch(request);
    }

    try {
      // Fetch halaman utama galeri
      const res = await fetch(SITE_URL + '/', {
        headers: { 'User-Agent': 'SitemapBot/1.0' }
      });
      const html = await res.text();

      // Parse semua gallery-item dari HTML
      const images = parseGalleryImages(html);
      const today = new Date().toISOString().split('T')[0];

      const xml = buildSitemap(images, today);

      return new Response(xml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600', // cache 1 jam
        }
      });

    } catch (err) {
      // Fallback: sitemap minimal kalau fetch gagal
      return new Response(minimalSitemap(), {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' }
      });
    }
  }
};

/**
 * Parse semua <article class="gallery-item"> dari HTML
 * Ambil: data-title, data-desc, semua <img src> di dalamnya
 */
function parseGalleryImages(html) {
  const images = [];

  // Ambil setiap gallery-item block
  const articleRegex = /<article[^>]*class="[^"]*gallery-item[^"]*"([^>]*)>([\s\S]*?)<\/article>/gi;
  let articleMatch;

  while ((articleMatch = articleRegex.exec(html)) !== null) {
    const attrs = articleMatch[1];
    const body  = articleMatch[2];

    // Ambil data-title dan data-desc dari atribut article
    const title = extractAttr(attrs, 'data-title') || '';
    const desc  = extractAttr(attrs, 'data-desc')  || '';

    // Ambil semua <img src="..."> di dalam article ini
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(body)) !== null) {
      const src = imgMatch[1];
      const alt = imgMatch[2] || desc;
      if (src && src.startsWith('http')) {
        images.push({ src, title, caption: alt || title });
      }
    }
  }

  return images;
}

/** Ambil nilai atribut dari string atribut HTML */
function extractAttr(str, attr) {
  const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const m = str.match(regex);
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

/** Escape karakter XML */
function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build XML sitemap string */
function buildSitemap(images, today) {
  const imageEntries = images.map(img => `
    <image:image>
      <image:loc>${esc(img.src)}</image:loc>
      <image:title>${esc(img.title)}</image:title>
      <image:caption>${esc(img.caption)}</image:caption>
    </image:image>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>${imageEntries}
  </url>
</urlset>`;
}

/** Sitemap minimal kalau fetch gagal */
function minimalSitemap() {
  const today = new Date().toISOString().split('T')[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`;
}
