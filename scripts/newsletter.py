#!/usr/bin/env python3
"""
Sends a weekly "new skills" digest email to all SkillAtlas subscribers.

Data comes from the live site (site/data/skills.json, published on the
data branch and served via GitHub Pages). No repo checkout needed.
Subscribers come from the SkillAtlas Google Apps Script endpoint.

Required environment variables:
  SMTP_USER            your Gmail address
  SMTP_APP_PASSWORD    the 16-character app password
  NEWSLETTER_ENDPOINT  the SkillAtlas Apps Script web-app URL (GET ?action=emails)
Optional:
  SITE_URL             linked in the header (default: the live site)
  SMTP_HOST            default smtp.gmail.com
  SMTP_PORT            465 (SSL, default) or 587 (STARTTLS)
Usage:
  python scripts/newsletter.py --dry-run     # write preview.html, send nothing
  python scripts/newsletter.py               # send for real
"""
import json
import os
import smtplib
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_URL = "https://videoedits4clients-crypto.github.io/skillatlas/data/skills.json"
SITE_URL = os.environ.get("SITE_URL") or "https://videoedits4clients-crypto.github.io/skillatlas/"
AIPULSE_URL = "https://videoedits4clients-crypto.github.io/ai-news-hub/"

SMTP_HOST = os.environ.get("SMTP_HOST") or "smtp.gmail.com"
SMTP_PORT = int(os.environ.get("SMTP_PORT") or "465")


# ---------------------------------------------------------------- data

