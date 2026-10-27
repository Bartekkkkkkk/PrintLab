import nodemailer from 'nodemailer';

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}
function money(value) {
  return Number(value).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł';
}
export async function sendPaidOrderEmail(order) {
  const host=process.env.SMTP_HOST;
  const port=Number(process.env.SMTP_PORT||587);
  const user=process.env.SMTP_USER;
  const pass=process.env.SMTP_PASSWORD;
  const from=process.env.SMTP_FROM;
  if(!host||!user||!pass||!from) throw new Error('Brakuje konfiguracji SMTP w Vercel.');
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Nieprawidłowy port SMTP.');
  const client=nodemailer.createTransport({
    host,port,secure:port===465,auth:{user,pass},
    requireTLS:port!==465,connectionTimeout:12000,greetingTimeout:12000,
    socketTimeout:16000
  });
  const address=order.delivery_address||{};
  const addressLine=[
    address.street,
    address.apartment?`lok. ${address.apartment}`:null,
    [address.postal_code,address.city].filter(Boolean).join(' ')
  ].filter(Boolean).join(', ');
  const lines=(Array.isArray(order.items)?order.items:[]);
  const rows=lines.map(line=>`<tr><td style="padding:10px 0;border-bottom:1px solid #eee">${esc(line.name)}${line.variant?' — '+esc(line.variant):''}<div style="color:#777;font-size:12px">Ilość: ${esc(line.quantity)}</div></td><td style="text-align:right;border-bottom:1px solid #eee">${esc(money((Number(line.unit_price)||0)*(Number(line.quantity)||0)))}</td></tr>`).join('');
  const shortId=String(order.id||'').slice(0,8).toUpperCase();
  const html=`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#181818"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:30px 12px"><table role="presentation" style="max-width:580px;width:100%;background:#fff;border-collapse:collapse"><tr><td style="padding:26px 30px;border-bottom:1px solid #eee;font-size:24px;font-weight:bold">Print<span style="color:#c62032">Lab</span></td></tr><tr><td style="padding:30px"><h1 style="font-size:25px;line-height:1.2;margin:0 0 15px">Dziękujemy za zamówienie!</h1><p style="font-size:15px;line-height:1.7;color:#555">Płatność została potwierdzona. Przygotowujemy Twoje produkty. Czas realizacji: <strong>2 dni robocze</strong> (przed wysyłką).</p><p style="font-size:14px"><strong>Numer zamówienia:</strong> ${esc(shortId)}</p><table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${rows}<tr><td style="padding:12px 0">InPost Kurier</td><td style="text-align:right">${esc(money(order.shipping_cost))}</td></tr><tr><td style="padding:12px 0;font-weight:bold;border-top:1px solid #ddd">Razem opłacono</td><td style="text-align:right;font-weight:bold;border-top:1px solid #ddd">${esc(money(order.total))}</td></tr></table><p style="margin-top:26px;font-size:14px"><strong>Dostawa: InPost Kurier</strong><br>${esc(order.recipient)}<br>${esc(addressLine)}<br>Telefon: ${esc(order.phone)}</p><p style="font-size:13px;line-height:1.6;color:#777">Po nadaniu przesyłki numer śledzenia będzie dostępny w Twoich zamówieniach.</p></td></tr></table></td></tr></table></body></html>`;
  const text=`PrintLab — dziękujemy za zamówienie ${shortId}!\nPłatność potwierdzona. Czas realizacji: 2 dni robocze.\nProdukty:\n${lines.map(x=>`${x.name} — ${x.variant||''}, ${x.quantity} szt., ${money(Number(x.unit_price)*Number(x.quantity))}`).join('\n')}\nDostawa InPost Kurier: ${money(order.shipping_cost)}\nŁącznie: ${money(order.total)}\nOdbiorca: ${order.recipient}\nAdres: ${addressLine}\nTelefon: ${order.phone}`;
  await client.sendMail({from,to:order.email,subject:`PrintLab — potwierdzenie zamówienia #${shortId}`,text,html});
}
