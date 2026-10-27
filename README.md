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

## Korekta formularzy administratora
- Pole `Początkowy stan` jest usunięte; sklep nie wymaga stanów magazynowych.
- Usunięto wpisywanie adresu/URL zdjęcia zarówno dla produktu, jak i wariantu. Zdjęcia dodaje się wyłącznie poprzez przesłanie pliku.
- Podczas edycji bez wgrania nowego zdjęcia dotychczasowe zdjęcie pozostaje bez zmian.
- SKU to opcjonalny, unikalny kod wewnętrzny produktu/wariantu; nie jest stanem magazynowym.
- Czas realizacji pozostaje 2 dni robocze.

## Aktualizacja panelu
Usunięto pola SKU oraz adres/URL zdjęcia z formularzy produktów i wariantów. Zdjęcia wybiera się tylko z pliku. Edytowanie bez nowego pliku zachowuje dotychczasowe zdjęcie. SKU nie jest już wysyłane podczas zapisu; stare wartości w bazie pozostają bez zmian. Nie jest wymagana migracja SQL.

## Nowość: e-mail odbiorcy + automatyczne potwierdzenie
1. W SQL Editor Supabase uruchom `supabase/order_email_migration.sql`.
2. W Vercel → Project Settings → Environment Variables dodaj:
   - `SMTP_HOST` — np. `smtp.gmail.com`
   - `SMTP_PORT` — `587` (STARTTLS) lub `465` (SSL)
   - `SMTP_USER` — login SMTP
   - `SMTP_PASSWORD` — hasło aplikacji lub klucz SMTP (nie zwykłe hasło do Gmaila)
   - `SMTP_FROM` — potwierdzony adres nadawcy, np. `PrintLab <twoj-adres@gmail.com>`
3. Po uzupełnieniu zmiennych uruchom Redeploy.
4. W Stripe użyj trybu testowego i opłać zamówienie testowe. Po webhooku potwierdzającym `paid` e-mail zostanie wysłany na adres z formularza.
5. Sprawdź kolumnę `email_confirmation_sent_at` w `checkout_orders`. Brak daty oznacza brak potwierdzonej wysyłki.

**Uwaga:** Wiadomości transakcyjne są wysyłane przez SMTP Vercel, a nie przez szablony Supabase Auth. Błąd SMTP oznacza ponowne próby webhooka Stripe. Dane SMTP trzymaj wyłącznie w Vercel.

## Zmiana ceny produktu
Edycja ceny podstawowej automatycznie aktualizuje cenę domyślnego wariantu Standard. Ceny niestandardowych wariantów edytuje się osobno w zakładce Warianty.

## Naprawa Stripe Checkout (BLIK invalid)
Usunięto wymuszone `payment_method_types: [card, blik]` w `/api/checkout.js`. Stripe Checkout automatycznie wyświetla metody dostępne dla konta, kwoty, waluty i kraju. Metody włączysz w Stripe Dashboard → Settings → Payment methods. Jeśli BLIK jest niedostępny, trzeba go aktywować na koncie Stripe; sklep nie wymusi go sam. Po podmianie plików na GitHub i nowym wdrożeniu Vercel testuj w trybie testowym.

## Widoczność zamówień po płatności
W sekcji Moje zamówienia i panelu administratora wyświetlane są wyłącznie rekordy z `checkout_orders.payment_status = paid`. Nieudane, anulowane, porzucone lub oczekujące próby płatności nie są pokazywane. Techniczne rekordy `unpaid` pozostają w bazie, ponieważ powstają przed przekierowaniem do Stripe; umożliwiają powiązanie sesji płatności z zamówieniem. Dopiero zweryfikowany webhook Stripe oznacza zamówienie jako `paid`. Wcześniejszych rekordów nie usuwamy, aby nie zakłócić obsługi ewentualnych spóźnionych webhooków.
