# PrintLab — sklep + panel administratora + Supabase (wersja 2)

Statyczny frontend przeznaczony do hostowania na GitHub + Vercel, z danymi przechowywanymi w Supabase. **Bez Node.js, npm, procesu kompilacji ani frameworka.**

## Co jest zaimplementowane

- Responsywny katalog produktów (duże monitory, laptopy, tablet, telefon), bez górnego szarego paska.
- Kategorie główne i podkategorie (na razie 1 poziom) tworzone i edytowane przez administratora.
- Produkty: nazwa, opis, kategoria, cena bazowa, zdjęcie, SKU, widoczność.
- Warianty/podprodukty: nazwa, kolor, rozmiar, cena, osobny SKU, osobne zdjęcie, stan magazynowy i widoczność.
- Dynamiczny katalog, filtrowanie, wyszukiwarka i sortowanie.
- Supabase Auth: rejestracja, logowanie, reset hasła, wylogowywanie.
- Baza PostgreSQL: profile klientów, adresy, kategorie, produkty, warianty, zamówienia i pozycje zamówień.
- Admin: tworzenie/edycja/usuwanie kategorii, produktów i wariantów, przegląd klientów i zamówień, zmiana statusu zamówień.
- Supabase Storage: zdjęcia produktów; wgrywanie ograniczone polityką RLS do administratora.
- RLS: publiczny odczyt opublikowanych produktów, prywatne profile i zamówienia, edycja katalogu tylko przez administratora.
- Koszyk przeglądarkowy z wyborem wariantu, wyświetlaniem dostępności i cen.

**Płatności i InPost nie są jeszcze zintegrowane.** Przycisk finalizacji zamówienia jest celowo wyłączony. W bazie jest bezpieczna struktura do zamówień, ale nie istnieje jeszcze mechanizm checkoutu ani automatyczne wystawianie etykiet. Nie ma pozorowanych potwierdzeń zapłaty.

## Jednorazowa konfiguracja Supabase (nie da się jej pominąć przy nowej bazie)

1. Utwórz projekt w https://supabase.com/dashboard .
2. Otwórz **SQL Editor** → **New query**. Skopiuj **cały** `supabase/schema.sql`, uruchom go jeden raz (`Run`). Spowoduje to utworzenie tabel, uprawnień RLS i bucketu zdjęć `product-images`.
3. Otwórz **Project Settings → API** / **Connect** i skopiuj:
   - Project URL, np. `https://abcdef.supabase.co`
   - klucz **publishable** (`sb_publishable_...`) lub legacy `anon` key.
4. Edytuj **dwie** linie w `config.js`. URL i klucz publishable/anon mogą występować w kodzie frontendowym — chronią je polityki RLS. **Nigdy** nie wpisuj `service_role` ani `sb_secret_...`.
5. W **Authentication → Providers → Email** włącz Email Auth; ustal, czy wymagane będzie potwierdzenie e-mail.
6. W **Authentication → URL Configuration** dodaj domenę produkcyjną Vercel do dozwolonych redirect URLs (np. `https://twojsklep.vercel.app/**`) i ustaw odpowiedni Site URL. Jest to potrzebne do linków logowania/resetu hasła.
7. Opublikuj stronę i **zarejestruj swoje konto**. Jeśli wymagane, potwierdź e-mail.
8. Uruchom w SQL Editor skrypt `supabase/seed-admin.sql` **po zastąpieniu `WPISZ_EMAIL_ADMINA` swoim e-mailem**. Upewnij się, że zwraca jeden wiersz.
9. Wyloguj się i zaloguj ponownie (lub odśwież stronę). Pojawi się zakładka **Panel administratora**.
10. Utwórz kategorię → opcjonalną podkategorię → produkt → jego warianty. Produkty staną się widoczne w sklepie.

## GitHub + Vercel

1. Rozpakuj ZIP, wgraj **zawartość** folderu (nie jego katalog nadrzędny) do **głównego katalogu** repozytorium.
2. Vercel → Add New → Project → Import Git Repository.
3. Framework Preset: **Other**. Build Command: **pusty / skip build**, Output Directory: `.` (katalog projektu). Root Directory: `./`.
4. Deploy. Nie potrzebujesz `npm install` ani `package.json`. W tej paczce nie ma `vercel.json` ani komend budowania, aby uniknąć konfliktów konfiguracji.
5. Kolejny push do `main` automatycznie aktualizuje witrynę.

