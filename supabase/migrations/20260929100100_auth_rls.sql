-- =====================================================================
-- Roles, sign-up, guard/audit triggers and row-level security.
-- Every table has RLS on. This project auto-grants new tables to anon,
-- so RLS (plus explicit revokes on sensitive tables) is the real wall.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role helpers (security definer so they can read profiles/staff under RLS)
-- ---------------------------------------------------------------------
create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
$$;

-- Owner, or an active sales manager / attendant.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    left join public.staff s on s.user_id = p.id
    where p.id = auth.uid()
      and (p.role = 'owner' or (p.role in ('sales_manager', 'sales_attendant') and coalesce(s.is_active, false)))
  )
$$;

-- Owner, or an active sales manager.
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    left join public.staff s on s.user_id = p.id
    where p.id = auth.uid()
      and (p.role = 'owner' or (p.role = 'sales_manager' and coalesce(s.is_active, false)))
  )
$$;

-- Cost prices, margins and profit: owner, or a manager the owner has granted it to.
create or replace function public.can_view_margins() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    left join public.staff s on s.user_id = p.id
    where p.id = auth.uid()
      and (p.role = 'owner' or (p.role = 'sales_manager' and coalesce(s.is_active, false) and coalesce(s.can_view_margins, false)))
  )
$$;

-- Owner, or an active manager assigned to this category (empty assignment = whole catalog).
create or replace function public.can_manage_category(p_category uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    left join public.staff s on s.user_id = p.id
    where p.id = auth.uid()
      and (
        p.role = 'owner'
        or (p.role = 'sales_manager' and coalesce(s.is_active, false)
            and (cardinality(s.assigned_category_ids) = 0 or p_category = any (s.assigned_category_ids)))
      )
  )
$$;

create or replace function public.can_manage_product(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_category((select category_id from public.products where id = p_product))
$$;

-- True when running as the database owner / service role / inside a vetted
-- security-definer function (i.e. NOT a direct API call from a browser).
create or replace function public.is_privileged() returns boolean
language sql stable as $$
  select current_user not in ('anon', 'authenticated')
$$;

-- Internal helpers live in a schema the REST API does not expose, so triggers
-- (running as the signed-in user) can call them but browsers cannot.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.log_audit(p_action text, p_table text, p_target text, p_prev jsonb, p_new jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, target_table, target_id, previous_value, new_value)
  values (auth.uid(), p_action, p_table, p_target, p_prev, p_new);
$$;

-- In-app notification to every active user holding one of the roles.
-- p_category limits managers to those assigned to that category.
create or replace function private.notify_roles(
  p_roles public.app_role[], p_type public.notification_type, p_title text, p_message text,
  p_link text default null, p_category uuid default null
) returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, target_role, type, title, message, link)
  select p.id, p.role, p_type, p_title, p_message, p_link
  from public.profiles p
  left join public.staff s on s.user_id = p.id
  where p.role = any (p_roles)
    and (p.role = 'owner' or coalesce(s.is_active, false))
    and (p_category is null or p.role <> 'sales_manager' or cardinality(s.assigned_category_ids) = 0
         or p_category = any (s.assigned_category_ids));
$$;

-- ---------------------------------------------------------------------
-- New auth user → profile (customer by default; roles are granted by the owner)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, marketing_opt_in)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users can edit their own profile, but never their own role.
create or replace function public.guard_profile() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and not public.is_privileged() and not public.is_owner() then
    raise exception 'Only the owner can change roles';
  end if;
  if new.role is distinct from old.role then
    perform private.log_audit('role_change', 'profiles', new.id::text,
      jsonb_build_object('role', old.role), jsonb_build_object('role', new.role));
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- ---------------------------------------------------------------------
-- Catalog guards + audit
-- ---------------------------------------------------------------------
-- Stock only moves through the stock functions (sale, restock, adjustment,
-- stock-take) so every movement lands in the ledger.
create or replace function public.guard_variant() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.quantity_on_hand <> old.quantity_on_hand and not public.is_privileged() then
      raise exception 'Stock levels change through restock / adjustment, not direct edits';
    end if;
    if new.barcode_value <> old.barcode_value and not public.is_privileged() then
      raise exception 'Barcodes cannot be changed once printed';
    end if;
    if new.selling_price <> old.selling_price then
      perform private.log_audit('price_change', 'product_variants', new.id::text,
        jsonb_build_object('selling_price', old.selling_price, 'sku', old.sku),
        jsonb_build_object('selling_price', new.selling_price, 'sku', new.sku));
    end if;
  end if;
  return new;
