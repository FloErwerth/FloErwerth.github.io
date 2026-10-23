# awesomeapps.fun

Every app, its updates, and the documents that have to be true. To be served at <https://awesomeapps.fun>.

## Adding an app or an update

- An app is one entry in `_data/apps.yml` and a three-line `<slug>/index.md`. Its icon goes to `assets/icons/<slug>.webp` (256 px).
- "So funktioniert's" on an app page is the `how` list of that entry. Screenshots and screen recordings go to `assets/apps/<slug>/`: 540 px wide WebP, and MP4 (H.264, no sound, a few MB at most) with a WebP poster. An app with no recordings yet gets a drawing in `_includes/how/`, which the page labels "Skizze".
- "Updates zu <App>" on an app page is the `milestones` list of that entry (`date`, `title`, `text`, oldest first), followed by the posts that name the app. Take the milestones from the app's commit history on its main branch, one per step a user would notice.
- An update is a post: `_posts/YYYY-MM-DD-title.md` with `title:` and `apps: [<slug>, …]`. It shows on the home page, on each named app's page, in `/updates/` and in `/feed.xml`.

## Privacy policies are not written here

A privacy policy is written in the app's own repository, in both languages:

- `docs/legal/privacy-policy.md`
- `docs/legal/privacy-policy.de.md`

The files under `graviton/` here are those two, with the repository's internal header stripped and Jekyll front matter added. **Edit the source, then republish.** A change made only here is a policy that no longer describes the app it is about, which is the one kind of wrong that is a legal problem rather than a bug report. See ADR-0021 in the app repository.

They use `_layouts/default.html`, which has no chrome but the Impressum link the law asks for. Everything else uses `_layouts/site.html`.

## app-ads.txt

`app-ads.txt` sits at the root, and it has to. Google reads it from the root of the developer website named in the store listing, never from a subdirectory. That is why this is a user site and not a project site, and why every store listing names `https://awesomeapps.fun` as its website.

The publisher ID in it is the middle of the AdMob app ID in the app's `app.json`. Change one and change the other, or the file says nothing.

## The domain

`CNAME` names `awesomeapps.fun`. The DNS records live at IONOS: four A and four AAAA records for `@` pointing at GitHub Pages, and `www` as a CNAME to `floerwerth.github.io`.

## Publishing and preview

GitHub Pages builds the site with Jekyll on every push to `main`. There is no build of its own.

For a local preview (Ruby required): `bundle install`, then `bundle exec jekyll serve`. The `Gemfile` is only for that.

The fonts are Big Shoulders Display and Newsreader (SIL Open Font License, `assets/fonts/OFL.txt`), served from this site. Loading them from Google Fonts would hand every visitor's IP address to Google.
