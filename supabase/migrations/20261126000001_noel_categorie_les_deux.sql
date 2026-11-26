-- Catégorie « Pour les deux » : un cadeau peut être destiné à Loula, Sacha ou aux deux.
alter table public.noel_gifts drop constraint noel_gifts_child_check;
alter table public.noel_gifts add constraint noel_gifts_child_check check (child in ('Loula', 'Sacha', 'Les deux'));
