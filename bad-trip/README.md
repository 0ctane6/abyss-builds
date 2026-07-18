# Bad'Trip 🧭

**Balance tes idées de voyage, l'IA trace la route.**

Bad'Trip est une petite appli web où tu déposes des **textes, images et documents**
(trouvés sur internet ou ailleurs). Une **IA les analyse** et construit un
**itinéraire jour par jour**, affiché sur une **carte**. Tu peux créer un compte,
monter un projet de voyage, et **inviter des amis** pour le préparer à plusieurs.

Le tout tourne sur des services **100 % gratuits, sans carte bancaire**.

---

## Stack

| Rôle | Outil | Gratuit ? |
|------|-------|-----------|
| Interface web | **Next.js 14** (App Router) + Tailwind | ✅ |
| Comptes, base de données, stockage fichiers | **Supabase** | ✅ (sans carte) |
| Analyse IA des fichiers (texte + images + PDF) | **Google Gemini** (`gemini-1.5-flash`) | ✅ (sans carte) |
| Carte & géocodage | **Leaflet + OpenStreetMap / Nominatim** | ✅ (sans clé) |
| Hébergement | **Vercel** (recommandé) ou Netlify | ✅ |

---

## Mise en route (≈ 15 min)

### 1. Récupérer le code et installer

```bash
git clone https://github.com/0ctane6/bad-trip.git
cd bad-trip
npm install
```

### 2. Créer un projet Supabase (comptes + données + fichiers)

1. Va sur [supabase.com](https://supabase.com) → **New project** (aucune carte demandée).
2. Une fois le projet prêt, ouvre **SQL Editor → New query**, colle tout le
   contenu de [`supabase/schema.sql`](./supabase/schema.sql) et clique **Run**.
   → ça crée les tables, la sécurité, et le bucket de fichiers.
3. Va dans **Project Settings → API** et note :
   - `Project URL`
   - clé `anon public`
   - clé `service_role` (secrète)
4. (Recommandé pour des amis) **Authentication → Providers → Email** : tu peux
   désactiver « Confirm email » pour que la connexion soit immédiate sans
   validation par mail.

### 3. Obtenir une clé Gemini (l'IA)

1. Va sur [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. **Create API key** → copie la clé (gratuite, sans carte).

### 4. Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

Puis remplis `.env.local` avec les valeurs des étapes 2 et 3 :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 5. Lancer en local

```bash
npm run dev
```

Ouvre <http://localhost:3000>. Crée un compte, un voyage, dépose des fichiers,
et clique sur **Créer l'itinéraire**.

---

## Mettre en ligne gratuitement (Vercel)

1. Pousse le repo sur GitHub (déjà fait si tu lis ceci).
2. Va sur [vercel.com](https://vercel.com) → **Add New → Project** → importe `bad-trip`.
3. Dans **Environment Variables**, ajoute les mêmes clés que dans `.env.local`
   (mets `NEXT_PUBLIC_SITE_URL` = l'URL Vercel finale, ex. `https://bad-trip.vercel.app`).
4. **Deploy**. Partage le lien à tes amis 🎉

---

## Comment ça marche

```
Fichiers déposés (texte / image / PDF)
        │
        ▼
  Route serveur /api/projects/[id]/generate
        │   (télécharge les fichiers, les envoie à Gemini)
        ▼
     Gemini  →  itinéraire structuré (jours + étapes + coordonnées)
        │
        ▼
  Coordonnées manquantes complétées via Nominatim (OpenStreetMap)
        │
        ▼
  Sauvegardé dans Supabase  →  affiché en liste + sur la carte Leaflet
```

- **Comptes & sessions** : Supabase Auth (e-mail + mot de passe).
- **Collaboration** : chaque projet a des *membres* ; la sécurité par ligne (RLS)
  garantit qu'on ne voit que ses propres voyages.
- **Invitations** : génèrent un **lien** à partager (pas besoin de service d'e-mail
  payant). L'ami clique, se connecte, et rejoint le projet.

---

## Structure du projet

```
supabase/schema.sql          # tables + sécurité + stockage (à exécuter une fois)
src/lib/                     # clients Supabase, IA Gemini, géocodage, types
src/middleware.ts            # protège les pages privées / rafraîchit la session
src/app/                     # pages (accueil, login, dashboard, projet, invitation)
src/app/api/                 # routes serveur (projets, fichiers, génération, invitations)
src/components/              # UI (carte, itinéraire, upload, invitations…)
```

---

## Notes

- **Confidentialité** : les fichiers déposés sont envoyés à Google Gemini pour
  analyse. Sur l'offre gratuite, évite les documents vraiment sensibles
  (passeports, données perso). Pour un usage 100 % privé, on peut brancher un
  modèle local (Ollama) à la place — voir `src/lib/gemini.ts`.
- **Limites gratuites** : Gemini et Supabase ont des quotas gratuits largement
  suffisants pour un usage entre amis.

Licence : MIT.