end $$;
create trigger product_variants_guard before update on public.product_variants
  for each row execute function public.guard_variant();

-- Opening stock entered when a variant is created goes into the ledger.
create or replace function public.variant_initial_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.quantity_on_hand > 0 then
    insert into public.stock_adjustments (variant_id, quantity_delta, quantity_after, reason, note, adjusted_by)
    values (new.id, new.quantity_on_hand, new.quantity_on_hand, 'initial', 'Opening stock', auth.uid());
  end if;
  return new;
end $$;
create trigger product_variants_initial_stock after insert on public.product_variants
  for each row execute function public.variant_initial_stock();

create or replace function public.audit_cost() returns trigger
language plpgsql as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' and new.cost_price <> old.cost_price then
    perform private.log_audit('cost_change', 'variant_costs', new.variant_id::text,
      jsonb_build_object('cost_price', old.cost_price), jsonb_build_object('cost_price', new.cost_price));
  end if;
  return new;
end $$;
create trigger variant_costs_audit before insert or update on public.variant_costs
  for each row execute function public.audit_cost();

create or replace function public.audit_product() returns trigger
language plpgsql as $$
begin
  if new.base_price <> old.base_price or new.compare_at_price is distinct from old.compare_at_price then
    perform private.log_audit('price_change', 'products', new.id::text,
      jsonb_build_object('base_price', old.base_price, 'compare_at_price', old.compare_at_price),
      jsonb_build_object('base_price', new.base_price, 'compare_at_price', new.compare_at_price));
  end if;
  if new.is_active <> old.is_active then
    perform private.log_audit(case when new.is_active then 'product_published' else 'product_hidden' end,
      'products', new.id::text, null, jsonb_build_object('name', new.name));
  end if;
  return new;
end $$;
create trigger products_audit before update on public.products for each row execute function public.audit_product();

