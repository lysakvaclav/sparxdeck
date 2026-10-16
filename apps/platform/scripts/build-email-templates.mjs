// Generates the Supabase Auth e-mail templates in supabase/templates/.
// Run with `node scripts/build-email-templates.mjs` after changing texts or layout,
// then upload them (see README: "Auth e-mails").
//
// Language: users store their UI locale in user metadata at sign-up
// ({{ .Data.locale }}); English is used when it is "en", Czech otherwise.
// Links point at /auth/callback with token_hash, which works across browsers.
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")),
  "..",
  "supabase",
  "templates",
);

const TEMPLATES = {
  confirmation: {
    type: "signup",
    cs: {
      heading: "Potvrďte svůj e-mail",
      body: "Děkujeme za registraci do SparxDecku. Potvrďte prosím, že tento e-mail patří vám.",
      cta: "Potvrdit e-mail",
      footnote: "Pokud jste se neregistrovali, tento e-mail můžete ignorovat.",
    },
    en: {
      heading: "Confirm your email",
      body: "Thanks for signing up for SparxDeck. Please confirm that this email address is yours.",
      cta: "Confirm email",
      footnote: "If you didn't sign up, you can ignore this email.",
    },
  },
  magic_link: {
    type: "magiclink",
    cs: {
      heading: "Přihlášení do SparxDecku",
      body: "Kliknutím na tlačítko se přihlásíte. Odkaz platí jen krátkou dobu a jde použít jednou.",
      cta: "Přihlásit se",
      footnote: "Pokud jste o přihlášení nežádali, tento e-mail můžete ignorovat.",
    },
    en: {
      heading: "Sign in to SparxDeck",
      body: "Click the button to sign in. The link is valid for a short time and can be used once.",
      cta: "Sign in",
      footnote: "If you didn't request this, you can ignore this email.",
    },
  },
  recovery: {
    type: "recovery",
    cs: {
      heading: "Obnova hesla",
      body: "Někdo požádal o nastavení nového hesla k vašemu účtu ve SparxDecku.",
      cta: "Nastavit nové heslo",
      footnote:
        "Pokud jste o obnovu nežádali, tento e-mail ignorujte. Vaše heslo zůstane beze změny.",
    },
    en: {
      heading: "Reset your password",
      body: "Someone asked to set a new password for your SparxDeck account.",
      cta: "Set a new password",
      footnote: "If you didn't ask for this, ignore this email. Your password stays the same.",
    },
  },
  email_change: {
    type: "email_change",
    cs: {
      heading: "Potvrďte změnu e-mailu",
      body: "Potvrďte prosím změnu přihlašovacího e-mailu ve SparxDecku na {{ .NewEmail }}.",
      cta: "Potvrdit změnu",
      footnote: "Pokud jste o změnu nežádali, nic nedělejte a změňte si heslo.",
    },
    en: {
      heading: "Confirm your new email",
      body: "Please confirm changing your SparxDeck sign-in email to {{ .NewEmail }}.",
      cta: "Confirm change",
      footnote: "If you didn't ask for this, do nothing and change your password.",
    },
  },
};

const SUBJECTS = {
  confirmation: "Potvrďte e-mail · Confirm your email | SparxDeck",
  magic_link: "Přihlášení · Sign in | SparxDeck",
  recovery: "Obnova hesla · Reset your password | SparxDeck",
  email_change: "Změna e-mailu · Confirm your new email | SparxDeck",
};

function block({ heading, body, cta, footnote }, link) {
  return `<tr><td style="padding:16px 32px 0;font-size:24px;line-height:1.25;letter-spacing:-0.02em;color:#111111">${heading}</td></tr>
        <tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#333333">${body}</td></tr>
        <tr><td style="padding:24px 32px">
          <a href="${link}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px">${cta}</a>
        </td></tr>
        <tr><td style="padding:0 32px 32px;font-size:13px;line-height:1.5;color:#6b6b6b">${footnote}</td></tr>`;
}

function render({ type, cs, en }) {
  const link = `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=${type}`;
  return `<!doctype html>
<html><body style="margin:0;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;color:#111111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px">
        <tr><td style="padding:32px 32px 8px;font-size:20px;letter-spacing:-0.02em">SparxDeck</td></tr>
        {{ if eq .Data.locale "en" }}
        ${block(en, link)}
        {{ else }}
        ${block(cs, link)}
        {{ end }}
      </table>
    </td></tr>
  </table>
</body></html>
`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const [name, template] of Object.entries(TEMPLATES)) {
  fs.writeFileSync(path.join(outDir, `${name}.html`), render(template));
}
fs.writeFileSync(path.join(outDir, "subjects.json"), JSON.stringify(SUBJECTS, null, 2) + "\n");
console.log(`Wrote ${Object.keys(TEMPLATES).length} templates to ${outDir}`);
