# PrintLab — Stripe + InPost Kurier (ręczne nadawanie)

## Co działa
- Klient podaje imię i nazwisko, telefon, ulicę i numer domu, opcjonalny numer lokalu, kod pocztowy oraz miejscowość.
- Jedyna metoda dostawy: **InPost Kurier pod adres**. Nie ma wyboru Paczkomatu ani mapy.
- Płatność online pozostaje Stripe Checkout.
- Adres klienta zapisuje się w `checkout_orders.delivery_address` jako JSON.
- Panel administratora pokazuje adres i pozwala wpisać ręcznie numer śledzenia po płatności.
- Brak potrzeby tokenu InPost Geowidget / ShipX, bo przesyłki nadajesz ręcznie.

## Kolejność instalacji
1. W Supabase SQL Editor uruchom `supabase/checkout_migration.sql` (tylko jeśli jeszcze nie istnieje tabela `checkout_orders`).
2. W razie potrzeby uruchom `supabase/manual_inpost_migration.sql`.
3. ZAWSZE uruchom `supabase/courier_address_migration.sql` (dodaje pole adresu i dopuszcza zamówienia bez punktu InPost).
4. Wgraj pliki do repozytorium GitHub, zastępując dotychczasowe.
5. Sprawdź w Vercel zmienne: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`, `INPOST_SHIPPING_GROSZE`.
6. Uruchom Redeploy i wykonaj testowy zakup przez Stripe.
7. W panelu admina sprawdź, że zamówienie pokazuje adres. Nadaj przesyłkę kurierem InPost ręcznie i uzupełnij numer śledzenia.

## Ważne
- Koszt dostawy to kwota z `INPOST_SHIPPING_GROSZE` (w groszach), np. 1999 = 19,99 zł. Dopasuj ją do realnej ceny InPost Kurier.
- Stripe musi być poprawnie skonfigurowany. Nie umieszczaj tajnych kluczy na GitHubie.
- Produkcyjna sprzedaż wymaga sprawdzenia webhooków, regulaminu, polityki prywatności, reklamacji i zwrotów oraz aktualnych kosztów dostawy.

## Aktualizacja: bez stanów magazynowych, termin realizacji
- Przy wszystkich produktach i w oknie szczegółów widnieje **Czas realizacji: 2 dni robocze**.
- Usunięto wyświetlanie i edycję stanów magazynowych w sklepie i panelu administracyjnym.
- Checkout Stripe nie blokuje już wariantów z powodu ilości `stock`. Pozostawiono limit 20 sztuk danego wariantu na jedno zamówienie jako limit techniczny.
- Nie trzeba wykonywać nowego SQL ani usuwać kolumny `stock` z Supabase (stare dane zostają, ale aplikacja ich nie używa).
- Czas realizacji to deklarowany czas przygotowania zamówienia, nie termin doręczenia przez kuriera.