-- Generic before/after audit for configuration tables.
create or replace function public.audit_row() returns trigger
language plpgsql as $$
begin
  perform private.log_audit(
    lower(tg_op) || '_' || tg_table_name, tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
             (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'user_id'),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger staff_audit after insert or update or delete on public.staff for each row execute function public.audit_row();
create trigger coupons_audit after insert or update or delete on public.coupons for each row execute function public.audit_row();
create trigger delivery_zones_audit after insert or update or delete on public.delivery_zones for each row execute function public.audit_row();
create trigger store_settings_audit after update on public.store_settings for each row execute function public.audit_row();
create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.audit_row();
create trigger products_delete_audit after delete on public.products for each row execute function public.audit_row();

-- Low stock alert when a variant crosses its threshold.
create or replace function public.low_stock_alert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_product record;
begin
  if new.quantity_on_hand <= new.low_stock_threshold and old.quantity_on_hand > old.low_stock_threshold and new.is_active then
    select name, category_id into v_product from public.products where id = new.product_id;
    perform private.notify_roles(
      array['owner', 'sales_manager']::public.app_role[], 'low_stock',
      case when new.quantity_on_hand = 0 then 'Sold out' else 'Low stock' end,
      v_product.name || coalesce(' · ' || new.size, '') || coalesce(' · ' || new.colour, '') ||
        ' — ' || new.quantity_on_hand || ' left (SKU ' || new.sku || ')',
      '/dashboard/inventory?q=' || new.sku, v_product.category_id);
  end if;
  return new;
end $$;
create trigger product_variants_low_stock after update of quantity_on_hand on public.product_variants
  for each row execute function public.low_stock_alert();

-- ---------------------------------------------------------------------
-- Reviews: force pending on write, mark verified purchases, keep ratings rolled up
-- ---------------------------------------------------------------------
-- Runs as the caller (not security definer) so is_privileged() can tell a
-- customer's write from a moderator's; customers can read their own orders.
create or replace function public.prepare_review() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_privileged() and not public.is_manager() then
    new.status := 'pending';
    if tg_op = 'UPDATE' then
      new.verified_purchase := old.verified_purchase;
      new.user_id := old.user_id;
      new.product_id := old.product_id;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.verified_purchase := exists (
      select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
      where o.customer_id = new.user_id and oi.product_id = new.product_id
        and o.payment_status = 'paid' and o.status not in ('cancelled', 'returned'));
    new.author_name := coalesce(new.author_name, (select split_part(coalesce(full_name, 'Customer'), ' ', 1) from public.profiles where id = new.user_id));
  end if;
  return new;
end $$;
create trigger reviews_prepare before insert or update on public.reviews for each row execute function public.prepare_review();

create or replace function public.review_rollup() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where product_id = v_product and status = 'approved'), 0),
    rating_count = (select count(*) from public.reviews where product_id = v_product and status = 'approved')
  where id = v_product;
  if tg_op = 'INSERT' then
    perform private.notify_roles(array['owner', 'sales_manager']::public.app_role[], 'new_review', 'New review to moderate',
      new.rating || '★ on ' || (select name from public.products where id = new.product_id), '/dashboard/reviews');
  end if;
  return coalesce(new, old);
end $$;
create trigger reviews_rollup after insert or update or delete on public.reviews for each row execute function public.review_rollup();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.store_settings enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.categories enable row level security;
alter table public.attribute_options enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_costs enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.coupons enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_costs enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.rate_limits enable row level security;

-- profiles
create policy "profiles: read own or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy "profiles: update own or owner" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_owner()) with check (id = auth.uid() or public.is_owner());

-- staff
create policy "staff: read self, managers, owner" on public.staff for select to authenticated
  using (user_id = auth.uid() or public.is_manager());
create policy "staff: owner writes" on public.staff for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- store configuration (public read)
create policy "settings: public read" on public.store_settings for select using (true);
create policy "settings: owner update" on public.store_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "zones: public read active" on public.delivery_zones for select using (is_active or public.is_staff());
create policy "zones: owner writes" on public.delivery_zones for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "categories: public read active" on public.categories for select using (is_active or public.is_staff());
create policy "categories: owner writes" on public.categories for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "options: public read" on public.attribute_options for select using (true);
create policy "options: managers write" on public.attribute_options for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- catalog
create policy "products: public read active" on public.products for select
  using (is_active or public.is_staff());
create policy "products: category managers insert" on public.products for insert to authenticated
  with check (public.can_manage_category(category_id));
create policy "products: category managers update" on public.products for update to authenticated
  using (public.can_manage_category(category_id)) with check (public.can_manage_category(category_id));
create policy "products: owner delete" on public.products for delete to authenticated using (public.is_owner());

create policy "variants: public read active" on public.product_variants for select
  using ((is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active)) or public.is_staff());
create policy "variants: category managers insert" on public.product_variants for insert to authenticated
  with check (public.can_manage_product(product_id));
create policy "variants: category managers update" on public.product_variants for update to authenticated
  using (public.can_manage_product(product_id)) with check (public.can_manage_product(product_id));
create policy "variants: owner delete" on public.product_variants for delete to authenticated using (public.is_owner());

create policy "costs: margin viewers read" on public.variant_costs for select to authenticated
  using (public.can_view_margins());
