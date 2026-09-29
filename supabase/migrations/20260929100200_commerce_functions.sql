-- =====================================================================
-- Commerce functions: checkout, in-store sales, order pipeline, payments,
-- stock (restock / adjust / stock-take), cash drawer, reports.
-- All run as security definer and check the caller's role themselves.
-- Prices always come from the database, never from the browser.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------
create or replace function private.variant_label(p_size text, p_colour text) returns text
language sql immutable as $$
  select nullif(concat_ws(' / ', p_size, p_colour), '')
$$;

-- Adds items to an order: locks each variant, checks stock, decrements it,
-- snapshots price + cost, writes the stock ledger. Returns the subtotal.
create or replace function private.add_order_items(p_order uuid, p_items jsonb, p_actor uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  it record;
  r record;
  v_item uuid;
  v_subtotal numeric := 0;
  v_lines integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invalid items';
  end if;
  for it in
    select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'quantity')::integer) as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1 -- consistent lock order avoids deadlocks
  loop
    if it.qty is null or it.qty < 1 or it.qty > 99 then
      raise exception 'Invalid quantity';
    end if;
    select v.id, v.size, v.colour, v.sku, v.selling_price, v.quantity_on_hand, v.is_active, v.image_url,
           p.id as product_id, p.name as product_name, p.is_active as product_active, p.images[1] as product_image
      into r
      from public.product_variants v join public.products p on p.id = v.product_id
     where v.id = it.variant_id
       for update of v;
    if not found or not r.is_active or not r.product_active then
      raise exception 'An item is no longer available. Please review your bag.';
    end if;
    if r.quantity_on_hand < it.qty then
      raise exception '% % — only % left in stock', r.product_name,
        coalesce('(' || private.variant_label(r.size, r.colour) || ')', ''), r.quantity_on_hand;
    end if;

    update public.product_variants set quantity_on_hand = quantity_on_hand - it.qty where id = r.id;

    insert into public.order_items (order_id, variant_id, product_id, product_name, variant_label, sku, image_url,
                                    quantity, unit_price, line_total)
    values (p_order, r.id, r.product_id, r.product_name, private.variant_label(r.size, r.colour), r.sku,
            coalesce(r.image_url, r.product_image), it.qty, r.selling_price, r.selling_price * it.qty)
    returning id into v_item;

    insert into public.order_item_costs (order_item_id, unit_cost)
    values (v_item, coalesce((select cost_price from public.variant_costs where variant_id = r.id), 0));

    insert into public.stock_adjustments (variant_id, quantity_delta, quantity_after, reason, order_id, adjusted_by)
    values (r.id, -it.qty, r.quantity_on_hand - it.qty, 'sale', p_order, p_actor);

    v_subtotal := v_subtotal + r.selling_price * it.qty;
    v_lines := v_lines + 1;
  end loop;
  if v_lines = 0 then
    raise exception 'Your bag is empty';
  end if;
  return v_subtotal;
end $$;

-- Puts an order's items back on the shelf.
create or replace function private.restock_order(p_order uuid, p_reason public.stock_reason)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record;
  v_after integer;
