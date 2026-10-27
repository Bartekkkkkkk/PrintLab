# PrintLab — strona statyczna na Vercel (bez instalacji)

## GitHub + Vercel

1. Usuń pliki starej wersji ze swojego repozytorium GitHub (zwłaszcza `package.json`, stary `vercel.json`, pliki konfiguracji frameworków i katalogi `src`, `public` jeśli były z poprzednich wersji).
2. Wgraj pliki z tego archiwum **do katalogu głównego repozytorium**.
3. Vercel automatycznie wykryje zmianę na GitHub i spróbuje wdrożyć stronę. Jeżeli istniejący projekt Vercel ma błędną konfigurację lub zmienne środowiskowe, sam kod nie gwarantuje naprawy. W takim przypadku najszybciej utworzyć NOWY projekt Vercel przez import repozytorium z ustawieniami domyślnymi.
4. Alternatywa bez GitHub: wrzuć ZIP na https://vercel.com/drop — to osobny projekt, bez wcześniejszego ustawienia budowania.

W paczce nie ma `package.json`, zależności npm ani komendy budowania. `vercel.json` ustawia framework `Other`, pomija build i publikuje katalog główny.

## Co działa

- Strona skupiona na brelokach w stylistyce Twojego zrzutu ekranu, z logo PrintLab.
- Przykładowe produkty, filtrowanie, wyszukiwanie, sortowanie i koszyk (localStorage).
- Interaktywne podglądy i responsywność.

## Czego jeszcze nie ma

To frontend demonstracyjny, **nie sklep gotowy do sprzedaży**. Logowanie, rejestracja, panel admina, prawdziwe zamówienia, płatności i InPost wymagają osobnej implementacji. Produkty, ceny, kontakt i grafiki są przykładowe i należy je zastąpić prawdziwymi przed sprzedażą.
