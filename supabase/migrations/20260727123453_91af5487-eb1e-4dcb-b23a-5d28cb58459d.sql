REVOKE ALL ON FUNCTION public.reserve_photos(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_photos(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_entitlements() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_entitlements() TO service_role;