begin
  for it in select variant_id, quantity from public.order_items where order_id = p_order and variant_id is not null order by variant_id loop
    update public.product_variants set quantity_on_hand = quantity_on_hand + it.quantity
     where id = it.variant_id returning quantity_on_hand into v_after;
    insert into public.stock_adjustments (variant_id, quantity_delta, quantity_after, reason, order_id, adjusted_by)
    values (it.variant_id, it.quantity, v_after, p_reason, p_order, auth.uid());
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------
create or replace function public.coupon_discount(p_code text, p_subtotal numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  c public.coupons;
begin
  select * into c from public.coupons where code = upper(trim(p_code));
  if not found or not c.is_active then
    raise exception 'That code isn''t valid';
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    raise exception 'That code isn''t active yet';
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    raise exception 'That code has expired';
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    raise exception 'That code has been fully redeemed';
  end if;
  if p_subtotal < c.min_subtotal then
    raise exception 'Spend at least KES % to use this code', to_char(c.min_subtotal, 'FM999,999,990');
  end if;
  return least(p_subtotal, case when c.type = 'percent' then round(p_subtotal * c.value / 100) else c.value end);
end $$;

-- ---------------------------------------------------------------------
-- Online checkout (called by the server with the service role)
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_customer uuid,
  p_items jsonb,
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text,
  p_delivery_method public.delivery_method,
  p_zone uuid,
  p_address text,
  p_notes text,
  p_payment public.payment_method,
  p_coupon text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.store_settings;
  z public.delivery_zones;
  v_order public.orders;
  v_subtotal numeric;
  v_discount numeric := 0;
  v_fee numeric := 0;
  v_code text := nullif(upper(trim(p_coupon)), '');
begin
  select * into s from public.store_settings where id = 1;

  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_phone), '') = '' then
    raise exception 'Enter your name and phone number';
  end if;
  if p_delivery_method not in ('courier', 'pickup') then
    raise exception 'Choose delivery or pickup';
  end if;
  if p_payment = 'cash' then
    raise exception 'Choose a payment method';
  end if;
  if p_payment = 'mpesa' and not s.mpesa_enabled then raise exception 'M-Pesa is currently unavailable'; end if;
  if p_payment = 'card' and not s.card_enabled then raise exception 'Card payments are currently unavailable'; end if;
  if p_delivery_method = 'pickup' and not s.pickup_enabled then raise exception 'Pickup is currently unavailable'; end if;

  if p_delivery_method = 'courier' then
    select * into z from public.delivery_zones where id = p_zone and is_active;
    if not found then raise exception 'Choose a delivery area'; end if;
    if coalesce(trim(p_address), '') = '' then raise exception 'Enter a delivery address'; end if;
    v_fee := z.fee;
  end if;
  if p_payment = 'cod' and (not s.cod_enabled or p_delivery_method <> 'courier' or not z.cod_allowed) then
    raise exception 'Cash on delivery isn''t available for this area';
  end if;

  insert into public.orders (channel, customer_id, contact_name, contact_phone, contact_email, delivery_method,
                             delivery_zone_id, delivery_zone_name, delivery_address, delivery_notes,
                             payment_method, payment_status, subtotal, total)
  values ('online', p_customer, trim(p_contact_name), trim(p_contact_phone), nullif(trim(p_contact_email), ''),
          p_delivery_method, z.id, z.name, nullif(trim(p_address), ''), nullif(trim(p_notes), ''),
          p_payment, case when p_payment = 'cod' then 'unpaid' else 'pending' end::public.payment_status, 0, 0)
  returning * into v_order;

  v_subtotal := private.add_order_items(v_order.id, p_items, p_customer);

  if v_code is not null then
    perform 1 from public.coupons where code = v_code for update;
    v_discount := public.coupon_discount(v_code, v_subtotal);
    update public.coupons set used_count = used_count + 1 where code = v_code;
  end if;
  if s.free_delivery_threshold is not null and v_subtotal - v_discount >= s.free_delivery_threshold then
    v_fee := 0;
  end if;

  update public.orders set subtotal = v_subtotal, discount_total = v_discount, coupon_code = v_code,
         delivery_fee = v_fee, total = v_subtotal - v_discount + v_fee
   where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (v_order.id, 'placed', 'Order placed online', p_customer);

  -- Cash on delivery needs action now; paid methods alert staff once payment lands.
  if p_payment = 'cod' then
    perform private.notify_roles(array['owner', 'sales_manager']::public.app_role[], 'new_order',
      'New order ' || v_order.order_number, 'Cash on delivery · KES ' || to_char(v_order.total, 'FM999,999,990'),
      '/dashboard/orders/' || v_order.id);
  end if;

  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number, 'total', v_order.total,
                            'tracking_token', v_order.tracking_token, 'payment_method', v_order.payment_method);
end $$;

-- ---------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------
-- Gateway confirmed a payment (M-Pesa callback / Paystack webhook). Service role only. Idempotent.
create or replace function public.settle_payment(p_payment uuid, p_receipt text, p_raw jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
  o public.orders;
begin
  select * into pay from public.payments where id = p_payment for update;
  if not found then raise exception 'Unknown payment'; end if;
  if pay.status = 'paid' then
    return jsonb_build_object('order_id', pay.order_id, 'already', true);
  end if;
  update public.payments set status = 'paid', paid_at = now(), raw = p_raw,
         mpesa_receipt = case when method = 'mpesa' then coalesce(p_receipt, mpesa_receipt) else mpesa_receipt end,
         reference = coalesce(p_receipt, reference)
   where id = p_payment;
  update public.orders set payment_status = 'paid' where id = pay.order_id returning * into o;

  if o.status = 'cancelled' then
    -- Paid after the order had expired: staff must refund or reinstate it.
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
    'KES ' || to_char(pay.amount, 'FM999,999,990') || ' for ' || o.order_number || coalesce(' (' || p_receipt || ')', ''),
    '/dashboard/orders/' || o.id);
  return jsonb_build_object('order_id', o.id, 'already', false);
end $$;

