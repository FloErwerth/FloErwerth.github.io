# FloErwerth.github.io

The published side of documents that have to be true. Served at <https://floerwerth.github.io>.

## This repository is not the source

The privacy policy is written in the app's own repository, in both languages:

- `docs/legal/privacy-policy.md`
- `docs/legal/privacy-policy.de.md`

The files under `graviton/` here are those two, with the repository's internal header stripped and Jekyll front matter added. **Edit the source, then republish.** A change made only here is a policy that no longer describes the app it is about, which is the one kind of wrong that is a legal problem rather than a bug report. See ADR-0021 in the app repository.

## app-ads.txt

`app-ads.txt` sits at the root, and it has to. Google reads it from the root of the developer website named in the App Store listing, never from a subdirectory — that is why this is a user site and not a project site.

It has one line per AdMob account, because the apps do not share one: Graviton's and PUBG Stream Report's. Each publisher ID is the middle of the AdMob app ID in that app's `app.json`. Change one and change the other, or the file says nothing.

## Publishing

There is no build of its own. GitHub Pages runs Jekyll with a supported theme, so there is no Gemfile to keep working and nothing here to break on its own.