create policy "costs: margin viewers insert" on public.variant_costs for insert to authenticated
  with check (public.can_view_margins() and public.can_manage_product((select product_id from public.product_variants where id = variant_id)));
create policy "costs: margin viewers update" on public.variant_costs for update to authenticated
  using (public.can_view_margins()) with check (public.can_view_margins());

-- customer-owned rows
create policy "addresses: own" on public.customer_addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cart: own" on public.cart_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wishlist: own" on public.wishlist_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "coupons: managers" on public.coupons for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "cash sessions: own or managers" on public.cash_sessions for select to authenticated
  using (staff_id = auth.uid() or public.is_manager());

-- orders: customers see their own; managers see all; attendants see sales they rang up.
-- No insert/update policies: orders change only through the checked functions.
create policy "orders: visible to owner of order and staff" on public.orders for select to authenticated
  using (customer_id = auth.uid() or public.is_manager() or (handled_by = auth.uid() and public.is_staff()));
create policy "order items: follow order" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "order item costs: margin viewers" on public.order_item_costs for select to authenticated
  using (public.can_view_margins());
create policy "order history: follow order" on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "payments: follow order" on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- reviews
create policy "reviews: approved public, own, staff" on public.reviews for select
  using (status = 'approved' or user_id = auth.uid() or public.is_staff());
create policy "reviews: customers write own" on public.reviews for insert to authenticated
  with check (user_id = auth.uid());
create policy "reviews: own edit or moderate" on public.reviews for update to authenticated
  using (user_id = auth.uid() or public.is_manager()) with check (user_id = auth.uid() or public.is_manager());
create policy "reviews: own or owner delete" on public.reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_owner());

-- stock
create policy "stock counts: managers read" on public.stock_counts for select to authenticated using (public.is_manager());
create policy "stock count lines: managers read" on public.stock_count_lines for select to authenticated using (public.is_manager());
create policy "stock ledger: managers read" on public.stock_adjustments for select to authenticated using (public.is_manager());

-- audit: owner only
create policy "audit: owner reads" on public.audit_log for select to authenticated using (public.is_owner());

-- notifications / push: own
create policy "notifications: own read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: own delete" on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy "push: own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- newsletter_subscribers, rate_limits: no policies (server-side service role only).

-- ---------------------------------------------------------------------
-- Defence in depth: the public (anon) role never needs these tables at all.
-- ---------------------------------------------------------------------
revoke all on public.variant_costs, public.order_item_costs, public.staff, public.cash_sessions,
  public.stock_counts, public.stock_count_lines, public.stock_adjustments, public.audit_log,
  public.payments, public.orders, public.order_items, public.order_status_history,
  public.customer_addresses, public.cart_items, public.wishlist_items, public.coupons,
  public.notifications, public.push_subscriptions, public.newsletter_subscribers, public.rate_limits,
  public.profiles
from anon;
revoke insert, update, delete on public.store_settings, public.delivery_zones, public.categories,
  public.attribute_options, public.products, public.product_variants, public.reviews
from anon;
-- Writes that must go through functions: no direct DML from browsers.
revoke insert, update, delete on public.orders, public.order_items, public.order_item_costs,
  public.order_status_history, public.payments, public.stock_adjustments, public.stock_counts,
  public.stock_count_lines, public.cash_sessions, public.audit_log, public.rate_limits,
  public.newsletter_subscribers
from authenticated;
revoke insert, delete on public.notifications from authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke all on sequence public.barcode_seq, public.sku_seq, public.order_number_seq from anon;

-- Internal helpers are not part of the public API.
revoke execute on function private.notify_roles(public.app_role[], public.notification_type, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function private.log_audit(text, text, text, jsonb, jsonb) from public, anon;
grant execute on function private.log_audit(text, text, text, jsonb, jsonb) to authenticated, service_role;
revoke execute on function public.refresh_product_rollup(uuid) from public, anon, authenticated;
revoke execute on function public.next_barcode() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
