// Google Apps Script — the free "mini backend" for the SkillAtlas newsletter signup.
//
// Handles: signup POST → store email → send styled welcome email.
// Also exposes: GET ?action=emails (subscriber list) and ?action=count.
//
// After editing this file: Deploy → Manage deployments → ✏ Edit →
// New version → Deploy, then re-authorize if a new permission is asked.

var SHEET_NAME = "Sheet1";

var SITE_URL = "https://videoedits4clients-crypto.github.io/skillatlas/";
var AIPULSE_URL = "https://videoedits4clients-crypto.github.io/ai-news-hub/";

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["timestamp", "email"]);
  }
  return sheet;
}

// ------------------------------------------------------ welcome email
// Design: matches SkillAtlas itself — warm cream page, indigo accent, 🧭.
// All emoji are HTML entities (never literal) so Gmail never mojibakes them.

function welcomeHtml_() {
  return ""
  + "<div style='margin:0;padding:26px 12px;background:#eef0f6;'>"
  + "<div style='max-width:600px;margin:0 auto;background:#fbfaf8;border:1px solid #d9d6cf;border-radius:20px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1b18;'>"

  // ===== header =====
  + "<div style='text-align:center;padding:40px 24px 26px;background:#ffffff;'>"
  + "<div style='font-size:44px;line-height:1;'>&#129517;</div>"
  + "<div style='font-size:32px;font-weight:800;color:#4f46e5;margin-top:10px;'>Skill<b style='color:#1c1b18;'>Atlas</b></div>"
  + "<div style='color:#a29f96;font-size:12.5px;margin-top:6px;letter-spacing:2px;text-transform:uppercase;'>Every AI skill on GitHub, decoded weekly</div>"
  + "</div>"

  // ===== hero card =====
  + "<div style='padding:0 16px;'>"
  + "<div style='background:#eef0ff;border:1px solid #d8dbff;border-radius:16px;padding:26px 28px;'>"
  + "<div style='font-size:22px;font-weight:800;color:#1c1b18;'>Welcome aboard! &#127881;</div>"
  + "<p style='font-size:15px;line-height:1.65;color:#3c3a36;margin:10px 0 0;'>"
  + "You just joined people who get <b style='color:#1c1b18;'>one sharp email every Monday</b> &#8212; "
  + "every skill added to GitHub that week, sorted and explained, plus hand-picked gems worth installing. No spam, ever.</p>"
  + "</div>"

  // ===== what you get =====
  + "<div style='color:#4f46e5;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin:24px 2px 12px;'>&#128073; What lands in your inbox</div>"
  + "<table width='100%' cellpadding='0' cellspacing='0'><tr>"
  + "<td width='50%' style='padding:0 6px 12px 0;'>"
  +   "<div style='background:#ffffff;border:1px solid #e5e2da;border-radius:12px;padding:16px;'>"
  +   "<div style='font-size:22px;'>&#10024;</div>"
  +   "<div style='font-weight:700;color:#1c1b18;font-size:14px;margin-top:6px;'>New this week</div>"
  +   "<div style='color:#8a867c;font-size:12.5px;line-height:1.5;margin-top:3px;'>Every skill published since last Monday</div></div>"
  + "</td>"
  + "<td width='50%' style='padding:0 0 12px 6px;'>"
  +   "<div style='background:#ffffff;border:1px solid #e5e2da;border-radius:12px;padding:16px;'>"
  +   "<div style='font-size:22px;'>&#128202;</div>"
  +   "<div style='font-weight:700;color:#1c1b18;font-size:14px;margin-top:6px;'>Where it's growing</div>"
  +   "<div style='color:#8a867c;font-size:12.5px;line-height:1.5;margin-top:3px;'>Which categories gained the most skills</div></div>"
  + "</td>"
  + "</tr><tr>"
  + "<td width='50%' style='padding:0 6px 0 0;'>"
  +   "<div style='background:#ffffff;border:1px solid #e5e2da;border-radius:12px;padding:16px;'>"
  +   "<div style='font-size:22px;'>&#128142;</div>"
  +   "<div style='font-weight:700;color:#1c1b18;font-size:14px;margin-top:6px;'>Hand-picked gems</div>"
  +   "<div style='color:#8a867c;font-size:12.5px;line-height:1.5;margin-top:3px;'>New skills actually worth installing</div></div>"
  + "</td>"
  + "<td width='50%' style='padding:0 0 0 6px;'>"
  +   "<div style='background:#ffffff;border:1px solid #e5e2da;border-radius:12px;padding:16px;'>"
  +   "<div style='font-size:22px;'>&#128269;</div>"
  +   "<div style='font-weight:700;color:#1c1b18;font-size:14px;margin-top:6px;'>One-click install</div>"
  +   "<div style='color:#8a867c;font-size:12.5px;line-height:1.5;margin-top:3px;'>Every link opens ready to preview and install</div></div>"
  + "</td>"
  + "</tr></table>"
  + "</div>"

  // ===== primary CTA =====
  + "<div style='text-align:center;padding:28px 16px 6px;'>"
  + "<a href='" + SITE_URL + "' style='display:block;background:#4f46e5;color:#ffffff;font-weight:800;font-size:15px;padding:15px 10px;border-radius:12px;text-decoration:none;'>&#129517; Browse SkillAtlas &#8212; it's live now</a>"
  + "<div style='color:#a29f96;font-size:12.5px;margin-top:10px;'>16,000+ skills, refreshed twice a day &#8212; bookmark it.</div>"
  + "</div>"

  // ===== AI Pulse card =====
  + "<div style='background:#ffffff;border:1px solid #e5e2da;border-radius:14px;padding:20px;margin:24px 16px 0;'>"
  + "<table width='100%' cellpadding='0' cellspacing='0'><tr>"
  + "<td style='vertical-align:top;padding-right:14px;font-size:24px;'>&#9889;</td>"
  + "<td style='vertical-align:top;'>"
  + "<div style='font-weight:800;color:#1c1b18;font-size:14.5px;'>Also from us: AI Pulse</div>"
  + "<p style='color:#8a867c;font-size:13px;line-height:1.55;margin:6px 0 10px;'>"
  + "A live AI news feed tracking 35 sources &#8212; trending stories, model releases and funding moves, updated every 15 minutes.</p>"
  + "<a href='" + AIPULSE_URL + "' style='display:inline-block;background:#0e1116;color:#6ee7b7;font-weight:700;font-size:12.5px;padding:9px 16px;border-radius:9px;text-decoration:none;'>Open AI Pulse &#8594;</a>"
  + "</td></tr></table>"
  + "</div>"

  // ===== footer =====
  + "<div style='color:#a29f96;font-size:12px;text-align:center;padding:30px 24px 34px;line-height:1.7;'>"
  + "You're receiving this because you subscribed at SkillAtlas.<br>"
  + "Skills belong to their authors &#8212; always review code before installing. Reply any time &#8212; a human reads it."
  + "</div>"

  + "</div></div>";
}