create or replace function public.fail_payment(p_payment uuid, p_raw jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
begin
  select * into pay from public.payments where id = p_payment for update;
  if not found or pay.status in ('paid', 'failed') then return; end if;
  update public.payments set status = 'failed', raw = p_raw where id = p_payment;
  update public.orders set payment_status = 'failed' where id = pay.order_id and payment_status = 'pending';
end $$;

-- Staff record a payment by hand (COD cash, M-Pesa code sent to the till, card slip).
create or replace function public.mark_order_paid(p_order uuid, p_method public.payment_method, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.payment_status = 'paid' then raise exception 'This order is already paid'; end if;
  if o.status in ('cancelled', 'returned') then raise exception 'This order was cancelled'; end if;
  if p_method = 'mpesa' and coalesce(trim(p_reference), '') = '' then
    raise exception 'Enter the M-Pesa confirmation code';
  end if;
  insert into public.payments (order_id, amount, method, status, reference, mpesa_receipt, received_by, paid_at)
  values (o.id, o.total, p_method, 'paid', nullif(upper(trim(p_reference)), ''),
          case when p_method = 'mpesa' then upper(trim(p_reference)) end, auth.uid(), now());
  update public.payments set status = 'failed' where order_id = o.id and status = 'pending';
  update public.orders set payment_status = 'paid', handled_by = coalesce(handled_by, auth.uid()) where id = o.id;
  perform private.log_audit('payment_recorded', 'orders', o.id::text,
    jsonb_build_object('payment_status', o.payment_status),
    jsonb_build_object('payment_status', 'paid', 'method', p_method, 'reference', p_reference, 'amount', o.total));
end $$;

create or replace function public.refund_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for the refund'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.payment_status <> 'paid' then raise exception 'Only paid orders can be refunded'; end if;
  if o.status not in ('cancelled', 'returned') then
    raise exception 'Cancel or return the order first so stock is restored';
  end if;
  update public.orders set payment_status = 'refunded', refund_reason = trim(p_reason), refunded_by = auth.uid(),
         refunded_at = now() where id = o.id;
  update public.payments set status = 'refunded' where order_id = o.id and status = 'paid';
  perform private.log_audit('order_refunded', 'orders', o.id::text,
    jsonb_build_object('payment_status', o.payment_status),
    jsonb_build_object('payment_status', 'refunded', 'reason', p_reason, 'amount', o.total));
end $$;

-- ---------------------------------------------------------------------
-- Order pipeline
-- ---------------------------------------------------------------------
create or replace function public.update_order_status(p_order uuid, p_status public.order_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_allowed text[];
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;

  v_allowed := case o.status
    when 'placed' then array['confirmed', 'cancelled']
    when 'confirmed' then array['packed', 'cancelled']
    when 'packed' then case when o.delivery_method = 'courier'
                            then array['out_for_delivery', 'cancelled'] else array['ready_for_pickup', 'cancelled'] end
    when 'out_for_delivery' then array['delivered', 'returned', 'cancelled']
    when 'ready_for_pickup' then array['collected', 'cancelled']
    when 'delivered' then array['returned']
    when 'collected' then case when o.channel = 'in_store' then array['cancelled', 'returned'] else array['returned'] end
    else array[]::text[] end;
  if not (p_status::text = any (v_allowed)) then
    raise exception 'Can''t move an order from % to %', replace(o.status::text, '_', ' '), replace(p_status::text, '_', ' ');
  end if;
  if p_status = 'confirmed' and o.payment_method in ('mpesa', 'card') and o.payment_status <> 'paid' then
    raise exception 'Wait for payment before confirming (or record the payment manually)';
  end if;
  if p_status in ('cancelled', 'returned') and coalesce(trim(p_note), '') = '' then
    raise exception 'Give a reason';
  end if;

  update public.orders set
    status = p_status,
    handled_by = case when channel = 'online' then coalesce(handled_by, auth.uid()) else handled_by end,
    void_reason = case when p_status = 'cancelled' then trim(p_note) else void_reason end,
    voided_by = case when p_status = 'cancelled' then auth.uid() else voided_by end,
    voided_at = case when p_status = 'cancelled' then now() else voided_at end
  where id = o.id;

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (o.id, p_status, nullif(trim(p_note), ''), auth.uid());

  if p_status = 'cancelled' then
    perform private.restock_order(o.id, 'void');
    perform private.log_audit('order_voided', 'orders', o.id::text,
      jsonb_build_object('status', o.status, 'total', o.total), jsonb_build_object('status', p_status, 'reason', p_note));
  elsif p_status = 'returned' then
    perform private.restock_order(o.id, 'return');
    perform private.log_audit('order_returned', 'orders', o.id::text,
      jsonb_build_object('status', o.status, 'total', o.total), jsonb_build_object('status', p_status, 'reason', p_note));
  end if;

  -- Rider handed over the goods and collected cash.
  if p_status = 'delivered' and o.payment_method = 'cod' and o.payment_status <> 'paid' then
    insert into public.payments (order_id, amount, method, status, received_by, paid_at)
    values (o.id, o.total, 'cod', 'paid', auth.uid(), now());
    update public.orders set payment_status = 'paid' where id = o.id;
  end if;
end $$;

-- Customers can cancel their own order before it is paid or confirmed.
create or replace function public.cancel_my_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order and customer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'placed' or o.payment_status = 'paid' then
    raise exception 'This order is already being processed. Contact us to change it.';
  end if;
  update public.orders set status = 'cancelled', void_reason = 'Cancelled by customer', voided_at = now() where id = o.id;
  update public.payments set status = 'failed' where order_id = o.id and status = 'pending';
  insert into public.order_status_history (order_id, status, note, changed_by) values (o.id, 'cancelled', 'Cancelled by customer', auth.uid());
  perform private.restock_order(o.id, 'void');
end $$;

-- Discount on an unpaid online order (e.g. agreed on the phone), within the staff member's limit.
create or replace function public.apply_order_discount(p_order uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_limit numeric;
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for the discount'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.payment_status = 'paid' or o.status in ('cancelled', 'returned', 'delivered', 'collected') then
    raise exception 'Discounts can only be applied before payment';
  end if;
  v_limit := case when public.is_owner() then 100 else (select discount_limit_pct from public.staff where user_id = auth.uid()) end;
  if p_amount < 0 or p_amount > o.subtotal then raise exception 'Invalid discount'; end if;
  if p_amount > round(o.subtotal * coalesce(v_limit, 0) / 100, 2) then
    raise exception 'Your discount limit is % of the order', coalesce(v_limit, 0) || '%';
  end if;
  update public.orders set discount_total = p_amount, discount_reason = trim(p_reason), discount_by = auth.uid(),
         total = subtotal - p_amount + delivery_fee where id = o.id;
  perform private.log_audit('discount_override', 'orders', o.id::text,
    jsonb_build_object('discount_total', o.discount_total, 'total', o.total),
    jsonb_build_object('discount_total', p_amount, 'total', o.subtotal - p_amount + o.delivery_fee, 'reason', p_reason));
end $$;

-- ---------------------------------------------------------------------
-- In-person "quick sale" (barcode POS)
-- ---------------------------------------------------------------------
create or replace function public.record_in_store_sale(
  p_items jsonb,
  p_payment public.payment_method,
  p_discount numeric default 0,
  p_discount_reason text default null,
  p_reference text default null,
  p_amount_tendered numeric default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_await_stk boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_subtotal numeric;
  v_total numeric;
  v_limit numeric;
  v_session uuid;
  v_paid boolean;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_payment = 'cod' then raise exception 'Choose cash, M-Pesa or card'; end if;

  if p_payment = 'cash' then
    select id into v_session from public.cash_sessions where staff_id = auth.uid() and status = 'open';
    if v_session is null then raise exception 'Open your cash drawer before taking cash'; end if;
  end if;
  v_paid := not (p_payment = 'mpesa' and p_await_stk);
  if p_payment = 'mpesa' and not p_await_stk and coalesce(trim(p_reference), '') = '' then
    raise exception 'Enter the M-Pesa confirmation code, or send a payment prompt';
  end if;

  insert into public.orders (channel, contact_name, contact_phone, status, delivery_method, payment_method,
                             payment_status, subtotal, total, handled_by, cash_session_id)
  values ('in_store', nullif(trim(p_customer_name), ''), nullif(trim(p_customer_phone), ''), 'collected', 'in_store',
          p_payment, case when v_paid then 'paid' else 'pending' end::public.payment_status, 0, 0, auth.uid(), v_session)
  returning * into o;

  v_subtotal := private.add_order_items(o.id, p_items, auth.uid());

  p_discount := coalesce(p_discount, 0);
  if p_discount < 0 or p_discount > v_subtotal then raise exception 'Invalid discount'; end if;
  if p_discount > 0 then
    v_limit := case when public.is_owner() then 100 else (select discount_limit_pct from public.staff where user_id = auth.uid()) end;
    if p_discount > round(v_subtotal * coalesce(v_limit, 0) / 100, 2) then
      raise exception 'Your discount limit is % of the sale', coalesce(v_limit, 0) || '%';
    end if;
    if coalesce(trim(p_discount_reason), '') = '' then raise exception 'Give a reason for the discount'; end if;
  end if;
  v_total := v_subtotal - p_discount;

  if p_payment = 'cash' and p_amount_tendered is not null and p_amount_tendered < v_total then
    raise exception 'Cash received is less than the total';
  end if;

  update public.orders set subtotal = v_subtotal, discount_total = p_discount,
         discount_reason = case when p_discount > 0 then trim(p_discount_reason) end,
         discount_by = case when p_discount > 0 then auth.uid() end,
         total = v_total, amount_tendered = p_amount_tendered,
         change_given = case when p_amount_tendered is not null then p_amount_tendered - v_total end
   where id = o.id returning * into o;

  if v_paid then
    insert into public.payments (order_id, amount, method, status, reference, mpesa_receipt, received_by, payer_phone, paid_at)
    values (o.id, v_total, p_payment, 'paid', nullif(upper(trim(p_reference)), ''),
            case when p_payment = 'mpesa' then upper(trim(p_reference)) end, auth.uid(), nullif(trim(p_customer_phone), ''), now());
  end if;

  insert into public.order_status_history (order_id, status, note, changed_by)
  values (o.id, 'collected', 'In-store sale', auth.uid());

  if p_discount > 0 then
    perform private.log_audit('discount_override', 'orders', o.id::text, null,
      jsonb_build_object('discount_total', p_discount, 'subtotal', v_subtotal, 'reason', p_discount_reason));
  end if;

  return jsonb_build_object('id', o.id, 'order_number', o.order_number, 'total', o.total,
                            'change', o.change_given, 'payment_status', o.payment_status);
end $$;

-- ---------------------------------------------------------------------
-- Cash drawer
-- ---------------------------------------------------------------------
create or replace function public.open_cash_session(p_float numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  if exists (select 1 from public.cash_sessions where staff_id = auth.uid() and status = 'open') then
    raise exception 'Your drawer is already open';
  end if;
  insert into public.cash_sessions (staff_id, opening_float) values (auth.uid(), greatest(coalesce(p_float, 0), 0))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.close_cash_session(p_session uuid, p_counted numeric, p_notes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cs public.cash_sessions;
  v_expected numeric;
  v_diff numeric;
begin
  select * into cs from public.cash_sessions where id = p_session for update;
  if not found or cs.status <> 'open' then raise exception 'Drawer not found or already closed'; end if;
  if cs.staff_id <> auth.uid() and not public.is_manager() then raise exception 'Not allowed'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Enter the cash counted'; end if;

  select cs.opening_float + coalesce(sum(total), 0) into v_expected
    from public.orders
   where cash_session_id = cs.id and payment_method = 'cash' and payment_status = 'paid'
     and status not in ('cancelled', 'returned');
  v_diff := p_counted - v_expected;

  update public.cash_sessions set status = 'closed', closed_at = now(), expected_cash = v_expected,
         counted_cash = p_counted, discrepancy = v_diff, notes = nullif(trim(p_notes), '')
   where id = cs.id;

  if abs(v_diff) >= 1 then
    perform private.notify_roles(array['owner', 'sales_manager']::public.app_role[], 'cash_discrepancy',
      'Cash discrepancy',
      coalesce((select full_name from public.profiles where id = cs.staff_id), 'Staff') || '''s drawer is ' ||
        case when v_diff < 0 then 'short' else 'over' end || ' by KES ' || to_char(abs(v_diff), 'FM999,999,990'),
      '/dashboard/cash');
    perform private.log_audit('cash_discrepancy', 'cash_sessions', cs.id::text,
      jsonb_build_object('expected', v_expected), jsonb_build_object('counted', p_counted, 'difference', v_diff));
  end if;
  return jsonb_build_object('expected', v_expected, 'counted', p_counted, 'discrepancy', v_diff);
end $$;

-- ---------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------
create or replace function public.receive_stock(p_variant uuid, p_quantity integer, p_new_cost numeric default null, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v public.product_variants;
  v_after integer;
begin
  select * into v from public.product_variants where id = p_variant for update;
  if not found then raise exception 'Variant not found'; end if;
  if not public.is_manager() or not public.can_manage_product(v.product_id) then raise exception 'Not allowed'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Enter the quantity received'; end if;
  if p_new_cost is not null and not public.can_view_margins() then
    raise exception 'Only staff with margin access can set cost prices';
  end if;

  update public.product_variants set quantity_on_hand = quantity_on_hand + p_quantity where id = v.id
  returning quantity_on_hand into v_after;
  if p_new_cost is not null then
    insert into public.variant_costs (variant_id, cost_price) values (v.id, p_new_cost)
    on conflict (variant_id) do update set cost_price = excluded.cost_price;
  end if;
  insert into public.stock_adjustments (variant_id, quantity_delta, quantity_after, reason, note, new_cost_price, adjusted_by)
  values (v.id, p_quantity, v_after, 'restock', nullif(trim(p_note), ''), p_new_cost, auth.uid());
  perform private.log_audit('restock', 'product_variants', v.id::text,
    jsonb_build_object('quantity_on_hand', v.quantity_on_hand),
    jsonb_build_object('quantity_on_hand', v_after, 'received', p_quantity, 'new_cost_price', p_new_cost));
  return v_after;
end $$;

create or replace function public.adjust_stock(p_variant uuid, p_delta integer, p_reason public.stock_reason, p_note text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v public.product_variants;
  v_after integer;
begin
  select * into v from public.product_variants where id = p_variant for update;
  if not found then raise exception 'Variant not found'; end if;
  if not public.is_manager() or not public.can_manage_product(v.product_id) then raise exception 'Not allowed'; end if;
  if p_reason not in ('damage', 'loss', 'correction', 'return') then raise exception 'Choose a reason'; end if;
  if coalesce(p_delta, 0) = 0 then raise exception 'Enter a quantity'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Add a note explaining the adjustment'; end if;
  if v.quantity_on_hand + p_delta < 0 then raise exception 'Only % in stock', v.quantity_on_hand; end if;

  update public.product_variants set quantity_on_hand = quantity_on_hand + p_delta where id = v.id
  returning quantity_on_hand into v_after;
  insert into public.stock_adjustments (variant_id, quantity_delta, quantity_after, reason, note, adjusted_by)
  values (v.id, p_delta, v_after, p_reason, trim(p_note), auth.uid());
  perform private.log_audit('stock_adjustment', 'product_variants', v.id::text,
    jsonb_build_object('quantity_on_hand', v.quantity_on_hand),
    jsonb_build_object('quantity_on_hand', v_after, 'reason', p_reason, 'note', p_note));
  return v_after;
end $$;

-- Physical stock-take: snapshot expected quantities, scan/count, then apply.
create or replace function public.start_stock_count(p_title text, p_category uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  insert into public.stock_counts (title, category_id, started_by)
  values (coalesce(nullif(trim(p_title), ''), 'Stock count ' || to_char(now(), 'DD Mon YYYY')), p_category, auth.uid())
  returning id into v_id;
  insert into public.stock_count_lines (count_id, variant_id, expected)
  select v_id, v.id, v.quantity_on_hand
    from public.product_variants v join public.products p on p.id = v.product_id
   where v.is_active and (p_category is null or p.category_id = p_category);
  return v_id;
end $$;

create or replace function public.record_stock_count(p_count uuid, p_variant uuid, p_quantity integer, p_increment boolean default true)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_counted integer;
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  if not exists (select 1 from public.stock_counts where id = p_count and status = 'open') then
    raise exception 'This stock count is closed';
  end if;
  insert into public.stock_count_lines (count_id, variant_id, expected, counted, counted_by)
  values (p_count, p_variant, (select quantity_on_hand from public.product_variants where id = p_variant),
          greatest(p_quantity, 0), auth.uid())
  on conflict (count_id, variant_id) do update
    set counted = greatest(case when p_increment then coalesce(public.stock_count_lines.counted, 0) + p_quantity else p_quantity end, 0),
        counted_by = auth.uid(), updated_at = now()
  returning counted into v_counted;
  return v_counted;
end $$;

create or replace function public.complete_stock_count(p_count uuid, p_zero_uncounted boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_after integer;
  v_delta integer;
  v_changed integer := 0;
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  perform 1 from public.stock_counts where id = p_count and status = 'open' for update;
  if not found then raise exception 'This stock count is closed'; end if;

  for l in select * from public.stock_count_lines where count_id = p_count order by variant_id loop
    continue when l.counted is null and not p_zero_uncounted;
    -- Apply the difference found, so sales made during the count are preserved.
    v_delta := coalesce(l.counted, 0) - l.expected;
    continue when v_delta = 0;
    update public.product_variants set quantity_on_hand = greatest(quantity_on_hand + v_delta, 0)
     where id = l.variant_id returning quantity_on_hand into v_after;
    insert into public.stock_adjustments (variant_id, quantity_delta, quantity_after, reason, note, stock_count_id, adjusted_by)
    values (l.variant_id, v_delta, v_after, 'stock_take', 'Stock count', p_count, auth.uid());
    v_changed := v_changed + 1;
  end loop;

  update public.stock_counts set status = 'completed', completed_by = auth.uid(), completed_at = now() where id = p_count;
  perform private.log_audit('stock_count_completed', 'stock_counts', p_count::text, null,
    jsonb_build_object('variants_adjusted', v_changed));
  return v_changed;
end $$;

create or replace function public.cancel_stock_count(p_count uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  update public.stock_counts set status = 'cancelled' where id = p_count and status = 'open';
end $$;

-- Releases stock held by online orders whose M-Pesa/card payment never completed.
create or replace function public.expire_unpaid_orders(p_minutes integer default 45)
returns integer language plpgsql security definer set search_path = public as $$
declare
  o record;
  v_count integer := 0;
begin
  for o in
    select id from public.orders
     where channel = 'online' and status = 'placed' and payment_method in ('mpesa', 'card')
       and payment_status in ('unpaid', 'pending', 'failed')
       and placed_at < now() - make_interval(mins => p_minutes)
     for update skip locked
  loop
    update public.orders set status = 'cancelled', void_reason = 'Payment not completed', voided_at = now() where id = o.id;
    update public.payments set status = 'failed' where order_id = o.id and status = 'pending';
    insert into public.order_status_history (order_id, status, note) values (o.id, 'cancelled', 'Payment not completed in time');
    perform private.restock_order(o.id, 'void');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- Reports
-- "Counted" sales = paid and not cancelled/returned. Sales are net of
-- discounts and exclude delivery fees (passed through to the courier).
-- ---------------------------------------------------------------------
create or replace function public.report_sales_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_all boolean := public.is_manager();
  v_margins boolean := public.can_view_margins();
  r jsonb;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  with o as (
    select * from public.orders
     where placed_at >= p_from and placed_at < p_to and payment_status = 'paid'
       and status not in ('cancelled', 'returned') and (v_all or handled_by = auth.uid())
  ), c as (
    select coalesce(sum(oi.quantity * oic.unit_cost), 0) cost, coalesce(sum(oi.quantity), 0) items
      from public.order_items oi join o on o.id = oi.order_id
      left join public.order_item_costs oic on oic.order_item_id = oi.id
  )
  select jsonb_build_object(
    'sales', coalesce(sum(o.subtotal - o.discount_total), 0),
    'delivery_fees', coalesce(sum(o.delivery_fee), 0),
    'orders', count(*),
    'online_orders', count(*) filter (where o.channel = 'online'),
    'in_store_orders', count(*) filter (where o.channel = 'in_store'),
    'avg_order', coalesce(round(avg(o.subtotal - o.discount_total), 2), 0),
    'discounts', coalesce(sum(o.discount_total), 0),
    'items', (select items from c),
    'cost', case when v_margins then (select cost from c) end,
    'profit', case when v_margins then coalesce(sum(o.subtotal - o.discount_total), 0) - (select cost from c) end,
    'margin_pct', case when v_margins and coalesce(sum(o.subtotal - o.discount_total), 0) > 0
      then round((coalesce(sum(o.subtotal - o.discount_total), 0) - (select cost from c)) * 100 / sum(o.subtotal - o.discount_total), 1) end
  ) into r from o;
  return r;
end $$;

create or replace function public.report_sales_by_day(p_from timestamptz, p_to timestamptz)
returns table (day date, sales numeric, orders bigint, profit numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_all boolean := public.is_manager();
  v_margins boolean := public.can_view_margins();
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  return query
  with o as (
    select o.id, (o.placed_at at time zone 'Africa/Nairobi')::date d, o.subtotal - o.discount_total net
      from public.orders o
     where o.placed_at >= p_from and o.placed_at < p_to and o.payment_status = 'paid'
       and o.status not in ('cancelled', 'returned') and (v_all or o.handled_by = auth.uid())
  ), cost as (
    select oi.order_id, sum(oi.quantity * coalesce(oic.unit_cost, 0)) c
      from public.order_items oi left join public.order_item_costs oic on oic.order_item_id = oi.id
     where oi.order_id in (select id from o) group by oi.order_id
  ), days as (
    select generate_series((p_from at time zone 'Africa/Nairobi')::date,
                           ((p_to - interval '1 second') at time zone 'Africa/Nairobi')::date, interval '1 day')::date d
  )
  select days.d, coalesce(sum(o.net), 0)::numeric, count(o.id),
         case when v_margins then (coalesce(sum(o.net), 0) - coalesce(sum(cost.c), 0))::numeric end
    from days left join o on o.d = days.d left join cost on cost.order_id = o.id
   group by days.d order by days.d;
end $$;

create or replace function public.report_profit(p_from timestamptz, p_to timestamptz, p_group text default 'product', p_category uuid default null)
returns table (key text, label text, category text, units bigint, sales numeric, cost numeric, profit numeric, margin_pct numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_view_margins() then raise exception 'Profit reports need margin access'; end if;
  return query
  with lines as (
    select oi.product_id, oi.variant_id, oi.product_name, oi.variant_label, oi.sku, oi.quantity,
           oi.line_total * coalesce(1 - o.discount_total / nullif(o.subtotal, 0), 1) net,
           oi.quantity * coalesce(oic.unit_cost, 0) line_cost,
           p.category_id, c.name cat_name
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      left join public.order_item_costs oic on oic.order_item_id = oi.id
      left join public.products p on p.id = oi.product_id
      left join public.categories c on c.id = p.category_id
     where o.placed_at >= p_from and o.placed_at < p_to and o.payment_status = 'paid'
       and o.status not in ('cancelled', 'returned')
       and (p_category is null or p.category_id = p_category)
  ), g as (
    select case p_group when 'category' then coalesce(l.category_id::text, 'none')
                        when 'variant' then coalesce(l.variant_id::text, l.sku)
                        else coalesce(l.product_id::text, l.product_name) end k,
           max(case p_group when 'category' then coalesce(l.cat_name, 'Uncategorised')
                            when 'variant' then l.product_name || coalesce(' · ' || l.variant_label, '')
                            else l.product_name end) lbl,
           max(l.cat_name) cat,
           sum(l.quantity)::bigint u, round(sum(l.net), 2) s, round(sum(l.line_cost), 2) c
      from lines l group by 1
  )
  select g.k, g.lbl, g.cat, g.u, g.s, g.c, g.s - g.c,
         case when g.s > 0 then round((g.s - g.c) * 100 / g.s, 1) end
    from g order by g.s - g.c desc;
end $$;

create or replace function public.report_stock_valuation()
returns table (category_id uuid, category text, variants bigint, units bigint, cost_value numeric, retail_value numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_margins boolean := public.can_view_margins();
begin
  if not public.is_manager() then raise exception 'Not allowed'; end if;
  return query
  select c.id, c.name, count(v.id), coalesce(sum(v.quantity_on_hand), 0)::bigint,
         case when v_margins then coalesce(sum(v.quantity_on_hand * coalesce(vc.cost_price, 0)), 0) end,
         coalesce(sum(v.quantity_on_hand * v.selling_price), 0)
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join public.categories c on c.id = p.category_id
    left join public.variant_costs vc on vc.variant_id = v.id
   where v.is_active
   group by c.id, c.name
   order by 6 desc;
end $$;

create or replace function public.report_staff_performance(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, full_name text, role public.app_role, is_active boolean, orders bigint, sales numeric,
               avg_order numeric, items bigint, voided_sales bigint, voids_performed bigint, discounts numeric, last_sale timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_role public.app_role := public.my_role();
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  return query
  select p.id, p.full_name, p.role, coalesce(s.is_active, true),
         count(o.id) filter (where o.counted),
         coalesce(sum(o.net) filter (where o.counted), 0),
         coalesce(round(avg(o.net) filter (where o.counted), 2), 0),
         coalesce((select sum(oi.quantity) from public.order_items oi join public.orders x on x.id = oi.order_id
                    where x.handled_by = p.id and x.placed_at >= p_from and x.placed_at < p_to
                      and x.payment_status = 'paid' and x.status not in ('cancelled', 'returned')), 0)::bigint,
         count(o.id) filter (where o.status = 'cancelled' and o.voided_by is not null),
         (select count(*) from public.orders x where x.voided_by = p.id and x.voided_at >= p_from and x.voided_at < p_to),
         coalesce((select sum(x.discount_total) from public.orders x where x.discount_by = p.id
                    and x.placed_at >= p_from and x.placed_at < p_to and x.status <> 'cancelled'), 0),
         max(o.placed_at)
    from public.profiles p
    left join public.staff s on s.user_id = p.id
    left join lateral (
      select x.id, x.status, x.voided_by, x.placed_at, x.subtotal - x.discount_total net,
             (x.payment_status = 'paid' and x.status not in ('cancelled', 'returned')) counted
        from public.orders x
       where x.handled_by = p.id and x.placed_at >= p_from and x.placed_at < p_to
    ) o on true
   where p.role in ('owner', 'sales_manager', 'sales_attendant')
     and (v_role = 'owner'
          or (v_role = 'sales_manager' and (p.id = auth.uid() or p.role = 'sales_attendant'))
          or p.id = auth.uid())
   group by p.id, p.full_name, p.role, s.is_active
   order by 6 desc;
end $$;

create or replace function public.report_top_products(p_from timestamptz, p_to timestamptz, p_limit integer default 8)
returns table (product_id uuid, name text, image_url text, units bigint, sales numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  return query
  select oi.product_id, max(oi.product_name), max(oi.image_url), sum(oi.quantity)::bigint,
         round(sum(oi.line_total * coalesce(1 - o.discount_total / nullif(o.subtotal, 0), 1)), 2)
    from public.order_items oi join public.orders o on o.id = oi.order_id
   where o.placed_at >= p_from and o.placed_at < p_to and o.payment_status = 'paid'
     and o.status not in ('cancelled', 'returned')
     and (public.is_manager() or o.handled_by = auth.uid())
   group by oi.product_id
   order by 4 desc
   limit p_limit;
end $$;

create or replace function public.dashboard_counts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'needs_action', (select count(*) from public.orders where channel = 'online'
                       and status in ('placed', 'confirmed', 'packed')
                       and (payment_status = 'paid' or payment_method = 'cod')),
    'in_transit', (select count(*) from public.orders where status in ('out_for_delivery', 'ready_for_pickup')),
    'awaiting_payment', (select count(*) from public.orders where status = 'placed' and payment_status in ('pending', 'unpaid', 'failed') and payment_method <> 'cod'),
    'low_stock', (select count(*) from public.product_variants where is_active and quantity_on_hand > 0 and quantity_on_hand <= low_stock_threshold),
    'out_of_stock', (select count(*) from public.product_variants where is_active and quantity_on_hand = 0),
    'pending_reviews', (select count(*) from public.reviews where status = 'pending'),
    'refunds_due', (select count(*) from public.orders where status in ('cancelled', 'returned') and payment_status = 'paid'),
    'unread', (select count(*) from public.notifications where user_id = auth.uid() and read_at is null)
  );
end $$;

-- ---------------------------------------------------------------------
-- Rate limiting (fixed window, shared across serverless instances)
-- ---------------------------------------------------------------------
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

-- ---------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.log_audit(text, text, text, jsonb, jsonb) to authenticated;
grant execute on all functions in schema private to service_role;

-- Server-only (service role)
revoke execute on function public.place_order(uuid, jsonb, text, text, text, public.delivery_method, uuid, text, text, public.payment_method, text) from public, anon, authenticated;
revoke execute on function public.coupon_discount(text, numeric) from public, anon, authenticated;
revoke execute on function public.settle_payment(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_payment(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.expire_unpaid_orders(integer) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.place_order(uuid, jsonb, text, text, text, public.delivery_method, uuid, text, text, public.payment_method, text) to service_role;
grant execute on function public.coupon_discount(text, numeric) to service_role;
grant execute on function public.settle_payment(uuid, text, jsonb) to service_role;
grant execute on function public.fail_payment(uuid, jsonb) to service_role;
grant execute on function public.expire_unpaid_orders(integer) to service_role;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- Signed-in users (each function checks the role itself)
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.mark_order_paid(uuid, public.payment_method, text)',
    'public.refund_order(uuid, text)',
    'public.update_order_status(uuid, public.order_status, text)',
    'public.cancel_my_order(uuid)',
    'public.apply_order_discount(uuid, numeric, text)',
    'public.record_in_store_sale(jsonb, public.payment_method, numeric, text, text, numeric, text, text, boolean)',
    'public.open_cash_session(numeric)',
    'public.close_cash_session(uuid, numeric, text)',
    'public.receive_stock(uuid, integer, numeric, text)',
    'public.adjust_stock(uuid, integer, public.stock_reason, text)',
    'public.start_stock_count(text, uuid)',
    'public.record_stock_count(uuid, uuid, integer, boolean)',
    'public.complete_stock_count(uuid, boolean)',
    'public.cancel_stock_count(uuid)',
    'public.report_sales_summary(timestamptz, timestamptz)',
    'public.report_sales_by_day(timestamptz, timestamptz)',
    'public.report_profit(timestamptz, timestamptz, text, uuid)',
    'public.report_stock_valuation()',
    'public.report_staff_performance(timestamptz, timestamptz)',
    'public.report_top_products(timestamptz, timestamptz, integer)',
    'public.dashboard_counts()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- Trigger functions are never called directly.
revoke execute on function public.variant_defaults(), public.product_variants_rollup(), public.guard_profile(),
  public.guard_variant(), public.variant_initial_stock(), public.audit_cost(), public.audit_product(),
  public.audit_row(), public.low_stock_alert(), public.prepare_review(), public.review_rollup(),
  public.touch_updated_at()
from anon;
