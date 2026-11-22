-- Bucket public des photos de cadeaux : lecture publique, écriture par la fonction noel seule
-- (aucune politique sur storage.objects : seule la clé secrète écrit). 400 Ko, JPEG ou WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('noel-photos', 'noel-photos', true, 409600, array['image/jpeg', 'image/webp']);
