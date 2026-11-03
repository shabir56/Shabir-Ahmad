# Shabir Ahmad: Portfolio

Personal portfolio of Shabir Ahmad, an independent developer from Loralai, Balochistan, Pakistan.

**Live site:** https://shabir56.github.io/Shabir-Ahmad/

## Stack

Plain HTML, CSS and JavaScript. No frameworks and no build step, so the repository root is the site.

```
index.html        page content and structure
style.css         design tokens (dark and light themes), layout, components
script.js         theme toggle, mobile menu, active nav link, scroll reveal, orbit pause
assets/           portrait, project banners (WebP + JPEG fallback), favicon
.github/workflows/build.yml   unpacks site.zip into the repo if one is pushed
```

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

GitHub Pages serves the `main` branch from the repository root. Pushing to `main` publishes the site.

## Editing content

- **Text and links:** edit `index.html`. Each section has an `id` (`about`, `skills`, `projects`, `education`, `agriculture`, `interests`, `contact`) that the navigation links to.
- **Colors and fonts:** change the variables at the top of `style.css`. The dark theme is in `:root`, the light theme in `:root[data-theme="light"]`.
- **Images:** add WebP versions next to the originals and reference them with a `<picture>` element, as the existing project cards do.
- **Portrait orbits:** the planets circling the hero photo are pure CSS (`.orbit-1` to `.orbit-3` in `style.css`). Change `--period` to speed an orbit up or down and `--phase` to change where it starts. The animation pauses when scrolled off-screen and stays still for visitors who prefer reduced motion.
- **About section:** it opens on click. Add the `open` attribute to `<details id="about-details">` to show it expanded by default.
