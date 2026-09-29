-- Round 1 fixes found while testing.

-- A cancelled order that was never paid should read "Unpaid", not "Awaiting payment".
update public.orders set payment_status = 'unpaid'
 where status = 'cancelled' and payment_status in ('pending', 'failed');

create or replace function private.clear_unpaid_on_cancel() returns trigger
language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.payment_status in ('pending', 'failed') then
    new.payment_status := 'unpaid';
  end if;
  return new;
end $$;
create trigger orders_clear_unpaid_on_cancel before update of status on public.orders
  for each row execute function private.clear_unpaid_on_cancel();
grant execute on function private.clear_unpaid_on_cancel() to authenticated, service_role;

-- settle_payment: treat an empty receipt as "none".
create or replace function public.settle_payment(p_payment uuid, p_receipt text, p_raw jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
  o public.orders;
  v_receipt text := nullif(trim(p_receipt), '');
begin
  select * into pay from public.payments where id = p_payment for update;
  if not found then raise exception 'Unknown payment'; end if;
  if pay.status = 'paid' then
    return jsonb_build_object('order_id', pay.order_id, 'already', true);
  end if;
  update public.payments set status = 'paid', paid_at = now(), raw = p_raw,
         mpesa_receipt = case when method = 'mpesa' then coalesce(v_receipt, mpesa_receipt) else mpesa_receipt end,
         reference = coalesce(v_receipt, reference)
   where id = p_payment;
  update public.orders set payment_status = 'paid' where id = pay.order_id returning * into o;

  if o.status = 'cancelled' then
    perform private.notify_roles(array['owner', 'sales_manager']::public.app_role[], 'order_needs_action',
      'Payment on cancelled order ' || o.order_number,
      'KES ' || to_char(pay.amount, 'FM999,999,990') || ' received after the order was cancelled. Refund or re-create it.',
      '/dashboard/orders/' || o.id);
  elsif o.channel = 'online' then
    perform private.notify_roles(array['owner', 'sales_manager']::public.app_role[], 'new_order',
      'New order ' || o.order_number,
      'Paid · KES ' || to_char(o.total, 'FM999,999,990') || ' via ' || upper(o.payment_method::text) || ' — ready to confirm',
      '/dashboard/orders/' || o.id);
  end if;
  perform private.notify_roles(array['owner']::public.app_role[], 'payment_received', 'Payment received',
    'KES ' || to_char(pay.amount, 'FM999,999,990') || ' for ' || o.order_number || coalesce(' (' || v_receipt || ')', ''),
    '/dashboard/orders/' || o.id);
  return jsonb_build_object('order_id', o.id, 'already', false);
end $$;
revoke execute on function public.settle_payment(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.settle_payment(uuid, text, jsonb) to service_role;
