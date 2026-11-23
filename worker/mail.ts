import type { Lang } from '../src/core/lang';

/** The sign-in email, in the interface's language: a link for this device, a code for another one. */
interface Copy {
  subject: string;
  intro: string;
  button: string;
  code: string;
  expires: string;
  ignore: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    subject: 'your petitdoigt sign-in link',
    intro: 'Open this link to sign in to petitdoigt:',
    button: 'sign in',
    code: 'Or type this code on the device you want to use:',
    expires: 'The link and the code work once, for 15 minutes.',
    ignore: 'You did not ask for this? Ignore this email: nothing happens without the link.',
  },
  fr: {
    subject: 'ton lien de connexion petitdoigt',
    intro: 'Ouvre ce lien pour te connecter à petitdoigt :',
    button: 'me connecter',
    code: "Ou tape ce code sur l'appareil où tu veux jouer :",
    expires: 'Le lien et le code marchent une seule fois, pendant 15 minutes.',
    ignore: "Tu n'as rien demandé ? Ignore ce courriel : rien ne se passe sans le lien.",
  },
  de: {
    subject: 'dein anmeldelink für petitdoigt',
    intro: 'Öffne diesen Link, um dich bei petitdoigt anzumelden:',
    button: 'anmelden',
    code: 'Oder gib diesen Code auf dem Gerät ein, auf dem du spielen willst:',
    expires: 'Link und Code funktionieren einmal, 15 Minuten lang.',
    ignore: 'Du hast nichts angefordert? Ignoriere diese E-Mail: ohne den Link passiert nichts.',
  },
  es: {
    subject: 'tu enlace para entrar en petitdoigt',
    intro: 'Abre este enlace para entrar en petitdoigt:',
    button: 'entrar',
    code: 'O escribe este código en el dispositivo donde quieras jugar:',
    expires: 'El enlace y el código sirven una vez, durante 15 minutos.',
    ignore: '¿No lo pediste? Ignora este correo: sin el enlace no pasa nada.',
  },
};

const escape = (text: string): string => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

export function signInMail(lang: Lang, link: string, code: string): { subject: string; html: string; text: string } {
  const copy = COPY[lang] ?? COPY.en;
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:32px 16px;background:#f4f4f2;font-family:-apple-system,'Segoe UI',system-ui,Helvetica,Arial,sans-serif;color:#212227">
<div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="margin:0 0 20px;font-size:20px;font-weight:600;color:#212227">petitdoigt</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escape(copy.intro)}</p>
<p style="margin:0 0 28px"><a href="${escape(link)}" style="display:inline-block;background:#212227;color:#f8d95c;text-decoration:none;font-size:15px;padding:12px 20px;border-radius:8px">${escape(copy.button)}</a></p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#55585f">${escape(copy.code)}</p>
<p style="margin:0 0 24px;font-family:ui-monospace,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:0.08em">${spaced}</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#55585f">${escape(copy.expires)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#55585f">${escape(copy.ignore)}</p>
</div></body></html>`;
  const text = `${copy.intro}\n\n${link}\n\n${copy.code}\n\n${spaced}\n\n${copy.expires}\n${copy.ignore}\n`;
  return { subject: copy.subject, html, text };
}
