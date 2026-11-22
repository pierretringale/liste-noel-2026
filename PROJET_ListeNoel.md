# PROJET_ListeNoel — Liste de Noël 2026 de la famille

## ÉTAT ACTUEL — à lire en premier

| Élément | État |
|---|---|
| Phase | En ligne (22/11/2026), durée de vie jusqu'à fin décembre 2026 |
| Prochaine étape | Démontage en janvier 2027, sur demande de Pierre (README § Démontage) |
| Bloquant | Aucun |
| À NE PAS FAIRE | Toucher un objet de la base hors `noel_*` ; mettre une clé Supabase dans le dépôt ; retoucher le ciel du bandeau ou régénérer `hero-scene.webp` ; publier `kit/BRIEF.md` (il décrit la dette RLS de la base mutualisée) |
| URL / accès | https://pierretringale.github.io/liste-noel-2026/ — parents : `/parents.html` |
| Repo GitHub | `pierretringale/liste-noel-2026` (public, imposé par GitHub Free pour Pages) |

## OBJECTIF DU PROJET

Une page publique, sans compte, envoyée par lien à la famille : chacun coche le souhait qu'il offre et laisse son prénom, tout le monde voit qui offre quoi. Les parents gèrent la liste avec un code.

## STACK TECHNIQUE

| Composant | Choix | Raison |
|---|---|---|
| Pages | HTML/CSS/JS sans build | Deux pages, durée de vie d'un mois |
| Hébergement | GitHub Pages | Gratuit, `gh` déjà connecté |
| Données | Supabase `eqlofgcravaihvfaysdb`, tables `noel_*` | Base mutualisée existante, offre gratuite |
| Guichet | Fonction Edge `noel` (`verify_jwt = false`) | La page ne parle jamais à la base, aucune clé côté navigateur |
| Photos | Bucket public `noel-photos` (400 Ko, JPEG/WebP) | Écriture par la fonction seule |

## CONTRAINTES MÉTIER / PLATEFORME

- RLS activée sans politique sur les trois tables : seule la clé secrète de la fonction lit et écrit.
- `NOEL_ALLOWED_ORIGINS` doit contenir l'origine exacte de la page, sinon le navigateur bloque tout (message de panne).
- Poser un secret Supabase crée une nouvelle version de **toutes** les fonctions du projet (`analyze-receipt` compris), sans changer leur code.
- La CLI Supabase 3.x refuse toute modification en mode agent sans `--yes`.
- GitHub Free : Pages uniquement sur dépôt public.

## STRUCTURE DU PROJET

Voir README.md.

## FONCTIONS / ROUTES ACTIVES

| Appel `noel` | État |
|---|---|
| `GET` liste | ✅ Actif |
| `claim`, `release` | ✅ Actif |
| `login`, `session_check` | ✅ Actif |
| `gift_create`, `gift_update`, `gift_delete` | ✅ Actif |
| `photo_upload` | ✅ Actif |

## CAS LIMITES IDENTIFIÉS

| Cas limite | Comportement attendu |
|---|---|
| Deux personnes cochent le même souhait | Clé primaire `gift_id` : une seule gagne, l'autre voit « Trop tard, ce souhait vient d'être réservé par X. » |
| Libérer un souhait déjà libre | `200 {"ok":true}` |
| Guichet injoignable | Dernière liste gardée à l'écran + message de panne, jamais de page blanche |
| Plus de 10 mauvais codes en 15 min depuis une IP | `429`, « Trop d'essais. Réessayez dans un quart d'heure. » |
| Jeton expiré ou invalide sur une action parents | Retour à la connexion, rien n'est écrit |
| Photo de boutique qui refuse l'affichage ailleurs | Pictogramme de repli ; les parents déposent un fichier |
| Photo remplacée ou cadeau supprimé | L'ancien fichier du bucket est supprimé |
| Fichier photo très grand | Réduit à 600 px, JPEG 0,82 (puis 0,7 / 0,6 / 0,5 si > 400 Ko) |
| Nom d'action piège (`toString`…) | `400 unknown_action` |

## JOURNAL DES DÉCISIONS TECHNIQUES

| Date | Décision | Pourquoi | Conséquence si on change |
|---|---|---|---|
| 22/11/2026 | Une seule fonction guichet, aucune clé dans la page | La famille n'a pas de compte ; une clé publique exposerait la base mutualisée | Ajouter une clé à la page = dépendre des politiques RLS de toute la base |
| 22/11/2026 | Jeton parents signé HMAC, sans table de sessions | Simple, rien à purger | Changer `NOEL_TOKEN_SECRET` invalide tous les jetons (voulu, amendement A4) |
| 22/11/2026 | Clé de service lue dans `SUPABASE_SECRET_KEYS`, repli sur `SUPABASE_SERVICE_ROLE_KEY` | Les clés historiques sont annoncées en fin de vie fin 2026 | Si le repli disparaît, la fonction marche toujours via la nouvelle clé |
| 22/11/2026 | Confirmation avant de libérer un souhait (D-a) | Éviter les décochages accidentels | Amendement A6 pour revenir au clic direct |
| 22/11/2026 | CLI Supabase installée (Homebrew) et connectée | Le connecteur MCP ne sait pas poser de secrets | Sans CLI, les secrets se posent à la main dans le tableau de bord |
| 22/11/2026 | `kit/BRIEF.md` exclu du dépôt public | Il décrit la dette RLS de la base mutualisée | Le publier donnerait une piste d'attaque sur d'autres tables de la base |
| 22/11/2026 | Sabre « violet » teinté en prune `#8a3440` | Aucune teinte violette dans la maquette ni la charte | — |
| 22/11/2026 | « Annuler » referme la fiche (retour à « Ajouter un cadeau ») au lieu de recharger le cadeau | Retour de Pierre : impossible de refermer un cadeau après l'avoir modifié | Revenir à `chargerFiche(etat.enCours)` = fiche bloquée sur le dernier cadeau |
| 22/11/2026 | « Enregistrer » referme aussi la fiche après succès (message « C'est enregistré » conservé) ; en cas d'erreur la fiche reste ouverte | Demande de Pierre, même logique qu'Annuler | — |

## ERREURS CONNUES

| Date | Symptôme | Cause racine | Fix appliqué | Récurrent |
|---|---|---|---|---|
| 22/11/2026 | Espace parents : impossible de refermer un cadeau après l'avoir modifié | « Annuler » rechargeait le cadeau en cours au lieu de vider la fiche | `btn-annuler` → `chargerFiche(null)` | Non |
| 22/11/2026 | `supabase secrets set` ne pose rien, sans message visible | CLI 3.x : en mode agent, toute modification exige `--yes` | Ajouter `--yes` (et `--remote=<ref>`) | Oui, à chaque commande CLI qui modifie le projet |