Jeśli stary projekt Vercel wciąż zgłasza **`Cannot read properties of undefined (reading 'fsPath')`**, jest to problem etapu budowania projektu, nie samego HTML. Zalecane jest zaimportowanie tego repozytorium do **nowego projektu Vercel** z presetem Other i bez kroku kompilacji — tego błędu nie da się zagwarantowanie naprawić kodem strony, jeśli pochodzi z konfiguracji usługi.

## Bezpieczeństwo i kolejne kroki

- Konta i hasła obsługuje Supabase Auth — hasła nigdy nie trafiają do naszych własnych tabel ani `localStorage`.
- W Supabase **anon/publishable key jest publiczny**. Dostęp do danych ogranicza RLS. Po wykonaniu SQL warto przetestować uprawnienia kontem klienta i admina.
- Nie dodawaj bezpośrednio insertów do `orders` z przeglądarki ani nie pozwalaj frontendowi samemu ustalać ceny zamówienia. Checkout wymaga funkcji serwerowej lub Edge Function, która pobiera ceny z bazy, sprawdza dostępność i potwierdza płatność webhookiem operatora.
- Przy większym sklepie warto dodać historię operacji administracyjnych, kopie zapasowe, ograniczenia uploadów, usuwanie niewykorzystanych zdjęć i testy uprawnień.
- Uzupełnij prawdziwe dane kontaktowe, regulamin, politykę prywatności, politykę reklamacji i informacje o kosztach i terminach dostawy.
- W obecnej wersji adresy mają gotową tabelę i RLS; formularz książki adresowej oraz zapisywanie zamówień zostaną podłączone przy implementacji checkoutu.

## Pliki

`index.html` – układ, `styles.css` – RWD i wygląd, `app.js` – logika sklepu/admina, `config.js` – publiczne połączenie Supabase, `assets/logo.png` – Twoje logo, `supabase/schema.sql` – struktura i RLS, `supabase/seed-admin.sql` – pierwsze konto admina.

## Aktualizacja widoczności Moich zamówień
Przycisk `Moje zamówienia` w menu desktop i mobilnym jest domyślnie ukryty. Pokazuje się tylko zalogowanemu użytkownikowi po sprawdzeniu sesji Supabase. Po wylogowaniu znika, a użytkownik znajdujący się na stronie zamówień zostaje przeniesiony do sklepu.


## Zmiana w tej wersji
Usunięto osobną stronę „Ustawienia konta” i formularz edycji profilu. Przycisk w nagłówku po zalogowaniu ma nazwę „Wyloguj się” i wylogowuje konto. Logowanie, rejestracja, Moje zamówienia (tylko po zalogowaniu) i panel administratora pozostają.


## Ulepszenia logowania i wiadomości (ta aktualizacja)
- Po zalogowaniu przycisk w nagłówku to **Wyloguj** (wylogowuje jednym kliknięciem). Nie ma strony ani formularza „Ustawienia konta”.
- `Moje zamówienia` widoczne tylko dla zalogowanych.
- Rejestracja przekazuje `emailRedirectTo`, a reset hasła `redirectTo` z bieżącego bezpiecznego adresu HTTPS sklepu.
- Wysłanie maila z localhost jest blokowane i pokazuje wyjaśnienie, aby uniknąć przypadkowych błędnych linków.
- Po wejściu przez link resetowania hasła sklep pokazuje formularz ustawienia nowego hasła.
- Dwa gotowe szablony w `supabase/email-templates/`.

### OBOWIĄZKOWE ustawienie linków w Supabase (nie da się zmienić samą paczką HTML)
1. Sprawdź ostateczny adres sklepu np. `https://printlab-twojanazwa.vercel.app`.
2. Supabase Dashboard → Authentication → URL Configuration: **Site URL** ustaw dokładnie na adres produkcyjny HTTPS. Usuń domyślne `http://localhost:3000`.
3. W **Redirect URLs** dodaj `https://printlab-twojanazwa.vercel.app/**` (zamień na prawdziwą domenę). Dodatkowe domeny produkcyjne dodaj osobno.
4. Authentication → Email Templates → **Confirm signup**: wklej zawartość `supabase/email-templates/potwierdzenie-konta.html`. Dla **Reset password** użyj `reset-hasla.html`. Zapisz oba szablony.
5. Zachowaj dokładnie `{{ .ConfirmationURL }}` w szablonach; to link Supabase weryfikujący token.
6. Przetestuj rejestrację nowego konta i reset hasła z produkcyjnego adresu HTTPS.
7. Jeśli zobaczysz link localhost po tych zmianach, sprawdź Site URL, listę Redirect URLs oraz czy użytkownik nie kliknął starego maila.