function sendWelcome_(email) {
  MailApp.sendEmail({
    to: email,
    name: "SkillAtlas",                   // sender shows as "SkillAtlas", not the raw Gmail address
    subject: "Welcome to SkillAtlas - your weekly skills digest",
    body: "Welcome to SkillAtlas! Your weekly digest of new AI skills arrives every Monday.\n\n"
        + "Browse the atlas: " + SITE_URL + "\n"
        + "Also from us - AI Pulse (live AI news): " + AIPULSE_URL + "\n\n"
        + "- SkillAtlas",
    htmlBody: welcomeHtml_(),
  });
}

// ------------------------------------------------------ handlers

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var email = String(data.email || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json_({ ok: false, error: "invalid email" });
    }

    var sheet = getSheet_();

    // skip duplicates
    var emails = sheet.getRange(2, 2, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if (String(emails[i][0]).toLowerCase() === email) {
        return json_({ ok: true, duplicate: true });
      }
    }

    sheet.appendRow([new Date().toISOString(), email]);

    // welcome email — never blocks the signup itself
    try {
      sendWelcome_(email);
    } catch (mailErr) {
      // e.g. daily mail quota exceeded; the subscription is still saved
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// GET ?action=emails → { emails: [...] }   (used by the weekly newsletter script)
// GET ?action=count  → { count: n }
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "count";
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var values = lastRow > 1
    ? sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat()
    : [];
  if (action === "emails") {
    return json_({ emails: values.map(function (v) { return String(v); }) });
  }
  return json_({ count: values.length });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// TEST HELPER — select this in the Run ▶ dropdown and press Run.
// It sends the welcome email to your own account and triggers any
// missing authorization prompt. Delete it later if you want.
function testWelcomeEmail() {
  var me = Session.getActiveUser().getEmail();
  sendWelcome_(me);
  Logger.log("Welcome email sent to: " + me);
}
