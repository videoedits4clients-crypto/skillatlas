# 🧭 SkillAtlas

A self-updating directory of Claude & AI-agent skills (`SKILL.md`). It scans GitHub twice a day, puts every skill into a plain-English category, and lets people search, preview, download a skill as a `.zip`, or copy a one-line install command.

**Hosting is free:** GitHub Actions does the updates and GitHub Pages serves the site. You don't need a server or a database.

---

## Put it online (one-time setup, about 10 minutes)

1. **Create a GitHub repo**, for example `skillatlas`. It can be public or private, but Pages on a private repo needs a paid plan.
2. **Push this folder** to it:
   ```bash
   git init && git add . && git commit -m "SkillAtlas"
   git branch -M main
   git remote add origin https://github.com/<you>/skillatlas.git
   git push -u origin main
   ```
3. **Turn on Pages:** go to the repo's **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. **Allow the bot to commit:** go to **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**.
5. **Run it once:** open the **Actions** tab, select **Update skills & deploy**, and click **Run workflow**. When it finishes, your site is at `https://<you>.github.io/skillatlas/`.

After that it updates itself every day at **02:17 and 14:17 UTC**. Each run updates the data, saves it to the `data` branch, and redeploys.

### Optional: a higher API limit
The built-in `GITHUB_TOKEN` handles about 1,000 API calls an hour, which is enough for the default settings. If you raise `maxRepos`, create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens) with public-repo read access and save it as the repo secret **`SKILLS_GH_TOKEN`**.

### Optional: a custom domain
In **Settings → Pages → Custom domain**, enter your domain and add the DNS record that GitHub shows you.

---

## How it works

```
GitHub ──► scripts/collect.mjs ──► site/data/skills.json ──► static site (site/)
             ▲  (runs twice daily in GitHub Actions)
config/sources.json
```

1. **Discover:** the collector starts with the seed repos, then adds GitHub topic searches (`claude-skills`, `agent-skills`, and others) and every repo linked from the well-known "awesome" lists.
2. **Filter:** it fetches stars, branch and license for all candidates in batched GraphQL calls. Forks and repos below `minStars` are dropped, and the top `maxRepos` are kept.
3. **Scan:** it reads one git tree per repo to find every `SKILL.md`, then reads each file's `name` and `description` from its frontmatter. Results are cached by file SHA, so later runs only download files that changed.
4. **Organize:** it assigns a category with keyword rules (`scripts/categories.mjs`), merges identical copies of a skill, and tracks when each skill was first seen (shown as the **New** badge) and how many stars each repo gained in the last week (used by the **Trending** sort).

### What visitors get
- Search in plain words: "make slides" also finds `pptx` skills.
- 15 categories, an official-or-community filter, and sorting by recommended, stars, newest, trending, or A–Z.
- A "start here" row of official and top community skills for newcomers.
- **🔑 Needs key / Optional key badges** naming the outside service a skill needs (OpenAI, Composio, ElevenLabs…), plus a **"No API key needed"** filter. This is a best guess from each SKILL.md's text (`scripts/requirements.mjs`), labelled on the site as automatic.
- A detail panel for each skill with a rendered `SKILL.md` preview, its file list, similar skills, and more skills from the same repo.
- **Download .zip**, built in the browser straight from GitHub's files. It's ready to upload to Claude's Settings → Capabilities → Skills.
- Copy-ready install commands for Claude Code, the plugin marketplace, and other agents.
- A Saved list that stays in the visitor's browser, shareable links, dark mode, and a mobile layout.
- A beginner guide and a short safety note.

---

## Customize

| Want to… | Edit |
|---|---|
| Add or remove sources, change star threshold | `config/sources.json` |
| Hide a repo | add `"owner/repo"` to `blockedRepos` |
| Mark another org as "Official" | `officialOwners` |
| Change categories or keywords | `scripts/categories.mjs` |
| Change update times | `cron` in `.github/workflows/update.yml` |
| Change look & text | `site/index.html`, `site/assets/styles.css` |

## Run locally

```bash
# 1. collect data (needs a GitHub token — `gh auth token` works if you use the GitHub CLI)
GITHUB_TOKEN=$(gh auth token) npm run collect

# 2. preview at http://localhost:4173
npm run dev
```

On Windows PowerShell: `$env:GITHUB_TOKEN = (gh auth token); npm run collect`.

## Built to run unattended

| Risk | What prevents it |
|---|---|
| Repo grows huge from twice-daily data commits | Data lives on a separate **`data`** branch that is replaced with a single commit each run. `main` holds only code. |
| GitHub hiccup wipes skills from the site | If a repo can't be scanned, its skills from the last run are kept. If the total drops by more than 40%, the run refuses to publish. |
| Failed run breaks the live site | Nothing deploys unless collection succeeds, so the site keeps the last good version. GitHub emails you about failed runs. |
| Half-written data file | Files are written to a temp file first, then swapped in. |
| GitHub disables the schedule after 60 days of inactivity | Each run calls the API to re-enable its own workflow. |
| GitHub Actions versions go out of date | Dependabot opens at most one small PR a month. Merge it when it shows up. |
| API rate limits | Retries with backoff. SKILL.md files are cached by SHA, so a run uses about 500 of the 1,000 API calls allowed per hour. |

**To force a refresh:** go to Actions → **Update skills & deploy** → Run workflow.
**To check the data:** browse the `data` branch.

## Notes
- Skills belong to their authors. SkillAtlas only links to them and doesn't host or review their code.
