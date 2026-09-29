-- Every 10 minutes, release stock held by online orders whose M-Pesa/card
-- payment was never completed (45-minute window). Falls back to the Vercel
-- cron route (/api/cron/maintenance) if pg_cron is unavailable.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-unpaid-orders', '*/10 * * * *', 'select public.expire_unpaid_orders(45)');
  perform cron.schedule('prune-rate-limits', '17 3 * * *', $q$delete from public.rate_limits where window_start < now() - interval '1 day'$q$);
exception when others then
  raise notice 'pg_cron unavailable (%); rely on /api/cron/maintenance', sqlerrm;
end $$;
