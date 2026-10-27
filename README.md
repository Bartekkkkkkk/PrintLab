# PrintLab — InPost + płatności online (Stripe)

## Co dostajesz
- Koszyk → dane odbiorcy → InPost Geowidget do wyboru Paczkomatu → płatność Stripe Checkout.
- Zapis zamówienia po stronie serwera Vercel na podstawie cen odczytanych z Supabase.
- Webhook Stripe z weryfikacją podpisu potwierdza zapłatę (nie sam powrót użytkownika).
- Zakładka „Moje zamówienia” czyta bezpieczną tabelę `checkout_orders`.
- RLS: klient widzi tylko swoje zamówienia, admin wszystkie.

## Konfiguracja krok po kroku
1. Supabase → SQL Editor: uruchom **tylko** `supabase/checkout_migration.sql` (nie stary schema.sql).
2. Vercel → Project → Settings → Environment Variables, dodaj (Production, Preview wg potrzeb):
   - `SUPABASE_URL` — Project URL Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` — tajny service_role/secret *tylko w Vercel*, nie w repozytorium.
   - `STRIPE_SECRET_KEY` — `sk_test_...` na testy, potem `sk_live_...`.
   - `STRIPE_WEBHOOK_SECRET` — `whsec_...` dla endpointu webhook na właściwej domenie.
   - `PUBLIC_SITE_URL` — np. `https://twojsklep.vercel.app`.
   - `INPOST_SHIPPING_GROSZE` — koszt przesyłki w groszach (np. `1499` = 14,99 zł), zgodny z ofertą.
3. Stripe Dashboard → Developers → Webhooks → Dodaj endpoint `https://TWOJA-DOMENA/api/stripe-webhook`.
   Zaznacz `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
   Skopiuj **Signing secret** webhooka do `STRIPE_WEBHOOK_SECRET` w Vercel.
4. Stripe Dashboard → Payment methods: aktywuj **card, BLIK, Przelewy24** o ile konto/operator umożliwia je dla PLN. Integracja żąda `card`, `blik`, `p24`; gdy konto ich nie obsługuje, sesja zwróci błąd — skontaktuj się z operatorem.
5. InPost: załóż/otwórz konto Manager Paczek, pozyskaj **token Geowidget** przypisany do domeny. W `checkout-config.js` wpisz go zamiast `WPISZ_TOKEN_GEOWIDGET` (token widgetu jest publiczny).
6. Wgraj pliki do repozytorium GitHub i wdroż na Vercel. Zostaw Framework Preset Other. Vercel automatycznie instaluje zależności z `package.json` i udostępnia `/api/*`.
7. W Stripe ustaw najpierw klucze testowe i wykonaj zakup testowy, potem sprawdź `checkout_orders` w Supabase i `Moje zamówienia`.
8. Dopiero po przetestowaniu webhooków, refundacji i sprawdzeniu dostępności produktu przełącz Stripe na live.

## Co jest gotowe, a co wymaga osobnej aktywacji
- Gotowe w kodzie: wybór punktu InPost, kalkulacja kwoty po stronie serwera, hostowana strona płatności, odbiór webhooka i zapis statusu zamówienia.
- **Nie ma jeszcze automatycznego wystawiania ani zakupu etykiet InPost!** Do tego potrzebny jest ShipX/Shipping API, token organizacji i parametry nadania. Sam Geowidget wybiera punkt odbioru.
- **Brak rezerwacji stanu magazynowego podczas płatności:** przy równoczesnych zakupach trzeba wdrożyć atomową rezerwację towaru przed uruchomieniem realnej sprzedaży.
- Koszt dostawy ustala administrator przez env `INPOST_SHIPPING_GROSZE`; nie jest automatycznie pobierany z InPost.
- Nie udostępniaj `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` ani `STRIPE_WEBHOOK_SECRET` w publicznych plikach. 
- Nie aktywuj prawdziwej sprzedaży, dopóki nie wykonasz transakcji testowych i nie sprawdzisz webhooka, stanów magazynowych, obsługi reklamacji, zwrotów i zamówień.
