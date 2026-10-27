-- Powiadomienie o potwierdzonej płatności; brak zmian w istniejących zamówieniach.
ALTER TABLE public.checkout_orders
ADD COLUMN IF NOT EXISTS email_confirmation_sent_at timestamptz;
