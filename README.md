# BR Modding

A static fan site for browsing Gorilla Tag mods (played on Quest via PC VR), hosted on GitHub Pages.

Catalog rule: no cheats, mod menus, or anything that affects other players in public lobbies.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**, set **Source** to "Deploy from a branch", and pick `main` / `/ (root)`.
3. Your site will be at `https://<username>.github.io/<repo>/`.

## Adding mods

Edit `mods.json`. Each entry has `name`, `game`, `category`, `author`, `version`, `updated` (YYYY-MM-DD), `description`, `tags` and `url`. Categories and games in the filters are built automatically from the data.

The included entries are examples. Replace them with real mods.

## Admin panel

Go to `admin.html` (linked in the footer). The login is **admin / 0000**.

From the panel you can add, edit and delete mods, then either:
- **Download mods.json** and commit it yourself, or
- **Publish to GitHub**: commits `mods.json` straight to the repo. This needs a fine-grained personal access token with *Contents: Read and write* on this repo.

Change the login:

```bash
node tools/set-password.js admin <new-password>
```

**Security note:** GitHub Pages is static, so the login runs in the browser. It keeps casual visitors out but is not real security. The password hash is public, and a short password like `0000` can be guessed instantly. Nobody can change the live catalog without your GitHub token, though.

## Customising the look

- **Profile picture:** `assets/avatar.webp`. Replace it with another square image to change it.
- **Name / tagline:** edit the `<h1>` and `.tagline` in `index.html`.
- **Colours:** change the variables at the top of `assets/style.css` (`--accent` is the red).
- Press `/` on the page to jump to search.
