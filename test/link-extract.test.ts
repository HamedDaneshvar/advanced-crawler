import { chromium } from 'playwright';
import { extractAllLinks } from '../src/core/linkExtractor.js';

const SAMPLE_HTML = `
<base href="https://bytebytego.com/">
<div class="style-module-scss-module__lSxgaq__courseList">
  <a class="style-module-scss-module__lSxgaq__courseImg" onclick="window.location='/courses/coding-patterns'"><img alt="Coding Interview Patterns"></a>
  <a class="style-module-scss-module__lSxgaq__courseImg" data-href="/courses/system-design-interview"><img alt="System Design"></a>
  <a class="style-module-scss-module__lSxgaq__courseImg"><img alt="No Link"></a>
</div>
`;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(SAMPLE_HTML, { waitUntil: 'domcontentloaded' });
  console.log('page.url:', await page.url());
  const debug = await page.$$eval('a', (anchors) => anchors.map((a) => ({ href: a.getAttribute('href'), onclick: a.getAttribute('onclick'), dataHref: a.getAttribute('data-href') })));
  console.log('Anchor debug:', debug);
  const evalLinks = await page.evaluate(() => {
    const linkSet = new Set();
    const anchors = document.querySelectorAll('a');
    for (const anchor of anchors) {
      const href = anchor.getAttribute('href');
      if (href && href.trim() && !href.startsWith('javascript:') && !href.startsWith('#')) {
        try { linkSet.add(new URL(href, window.location.href).href); } catch {}
      }
      const dataHref = anchor.getAttribute('data-href');
      if (dataHref && dataHref.trim()) { try { linkSet.add(new URL(dataHref, window.location.href).href); } catch {} }
      const onclick = anchor.getAttribute('onclick');
      if (onclick) {
        const patterns = [/window\.location\s*=\s*['\"](.*?)['\"]/,/window\.location\.href\s*=\s*['\"](.*?)['\"]/,/navigate\(['\"](.*?)['\"]\)/,/router\.push\(['\"](.*?)['\"]\)/,/location\.href\s*=\s*['\"](.*?)['\"]/];
        for (const pattern of patterns) { const match = onclick.match(pattern); if (match?.[1]) { try { linkSet.add(new URL(match[1], window.location.href).href); } catch {} } }
      }
    }
    return Array.from(linkSet);
  });
  console.log('EvalLinks:', evalLinks);
  const links = await extractAllLinks(page, 'https://bytebytego.com');
  console.log('Found links:', links);
  await browser.close();
})();
