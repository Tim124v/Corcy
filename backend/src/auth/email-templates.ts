const BASE_URL = process.env.FRONTEND_URL || 'https://connexy-com-frontend.vercel.app';

const baseStyle = `
  body { margin: 0; padding: 0; background: #0a0f1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrap { max-width: 520px; margin: 40px auto; background: #111827; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
  .header { background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .logo-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; }
  .logo-text { color: #fff; font-size: 22px; font-weight: 700; letter-spacing: 0.04em; margin: 0; }
  .logo-sub { color: rgba(255,255,255,0.4); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; margin: 4px 0 0; }
  .body { padding: 36px 40px; }
  h1 { color: #f1f5f9; font-size: 20px; font-weight: 600; margin: 0 0 12px; }
  p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
  .code-block { background: #0f172a; border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
  .code { color: #a5b4fc; font-size: 36px; font-weight: 700; letter-spacing: 0.18em; font-family: 'Courier New', monospace; }
  .code-hint { color: rgba(255,255,255,0.3); font-size: 12px; margin: 8px 0 0; }
  .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; margin: 8px 0 24px; }
  .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0; }
  .footer { padding: 20px 40px 28px; text-align: center; }
  .footer p { color: rgba(255,255,255,0.2); font-size: 12px; margin: 0; line-height: 1.8; }
  .footer a { color: rgba(99,102,241,0.6); text-decoration: none; }
  .warning { background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.2); border-radius: 8px; padding: 12px 16px; margin: 16px 0 0; }
  .warning p { color: #fbbf24; font-size: 13px; margin: 0; }
`;

function htmlWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${baseStyle}</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:14px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="white" opacity="0.9"/>
      </svg>
    </div>
    <p class="logo-text">CONNEXY</p>
    <p class="logo-sub">Private · Secure</p>
  </div>
  ${content}
  <div class="footer">
    <p>© ${new Date().getFullYear()} Connexy. Все права защищены.<br>
    <a href="${BASE_URL}">connexy.app</a> · 
    Вы получили это письмо потому что зарегистрированы в Connexy.</p>
  </div>
</div>
</body>
</html>`;
}

// ── Верификация email ──────────────────────────────────────────

export function verificationEmailHtml(code: string): string {
  return htmlWrapper(`
    <div class="body">
      <h1>Подтвердите ваш email</h1>
      <p>Для завершения регистрации введите код подтверждения:</p>
      <div class="code-block">
        <div class="code">${code}</div>
        <div class="code-hint">Код действителен 10 минут</div>
      </div>
      <p>Если вы не регистрировались в Connexy — просто проигнорируйте это письмо.</p>
      <div class="warning">
        <p>⚠ Никогда не передавайте этот код другим людям.</p>
      </div>
    </div>
  `);
}

export function verificationEmailText(code: string): string {
  return `Connexy — подтверждение email\n\nВаш код: ${code}\n\nКод действителен 10 минут.\nЕсли вы не регистрировались — проигнорируйте это письмо.`;
}

// ── Инвайт ────────────────────────────────────────────────────

export function inviteEmailHtml(inviteUrl: string, senderName?: string): string {
  const from = senderName ? `<strong style="color:#a5b4fc">${senderName}</strong>` : 'кто-то';
  return htmlWrapper(`
    <div class="body">
      <h1>Вас приглашают в Connexy</h1>
      <p>${from} приглашает вас присоединиться к приватной сети Connexy — безопасному мессенджеру с invite-only доступом.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${inviteUrl}" class="btn">Принять приглашение →</a>
      </div>
      <hr class="divider">
      <p style="font-size:13px;color:rgba(255,255,255,0.3)">Или скопируйте ссылку:</p>
      <div class="code-block" style="padding:14px 20px;">
        <div style="color:#6366f1;font-size:13px;word-break:break-all;font-family:monospace;">${inviteUrl}</div>
      </div>
      <div class="warning">
        <p>⏱ Приглашение ограничено по времени и количеству использований.</p>
      </div>
    </div>
  `);
}

export function inviteEmailText(inviteUrl: string, senderName?: string): string {
  const from = senderName ? `${senderName}` : 'кто-то';
  return `Connexy — приглашение\n\n${from} приглашает вас в Connexy.\n\nСсылка: ${inviteUrl}\n\nПриглашение ограничено по времени.`;
}

// ── Welcome ───────────────────────────────────────────────────

export function welcomeEmailHtml(userName: string): string {
  return htmlWrapper(`
    <div class="body">
      <h1>Добро пожаловать, ${userName}!</h1>
      <p>Ваш аккаунт в Connexy активирован. Вы в приватной сети — здесь только те, кого пригласили лично.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${BASE_URL}/dashboard" class="btn">Открыть Connexy →</a>
      </div>
      <hr class="divider">
      <p style="font-size:14px;color:#64748b;margin-bottom:8px;">Что можно сделать прямо сейчас:</p>
      <ul style="color:#64748b;font-size:14px;line-height:2;padding-left:20px;margin:0 0 20px;">
        <li>Загрузить фото профиля</li>
        <li>Пригласить близких людей</li>
        <li>Создать приватную комнату</li>
      </ul>
    </div>
  `);
}

export function welcomeEmailText(userName: string): string {
  return `Добро пожаловать в Connexy, ${userName}!\n\nВаш аккаунт активирован.\n\nОткрыть: ${BASE_URL}/dashboard`;
}

