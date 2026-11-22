-- Données de départ : kit/data/seed.json (10 cadeaux, 3 réservés par « Les parents »).
insert into public.noel_gifts (child, name, url, price, note, position) values
  ('Loula', 'Jouet Pokémon (réf. PKW4160)', 'https://www.amazon.fr/Pok%C3%A9mon-PKW4160-Toys/dp/B0FB9MKTCN', null, 'Nom exact à vérifier', 10),
  ('Loula', 'Mon déguisement de Cléopâtre', 'https://www.oxybul.com/deguisement-robe-cleopatre-8-10-ans-oxybul-228708', null, 'Taille 8-10 ans', 20),
  ('Loula', 'Petit sabre laser RK1', 'https://le-sabre-laser.fr/products/petit-sabre-laser', 89.99, 'Elle veut le bleu', 30),
  ('Loula', 'Figurine Jessie interactive, Toy Story', 'https://www.disneystore.fr/figurine-jessie-interactive-toy-story-417138058108.html', 41.0, null, 40),
  ('Loula', 'Figurine Pile-Poil interactive, Toy Story', 'https://www.disneystore.fr/figurine-pile-poil-interactive-toy-story-417138059358.html', 41.0, null, 50),
  ('Sacha', 'Pokémon Salamèche + Poké Ball Clip', 'https://www.amazon.fr/Pok%C3%A9mon-Salam%C3%A8che-Pok%C3%A9-Ball-Clip/dp/B0FLK84JBY', null, null, 10),
  ('Sacha', 'Déguisement Iron Man pour enfants', 'https://www.disneystore.fr/deguisement-iron-man-pour-enfants-5502045240322M.html', 53.0, 'Bientôt disponible', 20),
  ('Sacha', 'Déguisement Spider-Man, effets sonores et lumineux', 'https://www.disneystore.fr/deguisement-spider-man-avec-effets-sonores-et-lumineux-pour-enfants-5502045240342M.html', 61.0, 'Bientôt disponible', 30),
  ('Sacha', 'Petit sabre laser RK1', 'https://le-sabre-laser.fr/products/petit-sabre-laser', 89.99, 'Il veut le vert', 40),
  ('Sacha', 'Figurine Buzz l''Éclair transformable, Toy Story 5', 'https://www.disneystore.fr/figurine-buzz-l-eclair-transformable-toy-story%C2%A05---20-cm-417130892083.html', 24.0, null, 50);

insert into public.noel_claims (gift_id, name)
select id, 'Les parents' from public.noel_gifts
where (child = 'Loula' and name = 'Figurine Jessie interactive, Toy Story') or
      (child = 'Loula' and name = 'Figurine Pile-Poil interactive, Toy Story') or
      (child = 'Sacha' and name = 'Figurine Buzz l''Éclair transformable, Toy Story 5');
