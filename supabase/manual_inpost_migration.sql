-- Wykonaj po checkout_migration.sql. Nie zmieniaj payment_status po stronie przeglądarki.
ALTER TABLE public.checkout_orders ENABLE ROW LEVEL SECURITY;
GRANT UPDATE(status, inpost_tracking) ON public.checkout_orders TO authenticated;
DROP POLICY IF EXISTS checkout_orders_admin_manual_shipping ON public.checkout_orders;
CREATE POLICY checkout_orders_admin_manual_shipping ON public.checkout_orders FOR UPDATE TO authenticated
USING ((SELECT private.is_admin()) AND payment_status='paid')
WITH CHECK ((SELECT private.is_admin()) AND payment_status='paid' AND status IN ('paid','in_production','shipped','delivered','cancelled'));
