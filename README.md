# Belle's Article Feed

Automated RSS feed aggregator for Belle de Jong's Substack and European Correspondent articles. Fetches feeds hourly, caches results as JSON, and serves via GitHub Pages for embedding in Readymag.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Test locally**
   ```bash
   npm run fetch
   ```
   This writes `public/articles.json` with articles from both feeds.

3. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/belle-feed.git
   git branch -M main
   git push -u origin main
   ```

4. **Enable GitHub Pages**
   - Go to your repo Settings → Pages
   - Set Source to "Deploy from a branch"
   - Select `main` branch, `/public` folder
   - Save

5. **Update widget URL**
   - In `widget/widget.html`, replace `YOUR_USERNAME` with your GitHub username
   - Verify the URL becomes: `https://raw.githubusercontent.com/YOUR_USERNAME/belle-feed/main/public/articles.json`

6. **Embed in Readymag**
   - Copy the entire contents of `widget/widget.html`
   - In Readymag editor, add a Custom HTML block
   - Paste the widget code

## How it works

- **GitHub Action** (`.github/workflows/fetch-feeds.yml`): Runs every hour, fetches both RSS feeds, processes them, writes `public/articles.json`
- **Feed Fetcher** (`scripts/fetch-feeds.js`): Parses Substack + EC feeds, filters to Belle's articles, extracts excerpts, outputs JSON
- **Widget** (`widget/widget.html`): Fetches articles.json on page load, renders clean vertical article list with "Read on →" links

## Articles format

Each article in the JSON has:
- `title` - Article headline
- `url` - Link to original source
- `source` - "substack" or "ec"
- `sourceLabel` - Display label
- `date` - ISO timestamp
- `excerpt` - First ~150 words, plain text
- `thumbnail` - Image URL (may be null)

## Testing the widget locally

1. Open `widget/widget.html` in a browser
2. Verify articles load and render correctly
3. Check that links open in new tabs

## Troubleshooting

- **Action doesn't run**: Check that `.github/workflows/fetch-feeds.yml` is on the `main` branch
- **No articles in JSON**: Run `npm run fetch` to check for errors, verify feed URLs are accessible
- **Widget shows error**: Check browser console for CORS errors, verify GitHub Pages URL is correct