def load_skills():
    with urllib.request.urlopen(DATA_URL, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def new_this_week(skills, days=7):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    fresh = [s for s in skills if s.get("firstSeen") and s["firstSeen"] >= cutoff]
    return fresh if fresh else []


def picks(fresh, n=8):
    """Newest-first picks with a usable one-line description."""
    seen_repos = set()
    out = []
    for s in sorted(fresh, key=lambda x: x.get("firstSeen", ""), reverse=True):
        if s["repo"] in seen_repos:            # one skill per repo keeps variety
            continue
        seen_repos.add(s["repo"])
        desc = " ".join((s.get("description") or "").split())
        if len(desc) > 150:
            desc = desc[:150].rsplit(" ", 1)[0].rstrip(",.;:!") + "…"
        out.append(s)
        if len(out) >= n:
            break
    return out


# ---------------------------------------------------------------- html

def esc(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def is_cold_start(n_fresh, total):
    """The atlas is brand new, so every skill looks 'new'. Detect that
    instead of shouting '+16,492 new skills' in the first edition."""
    return n_fresh > max(500, int(total * 0.25))


def build_html(fresh, top_picks, cat_counts, total_skills, cold=False):
    updated = datetime.now(timezone.utc).strftime("%B %d, %Y")

    if cold:
        head_pill = (f'<span style="display:inline-block;background:#eef0ff;color:#4f46e5;font-size:11.5px;'
                     f'font-weight:700;padding:6px 13px;border-radius:20px;margin:2px 3px;">'
                     f'{total_skills:,} skills catalogued</span>')
        intro = (f'SkillAtlas just finished its first full sweep of GitHub &#8212; '
                 f'<b style="color:#1c1b18;">{total_skills:,} AI-agent skills catalogued</b>, '
                 f'sorted by category and job. From next week this email reports only what is '
                 f'genuinely new. Here is the shape of the atlas as it stands.')
        grew_label = "&#128202; &nbsp;WHERE THE ATLAS IS DEEPEST"
        total_pill = ""
    else:
        head_pill = (f'<span style="display:inline-block;background:#eef0ff;color:#4f46e5;font-size:11.5px;'
                     f'font-weight:700;padding:6px 13px;border-radius:20px;margin:2px 3px;">'
                     f'+{len(fresh)} new skills</span>')
        intro = (f'GitHub published <b style="color:#1c1b18;">{len(fresh)} new AI-agent skills '
                 f'this week</b>. Here is where the ecosystem is growing, and the ones worth your time.')
        grew_label = "&#128202; &nbsp;WHERE THE ECOSYSTEM GREW"
        total_pill = (f'<span style="display:inline-block;background:#f3f1ec;color:#6d6a61;font-size:11.5px;'
                      f'font-weight:700;padding:6px 13px;border-radius:20px;margin:2px 3px;">'
                      f'{total_skills:,} in the atlas</span>')

    cat_rows = "".join(
        f'<tr><td style="padding:7px 0;border-bottom:1px solid #e9e6de;font-size:14px;color:#3c3a36;">{esc(c.title())}</td>'
        f'<td style="padding:7px 0;border-bottom:1px solid #e9e6de;text-align:right;font-weight:800;color:#4f46e5;font-size:14px;">+{n}</td></tr>'
        for c, n in cat_counts)

    pick_cards = ""
    for s in top_picks:
        pick_cards += f"""
      <div style="background:#ffffff;border:1px solid #e5e2da;border-radius:12px;padding:14px 16px;margin-bottom:8px;">
        <div style="font-size:11px;color:#4f46e5;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;">{esc(s["category"])} &#183; {esc(s.get("firstSeen", ""))}</div>
        <div style="font-size:15px;font-weight:700;color:#1c1b18;margin-top:4px;">{esc(s["name"])}</div>
        <div style="font-size:13px;line-height:1.55;color:#6d6a61;margin-top:5px;">{esc(s.get("description", ""))}</div>
        <a href="https://github.com/{esc(s["repo"])}" style="display:inline-block;margin-top:9px;background:#eef0ff;color:#4f46e5;font-weight:700;font-size:12px;padding:6px 12px;border-radius:8px;text-decoration:none;">View on GitHub &#8594;</a>
      </div>"""

    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:26px 12px;background:#eef0f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b18;">
<div style="max-width:640px;margin:0 auto;background:#fbfaf8;border:1px solid #d9d6cf;border-radius:20px;overflow:hidden;">

  <div style="text-align:center;padding:38px 24px 24px;background:#ffffff;">
    <div style="font-size:42px;line-height:1;">&#129517;</div>
    <div style="font-size:32px;font-weight:800;color:#4f46e5;margin-top:10px;">Skill<b style="color:#1c1b18;">Atlas</b></div>
    <div style="color:#a29f96;font-size:12.5px;margin-top:7px;letter-spacing:2.5px;text-transform:uppercase;">Weekly skills report &#183; {updated}</div>
    <div style="margin-top:16px;">
      {head_pill}
      {total_pill}
    </div>
  </div>

  <div style="padding:0 18px;">
    <p style="font-size:14.5px;line-height:1.65;color:#3c3a36;margin:20px 2px 0;">
      {intro}</p>

    <div style="margin:26px 0 10px;">
      <div style="font-weight:800;font-size:14px;letter-spacing:1.5px;color:#4f46e5;">{grew_label}</div>
      <div style="margin-top:8px;border-top:1px solid #e5e2da;"></div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">{cat_rows}</table>
    </div>

    <div style="margin:28px 0 10px;">
      <div style="font-weight:800;font-size:14px;letter-spacing:1.5px;color:#4f46e5;">&#128142; &nbsp;GEMS WORTH INSTALLING</div>
      <div style="margin-top:8px;border-top:1px solid #e5e2da;"></div>
      <div style="margin-top:12px;">{pick_cards}</div>
    </div>

    <div style="text-align:center;padding:24px 0 8px;">
      <a href="{esc(SITE_URL)}" style="display:block;background:#4f46e5;color:#ffffff;font-weight:800;font-size:15px;
        padding:15px 10px;border-radius:12px;text-decoration:none;">&#129517; Browse all {total_skills:,} skills</a>
      <div style="margin-top:12px;font-size:13px;">
        <a href="{esc(AIPULSE_URL)}" style="color:#4f46e5;font-weight:700;text-decoration:none;">&#9889; Also from us: AI Pulse &#8212; live AI news &#8594;</a>
      </div>
    </div>
    <div style="color:#a29f96;font-size:12px;text-align:center;padding:14px 24px 32px;line-height:1.7;">
      You're receiving this because you subscribed at SkillAtlas.<br>
      Skills belong to their authors &#8212; always review code before installing. Reply any time.
    </div>
  </div>
</div>
</body></html>"""


# ---------------------------------------------------------------- send

def get_subscribers(endpoint):
    url = endpoint + ("&" if "?" in endpoint else "?") + "action=emails"
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    return sorted({e.strip().lower() for e in data.get("emails", []) if e.strip()})


def send(sender, app_password, subject, html, subscribers, sender_name="SkillAtlas"):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{sender}>"
    msg["To"] = sender
    msg["Bcc"] = ", ".join(subscribers)
    msg.attach(MIMEText("Your email client doesn't support HTML. "
                        "Visit SkillAtlas to browse every AI skill.", "plain"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with (smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) if SMTP_PORT == 465
          else smtplib.SMTP(SMTP_HOST, SMTP_PORT)) as smtp:
        if SMTP_PORT != 465:
            smtp.starttls()
        smtp.login(sender, app_password)
        smtp.send_message(msg)


def main():
    dry = "--dry-run" in sys.argv
    payload = load_skills()
    skills = payload.get("skills", [])
    total = len(skills)

    fresh = new_this_week(skills)
    if not fresh:
        print("No new skills in the last 7 days — nothing to send.")
        return
    top = picks(fresh)
    cat_counts = Counter(s["category"] for s in fresh).most_common(6)
    cold = is_cold_start(len(fresh), total)
    html = build_html(fresh, top, cat_counts, total, cold=cold)

    if dry:
        (ROOT / "preview.html").write_text(html, encoding="utf-8")
        print(f"Dry run — {len(fresh)} new skills, wrote preview.html")
        return

    sender = os.environ.get("SMTP_USER")
    app_password = os.environ.get("SMTP_APP_PASSWORD")
    endpoint = os.environ.get("NEWSLETTER_ENDPOINT")
    if not (sender and app_password and endpoint):
        sys.exit("Set SMTP_USER, SMTP_APP_PASSWORD and NEWSLETTER_ENDPOINT env vars")

    subscribers = get_subscribers(endpoint)
    if not subscribers:
        print("No subscribers yet — nothing to send.")
        return

    if cold:
        subject = f"SkillAtlas is live: {total:,} AI skills catalogued"
    else:
        subject = (f"SkillAtlas weekly: {len(fresh)} new AI skills "
                   f"({datetime.now(timezone.utc).strftime('%b %d')})")
    send(sender, app_password, subject, html, subscribers)
    print(f"✅ Sent weekly digest to {len(subscribers)} subscribers")


if __name__ == "__main__":
    main()
