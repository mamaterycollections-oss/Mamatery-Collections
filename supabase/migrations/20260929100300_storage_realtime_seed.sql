-- =====================================================================
-- Product image storage, realtime, and starter configuration.
-- Everything seeded here is editable by the owner in Dashboard → Settings.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "product images: managers upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_manager());
create policy "product images: managers update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_manager());
create policy "product images: managers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_manager());

-- Live stock, order and notification updates in the browser (RLS still applies).
alter publication supabase_realtime add table public.notifications, public.orders, public.product_variants, public.payments;

insert into public.store_settings (id, store_name, tagline, announcement, pickup_enabled, mpesa_enabled, receipt_footer)
values (1, 'MamaTerryCollections', 'Clothes, bags & caps that speak for you',
        'Pay with M-Pesa · Delivery across Kenya', false, true, 'Thank you for shopping with MamaTerryCollections!')
on conflict (id) do nothing;

insert into public.delivery_zones (name, description, fee, eta, cod_allowed, sort_order) values
  ('Nairobi', 'Nairobi CBD and estates within the city', 250, '1–2 days', true, 1),
  ('Nairobi environs', 'Kiambu, Ruiru, Thika Road, Rongai, Kitengela, Syokimau, Ngong', 400, '1–2 days', false, 2),
  ('Other counties', 'Countrywide via courier (Mombasa, Kisumu, Nakuru, Eldoret and more)', 550, '2–4 days', false, 3);

insert into public.categories (name, slug, description, sort_order) values
  ('Clothes', 'clothes', 'Dresses, tops, trousers, two-pieces and everyday wear', 1),
  ('Bags', 'bags', 'Handbags, totes, crossbodies and clutches', 2),
  ('Caps', 'caps', 'Baseball caps, bucket hats and more', 3),
  ('Other', 'other', 'Accessories and new arrivals', 4);

insert into public.attribute_options (kind, value, hex, sort_order) values
  ('size', 'XS', null, 1), ('size', 'S', null, 2), ('size', 'M', null, 3), ('size', 'L', null, 4),
  ('size', 'XL', null, 5), ('size', 'XXL', null, 6), ('size', '3XL', null, 7), ('size', 'One Size', null, 8),
  ('colour', 'Black', '#141414', 1), ('colour', 'White', '#F4F2EE', 2), ('colour', 'Beige', '#D9C4A3', 3),
  ('colour', 'Brown', '#7A4A2B', 4), ('colour', 'Maroon', '#6B1D2A', 5), ('colour', 'Red', '#B42A22', 6),
  ('colour', 'Pink', '#E7A3B6', 7), ('colour', 'Orange', '#DD7A35', 8), ('colour', 'Mustard', '#D4A62A', 9),
  ('colour', 'Olive', '#6A6A3A', 10), ('colour', 'Green', '#2D6A45', 11), ('colour', 'Blue', '#2B56A8', 12),
  ('colour', 'Navy', '#1C2847', 13), ('colour', 'Purple', '#65408F', 14), ('colour', 'Grey', '#8B8B8B', 15),
  ('colour', 'Multicolour', null, 16);
