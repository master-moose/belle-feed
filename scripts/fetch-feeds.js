#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const SUBSTACK_FEED = 'https://belledejong.substack.com/feed';
const EC_FEED = 'https://europeancorrespondent.com/en/feed.xml';
const OUTPUT_FILE = path.join(__dirname, '..', 'articles.json');

async function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractExcerpt(html, maxWords = 150) {
  // Strip HTML tags
  let text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split by words and cap at maxWords
  const words = text.split(/\s+/);
  return words.slice(0, maxWords).join(' ') + (words.length > maxWords ? '...' : '');
}

function stripSubstackMarkup(html) {
  if (!html) return '';

  // Remove Substack-specific classes and elements
  let text = html
    .replace(/<[^>]*class="[^"]*pencraft[^"]*"[^>]*>/g, '')
    .replace(/<[^>]*class="[^"]*subscription[^"]*"[^>]*>/g, '')
    .replace(/<[^>]*class="[^"]*image-link-expand[^"]*"[^>]*>/g, '')
    .replace(/<[^>]*class="[^"]*restack[^"]*"[^>]*>/g, '')
    .replace(/<a[^>]*href="#"[^>]*>Read more<\/a>/gi, '')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

function extractThumbnail(item, source) {
  if (source === 'ec' && item.enclosure) {
    return item.enclosure['@_url'] || null;
  }

  if (source === 'substack' && item['content:encoded']) {
    const imgMatch = item['content:encoded'].match(/<img[^>]*src="([^"]+)"/);
    return imgMatch ? imgMatch[1] : null;
  }

  return null;
}

function parseSubstackFeed(xmlData) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false
  });
  const parsed = parser.parse(xmlData);

  const items = parsed.rss.channel.item || [];
  return Array.isArray(items) ? items : [items];
}

function parseECFeed(xmlData) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false
  });
  const parsed = parser.parse(xmlData);

  const items = parsed.rss.channel.item || [];
  return Array.isArray(items) ? items : [items];
}

function extractAuthorFromEC(authorString) {
  if (!authorString) return null;
  // Format: "email@domain.com (Author Name)"
  const match = authorString.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
}

function isBelleArticle(item) {
  const author = item.author;
  if (!author) return false;

  const authorName = extractAuthorFromEC(author);
  return authorName && authorName.toLowerCase().includes('belle de jong');
}

function isValidArticle(article) {
  // Filter out placeholder/draft articles
  const excludeTitles = ['Coming soon'];
  if (excludeTitles.includes(article.title)) {
    return false;
  }
  return true;
}

async function run() {
  try {
    console.log('Fetching feeds...');

    let substackItems = [];
    let ecItems = [];

    // Fetch Substack
    try {
      console.log('  Fetching Substack...');
      const substackXml = await fetchFeed(SUBSTACK_FEED);
      const substackParsed = parseSubstackFeed(substackXml);
      substackItems = substackParsed
        .filter(isValidArticle)
        .map(item => ({
          title: item.title,
          url: item.link,
          source: 'substack',
          sourceLabel: 'Substack',
          date: new Date(item.pubDate).toISOString(),
          excerpt: extractExcerpt(stripSubstackMarkup(item['content:encoded'] || item.description)),
          thumbnail: extractThumbnail(item, 'substack')
        }));
      console.log(`  Found ${substackItems.length} Substack articles (after filtering)`);
    } catch (err) {
      console.error('Error fetching Substack:', err.message);
    }

    // Fetch EC
    try {
      console.log('  Fetching European Correspondent...');
      const ecXml = await fetchFeed(EC_FEED);
      const ecParsed = parseECFeed(ecXml);
      const belleArticles = ecParsed.filter(isBelleArticle);
      ecItems = belleArticles.map(item => ({
        title: item.title,
        url: item.link,
        source: 'ec',
        sourceLabel: 'European Correspondent',
        date: new Date(item.pubDate).toISOString(),
        excerpt: extractExcerpt(stripSubstackMarkup(item.description)),
        thumbnail: extractThumbnail(item, 'ec')
      }));
      console.log(`  Found ${belleArticles.length} Belle articles on EC`);
    } catch (err) {
      console.error('Error fetching EC:', err.message);
    }

    // Merge and process
    let allArticles = [...substackItems, ...ecItems];

    // Deduplicate by URL
    const seen = new Set();
    allArticles = allArticles.filter(article => {
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    });

    // Sort newest first
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Cap at 50
    allArticles = allArticles.slice(0, 50);

    // Write output
    const output = {
      updated: new Date().toISOString(),
      articles: allArticles
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\nWrote ${allArticles.length} articles to ${OUTPUT_FILE}`);

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

run();
