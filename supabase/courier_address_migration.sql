-- Uruchom PO checkout_migration.sql oraz manual_inpost_migration.sql.
-- Dane starszych zamówień pozostają nienaruszone.
alter table public.checkout_orders
 add column if not exists delivery_address jsonb;
-- Poprzedni typ dostawy wymagał punktu, teraz klienci podają adres.
alter table public.checkout_orders
 alter column inpost_point drop not null;
-- Nie narzucamy NOT NULL adresu w bazie, bo starsze zamówienia mogły korzystać z Paczkomatów.
-- Backend nowych zamówień wymaga pełnego adresu.
