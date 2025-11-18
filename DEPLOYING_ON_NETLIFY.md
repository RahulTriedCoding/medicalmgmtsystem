# Deploying to Netlify

This project is a Next.js 16 + Supabase CRM. Netlify can build and host it directly as long as the build command, publish directory, and environment variables are configured correctly.

## 1. Prerequisites

- Node.js 18+ (Netlify will respect `.nvmrc` / `package.json` engines).
- Supabase project with the same tables this repo expects.
- GitHub (or GitLab/Bitbucket) repository containing this code.

## 2. Netlify build settings

When creating a site in Netlify (`New site from Git`):

| Setting          | Value           |
| ---------------- | --------------- |
| **Build command** | `npm run build` |
| **Publish directory** | `.next`       |

Netlify auto-detects Next.js and will serve the `.next` output and serverless functions.

## 3. Required environment variables

Add the following in Netlify → *Site settings* → *Environment variables*. Use the same values you run locally (`.env.local`).

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for client-side usage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (used only on the server). Keep this secret. |
| `NEXT_PUBLIC_SITE_URL` | Base URL used in staff invite emails (see `app/api/staff/route.ts`). |
| `NEXTAUTH_URL` | Auth callback URL (used in `app/api/staff/route.ts`). Set to your Netlify domain or custom domain, e.g. `https://your-site.netlify.app`. |

If your `.env.local` contains additional variables, mirror them as well.

## 4. Deploy steps

1. **Push code** to GitHub (or your preferred Git provider). Ensure `npm run lint` and `npm run build` succeed locally.
2. In **Netlify**, click **Add new site → Import an existing project**, choose your repo, and select the branch you want to deploy.
3. On the build settings page:
   - Set **Build command** to `npm run build`.
   - Set **Publish directory** to `.next`.
   - Leave the default Node version (Netlify will detect Node 18 from `.nvmrc`/`engines`).
4. Add the environment variables listed above under **Site settings → Build & deploy → Environment → Edit variables**.
5. Click **Deploy site**. Netlify will install dependencies, run `npm run build`, and deploy the output from `.next`.
6. After the first deploy, trigger a new build whenever you update environment variables or push code.

## 5. Notes

- `npm run build` already outputs the correct production build; no extra Netlify plugins or custom commands are required.
- If you use Supabase service-role keys, make sure the Netlify site is private or use Netlify’s *Environment variable secrets*.
- Any future environment variables added to the project must be mirrored in Netlify for the deployment to keep working.
