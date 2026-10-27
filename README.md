# PrintLab — Stripe + ręczne InPost

## Zakupy
Klient loguje się, dodaje produkty do koszyka, samodzielnie wpisuje kod Paczkomatu InPost, podaje odbiorcę i telefon, a następnie płaci online przez Stripe Checkout. Nie potrzeba tokenu InPost Geowidget ani ShipX.

## Wdrożenie na Vercel
1. Wgraj wszystkie pliki do repozytorium GitHub i podłącz do projektu Vercel (framework Other).
2. Supabase SQL Editor: uruchom `supabase/checkout_migration.sql`, o ile jeszcze nie był uruchamiany, a następnie `supabase/manual_inpost_migration.sql`. Nie uruchamiaj starego `schema.sql`.
3. Vercel → Project Settings → Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`, `INPOST_SHIPPING_GROSZE` (np. `1499` = 14,99 PLN). Sekrety wyłącznie w Vercel!
4. Stripe: skonfiguruj webhook na `https://TWOJA_DOMENA/api/stripe-webhook`; zdarzenia: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Dodaj podpis webhooka do env.
5. W Stripe aktywuj karty i BLIK, jeśli dostępny dla Twojego typu konta. Nie wymuszamy P24. Jeśli Stripe nie obsługuje BLIK na Twoim koncie, usuń `blik` z `payment_method_types` w `api/checkout.js`.
6. Wdróż projekt ponownie. Wykonaj testową płatność i sprawdź status zamówienia w `checkout_orders`.

## Obsługa ręczna
- Panel admina → Zamówienia: po `payment_status=paid` odczytaj kod Paczkomatu, odbiorcę i telefon.
- Nadaj paczkę ręcznie w Managerze Paczek InPost (możesz korzystać jako osoba prywatna, jeśli usługa jest dostępna dla Twojego konta).
- Wpisz numer śledzenia i wybierz status Wysłane, a następnie Zapisz. Klient widzi tracking w zakładce Moje zamówienia.

## Ważne
Bez aktywnego konta Stripe i kluczy płatności Stripe NIE ZADZIAŁA. Dotyczy też wymagań weryfikacyjnych operatora. Nie aktywuj realnej sprzedaży przed przetestowaniem płatności i webhooka oraz wdrożeniem zabezpieczenia przed równoczesnym sprzedaniem ostatniej sztuki; obecnie brak atomowej rezerwacji magazynu. Obecny panel admina nie jest jeszcze systemem do kupowania etykiet. Zawsze weryfikuj status `payment_status=paid` przed nadaniem.
