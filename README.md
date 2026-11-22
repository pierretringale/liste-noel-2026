# Liste de Noël 2026

Page famille : la liste des souhaits, réservation avec un prénom, et un espace parents protégé par un code. Deux pages statiques sans étape de build, hébergées sur GitHub Pages. Les données passent toutes par une seule fonction Supabase, `noel`.

## Organisation

| Chemin | Rôle |
|---|---|
| `index.html`, `js/liste.js` | Page liste (réserver, libérer, filtrer) |
| `parents.html`, `js/parents.js` | Connexion par code + ajout / modification / suppression, photos |
| `js/api.js` | Appels à la fonction `noel` (aucune clé) |
| `css/style.css`, `assets/` | Charte riso, décor, polices auto-hébergées (OFL) |
| `supabase/functions/noel/index.ts` | Le guichet : lecture, réservation, jeton parents, photos |
| `supabase/migrations/` | Tables `noel_*`, données de départ, bucket `noel-photos` |
| `kit/` | Maquettes de référence (non servies) |

## Travailler en local

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Pour que la fonction accepte la page locale, `http://localhost:8080` doit figurer dans le secret `NOEL_ALLOWED_ORIGINS`.

## Redéployer la fonction

```bash
supabase functions deploy noel --remote=eqlofgcravaihvfaysdb --no-verify-jwt --use-api
```

Secrets de la fonction : `NOEL_PARENTS_CODE` (posé par les parents), `NOEL_TOKEN_SECRET`, `NOEL_ALLOWED_ORIGINS`. Ils ne sont jamais dans ce dépôt.

## Démontage (janvier 2027)

```bash
supabase functions delete noel --remote=eqlofgcravaihvfaysdb
```

```bash
supabase secrets unset NOEL_PARENTS_CODE NOEL_TOKEN_SECRET NOEL_ALLOWED_ORIGINS --remote=eqlofgcravaihvfaysdb
```

Puis, dans le tableau de bord Supabase : Storage › `noel-photos` › vider le bucket, puis le supprimer (Supabase refuse la suppression directe des fichiers en SQL). Enfin, en SQL :

```sql
drop table public.noel_claims, public.noel_login_attempts, public.noel_gifts;
```

Enfin, désactiver Pages et archiver le dépôt :

```bash
gh api -X DELETE repos/pierretringale/liste-noel-2026/pages
```

```bash
gh repo archive pierretringale/liste-noel-2026 --yes
```
