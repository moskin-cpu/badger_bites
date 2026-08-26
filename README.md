# Badger Bites — GitHub Pages edition

A static UW–Madison dining recommender. It uses the public UW Housing Dining Nutrislice feed, ranks current menu items against temporary preferences, and works without accounts, cookies, databases, or browser storage.

## Publish on GitHub

1. Create a new GitHub repository.
2. Upload **the contents of this folder** to the repository root.
3. Open **Settings → Pages** and choose **GitHub Actions** as the source if GitHub has not selected it automatically.
4. The included workflow publishes the site after each push and refreshes menu data every three hours.

The public URL appears in the repository’s **Deployments** section after the first workflow finishes.

## Privacy

- No sign-in.
- No analytics or tracking.
- No cookies, database, or `localStorage`.
- Taste preferences exist only in the open tab and reset when the page reloads.

## How menu updates work

GitHub Actions runs `scripts/fetch_menus.py`, downloads the current two-week menu window from UW Housing Dining, and places a simplified snapshot in `data/menus.json`. The browser only reads that static file.

Menu and allergen information can change. Users should confirm medical dietary needs with UW Dining staff.
