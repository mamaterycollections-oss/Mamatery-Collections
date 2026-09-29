-- =====================================================================
-- MamaTerryCollections — core schema
-- Catalog, variants (SKU + barcode), orders, payments, stock ledger,
-- staff, reviews, notifications, audit log.
-- Cost prices live in their own tables (variant_costs, order_item_costs)
-- so row-level security can hide them completely from customers,
-- attendants and managers without margin access.
-- =====================================================================

create type public.app_role as enum ('owner', 'sales_manager', 'sales_attendant', 'customer');
create type public.order_status as enum (
  'placed', 'confirmed', 'packed', 'out_for_delivery', 'ready_for_pickup',
  'delivered', 'collected', 'returned', 'cancelled'
);
create type public.order_channel as enum ('online', 'in_store');
create type public.delivery_method as enum ('courier', 'pickup', 'in_store');
create type public.payment_method as enum ('mpesa', 'card', 'cod', 'cash');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');
create type public.stock_reason as enum (
  'initial', 'restock', 'sale', 'return', 'void', 'damage', 'loss', 'correction', 'stock_take'
);
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.notification_type as enum (
  'new_order', 'payment_received', 'low_stock', 'order_needs_action', 'new_review',
  'cash_discrepancy', 'order_update', 'system'
);
create type public.attribute_kind as enum ('size', 'colour');
create type public.coupon_type as enum ('percent', 'fixed');

-- Shared updated_at trigger
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text,
  email text,
  phone text,
  preferred_payment public.payment_method,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- empty array = the whole catalog
  assigned_category_ids uuid[] not null default '{}',
  can_view_margins boolean not null default false,
  discount_limit_pct numeric(5, 2) not null default 0 check (discount_limit_pct between 0 and 100),
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger staff_touch before update on public.staff for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Store configuration (owner-editable)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default 'MamaTerryCollections',
  tagline text,
  phone text,
  whatsapp text,
  email text,
  pickup_enabled boolean not null default true,
  pickup_address text,
  pickup_hours text,
  mpesa_enabled boolean not null default true,
  card_enabled boolean not null default false,
  cod_enabled boolean not null default false,
  free_delivery_threshold numeric(12, 2),
  low_stock_default integer not null default 3 check (low_stock_default >= 0),
  return_window_days integer not null default 7,
  announcement text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  receipt_footer text,
  updated_at timestamptz not null default now()
);
create trigger store_settings_touch before update on public.store_settings for each row execute function public.touch_updated_at();

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  fee numeric(12, 2) not null default 0 check (fee >= 0),
  eta text,
  cod_allowed boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories (id) on delete set null,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.attribute_options (
  id uuid primary key default gen_random_uuid(),
  kind public.attribute_kind not null,
  value text not null,
  hex text,
  sort_order integer not null default 0
);
create unique index attribute_options_unique on public.attribute_options (kind, lower(value));

-- ---------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  base_price numeric(12, 2) not null default 0 check (base_price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= 0),
  images text[] not null default '{}',
  tags text[] not null default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  -- Denormalised from variants/reviews by triggers (fast storefront filtering)
  price_min numeric(12, 2),
  price_max numeric(12, 2),
  total_stock integer not null default 0,
  sizes text[] not null default '{}',
  colours text[] not null default '{}',
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_active_created_idx on public.products (is_active, created_at desc);
create index products_sizes_idx on public.products using gin (sizes);
create index products_colours_idx on public.products using gin (colours);
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create sequence public.barcode_seq start 1;
create sequence public.sku_seq start 10001;

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size text,
  colour text,
  sku text not null unique,
  barcode_value text not null unique,
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (product_id, size, colour)
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger product_variants_touch before update on public.product_variants for each row execute function public.touch_updated_at();

-- EAN-13 in the 20–29 "in-store use" prefix range, so it never collides with
-- manufacturer barcodes and scans on any retail scanner.
create or replace function public.next_barcode() returns text
language plpgsql as $$
declare
  body text := '20' || lpad(nextval('public.barcode_seq')::text, 10, '0');
  total integer := 0;
  i integer;
begin
  for i in 1..12 loop
    total := total + substr(body, i, 1)::integer * (case when i % 2 = 0 then 3 else 1 end);
  end loop;
  return body || ((10 - total % 10) % 10)::text;
end $$;

create or replace function public.variant_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.barcode_value is null or new.barcode_value = '' then
    new.barcode_value := public.next_barcode();
  end if;
  if new.sku is null or new.sku = '' then
    new.sku := 'MT' || nextval('public.sku_seq')::text
      || coalesce('-' || nullif(upper(regexp_replace(new.size, '[^A-Za-z0-9]', '', 'g')), ''), '')
      || coalesce('-' || nullif(upper(left(regexp_replace(new.colour, '[^A-Za-z]', '', 'g'), 3)), ''), '');
  end if;
  new.size := nullif(trim(new.size), '');
  new.colour := nullif(trim(new.colour), '');
  return new;
end $$;
create trigger product_variants_defaults before insert on public.product_variants
  for each row execute function public.variant_defaults();

