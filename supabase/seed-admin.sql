-- 1. Załóż konto w sklepie przez Rejestrację.
-- 2. Wstaw prawdziwy e-mail konta admina zamiast WPISZ_EMAIL_ADMINA.
-- 3. Uruchom to w Supabase → SQL Editor jako właściciel projektu.
insert into public.admins(user_id)
select id from auth.users where lower(email)=lower('WPISZ_EMAIL_ADMINA')
on conflict (user_id) do nothing;

-- Weryfikacja: zapytanie powinno zwrócić 1 wiersz.
select a.user_id, u.email from public.admins a join auth.users u on a.user_id=u.id;