create table public.variant_costs (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger variant_costs_touch before update on public.variant_costs for each row execute function public.touch_updated_at();

-- Keep products.price_min / price_max / total_stock / sizes / colours in sync.
create or replace function public.refresh_product_rollup(p_product uuid) returns void
language sql security definer set search_path = public as $$
  update public.products p set
    price_min = s.pmin,
    price_max = s.pmax,
    total_stock = coalesce(s.stock, 0),
    sizes = coalesce(s.sizes, '{}'),
    colours = coalesce(s.colours, '{}')
  from (
    select min(selling_price) pmin, max(selling_price) pmax, sum(quantity_on_hand)::int stock,
           array_agg(distinct size) filter (where size is not null) sizes,
           array_agg(distinct colour) filter (where colour is not null) colours
    from public.product_variants where product_id = p_product and is_active
  ) s
  where p.id = p_product;
$$;

create or replace function public.product_variants_rollup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_rollup(old.product_id);
    return old;
  end if;
  perform public.refresh_product_rollup(new.product_id);
  if tg_op = 'UPDATE' and old.product_id <> new.product_id then
    perform public.refresh_product_rollup(old.product_id);
  end if;
  return new;
end $$;
create trigger product_variants_rollup after insert or update or delete on public.product_variants
  for each row execute function public.product_variants_rollup();

-- ---------------------------------------------------------------------
-- Customers: addresses, cart, wishlist
-- ---------------------------------------------------------------------
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  zone_id uuid references public.delivery_zones (id) on delete set null,
  address_line text not null,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index customer_addresses_user_idx on public.customer_addresses (user_id);

create table public.cart_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  added_at timestamptz not null default now(),
  primary key (user_id, variant_id)
);

create table public.wishlist_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  description text,
  type public.coupon_type not null default 'percent',
  value numeric(12, 2) not null check (value > 0),
  min_subtotal numeric(12, 2) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Cash drawer sessions (in-person sales reconciliation)
-- ---------------------------------------------------------------------
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_float numeric(12, 2) not null default 0,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  expected_cash numeric(12, 2),
  counted_cash numeric(12, 2),
  discrepancy numeric(12, 2),
  notes text
);
create unique index cash_sessions_one_open on public.cash_sessions (staff_id) where status = 'open';

-- ---------------------------------------------------------------------
-- Orders & payments
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('MT' || nextval('public.order_number_seq')::text),
  channel public.order_channel not null default 'online',
  customer_id uuid references public.profiles (id) on delete set null,
  contact_name text,
  contact_phone text,
  contact_email text,
  status public.order_status not null default 'placed',
  delivery_method public.delivery_method not null,
  delivery_zone_id uuid references public.delivery_zones (id) on delete set null,
  delivery_zone_name text,
  delivery_address text,
  delivery_notes text,
  delivery_fee numeric(12, 2) not null default 0,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'unpaid',
  subtotal numeric(12, 2) not null,
  discount_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  coupon_code text,
  discount_reason text,
  discount_by uuid references public.profiles (id) on delete set null,
  handled_by uuid references public.profiles (id) on delete set null,
  cash_session_id uuid references public.cash_sessions (id) on delete set null,
  amount_tendered numeric(12, 2),
  change_given numeric(12, 2),
  tracking_token uuid not null default gen_random_uuid(),
  void_reason text,
  voided_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  refund_reason text,
  refunded_by uuid references public.profiles (id) on delete set null,
  refunded_at timestamptz,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id, placed_at desc);
create index orders_status_idx on public.orders (status, placed_at desc);
create index orders_placed_idx on public.orders (placed_at desc);
create index orders_handled_idx on public.orders (handled_by);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  variant_label text,
  sku text,
  image_url text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);

create table public.order_item_costs (
  order_item_id uuid primary key references public.order_items (id) on delete cascade,
  unit_cost numeric(12, 2) not null default 0
);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12, 2) not null,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  mpesa_checkout_request_id text unique,
  mpesa_receipt text,
  card_ref text unique,
  reference text,
  payer_phone text,
  received_by uuid references public.profiles (id) on delete set null,
  raw jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_order_idx on public.payments (order_id);

-- ---------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_name text,
  rating integer not null check (rating between 1 and 5),
  title text,
  comment text,
  status public.review_status not null default 'pending',
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index reviews_product_idx on public.reviews (product_id, status);

-- ---------------------------------------------------------------------
-- Stock ledger, stock-takes
-- ---------------------------------------------------------------------
create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid references public.categories (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  notes text,
  started_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz
);

create table public.stock_count_lines (
  count_id uuid not null references public.stock_counts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  expected integer not null,
  counted integer,
  counted_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (count_id, variant_id)
);

create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity_delta integer not null,
  quantity_after integer,
  reason public.stock_reason not null,
  note text,
  new_cost_price numeric(12, 2),
  order_id uuid references public.orders (id) on delete set null,
  stock_count_id uuid references public.stock_counts (id) on delete set null,
  adjusted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_adjustments_variant_idx on public.stock_adjustments (variant_id, created_at desc);
create index stock_adjustments_created_idx on public.stock_adjustments (created_at desc);

-- ---------------------------------------------------------------------
-- Audit, notifications, push, newsletter, rate limiting
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_target_idx on public.audit_log (target_table, target_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_role public.app_role,
  type public.notification_type not null,
  title text not null,
  message text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  email text primary key,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
