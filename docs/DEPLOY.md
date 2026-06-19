# Mattchat — Deployment Guide

## What you're deploying

| Layer | Tech | Host |
|---|---|---|
| Frontend | React | Vercel (free) |
| Backend | Node.js / Express | Railway (free tier) |
| Database + Auth + Realtime | Supabase | Supabase (free tier) |
| Outbound email | SendGrid | SendGrid (free tier) |
| Inbound email (email→chat) | SendGrid Inbound Parse | Webhook → your backend |

---

## Step 1 — Set up Supabase

1. Go to https://supabase.com and create a free account.
2. Click **New project**, choose a name (e.g. `mattchat`), set a strong database password.
3. Once the project is ready, go to **SQL Editor** → **New query**.
4. Paste the entire contents of `docs/schema.sql` and click **Run**.
5. Go to **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcxyz.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret — backend only)

---

## Step 2 — Set up SendGrid (email)

1. Go to https://sendgrid.com and create a free account.
2. Verify a sender domain under **Settings → Sender Authentication**.
   - This will be your `MAIL_DOMAIN` (e.g. `mattchat.yourdomain.com`).
   - Add the DNS records SendGrid gives you to your domain registrar.
3. Create an API key under **Settings → API Keys** with **Full Access**.
   - This is your `SMTP_PASS`.
4. Enable **Inbound Parse** under **Settings → Inbound Parse**:
   - Add your domain (e.g. `mattchat.yourdomain.com`).
   - Set the destination URL to: `https://your-backend.railway.app/webhook/inbound-email`
   - Check **POST the raw, full MIME message**.
5. Add a DNS `MX` record for your domain pointing to `mx.sendgrid.net` (priority 10).

---

## Step 3 — Deploy the Backend to Railway

1. Go to https://railway.app and sign in with GitHub.
2. Click **New Project → Deploy from GitHub repo**.
3. Select your repo and set the **root directory** to `backend`.
4. Railway auto-detects Node.js and runs `npm start`.
5. Under **Variables**, add these environment variables:

```
PORT=3001
FRONTEND_URL=https://your-app.vercel.app
SUPABASE_URL=https://abcxyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
MAIL_DOMAIN=mattchat.yourdomain.com
```

6. Click **Deploy**. Note your Railway URL (e.g. `https://mattchat-backend.railway.app`).
7. Test it: `curl https://mattchat-backend.railway.app/health` — should return `{"status":"ok"}`.

---

## Step 4 — Deploy the Frontend to Vercel

1. Go to https://vercel.com and sign in with GitHub.
2. Click **Add New → Project** and import your repo.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**, add:

```
REACT_APP_SUPABASE_URL=https://abcxyz.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

5. Click **Deploy**. Vercel gives you a URL like `https://mattchat.vercel.app`.
6. Copy this URL and update the backend's `FRONTEND_URL` variable in Railway, then redeploy.

---

## Step 5 — Update SendGrid Inbound Parse URL

Now that your backend is live, go back to SendGrid → Inbound Parse and set the webhook URL to your Railway backend:

```
https://mattchat-backend.railway.app/webhook/inbound-email
```

---

## Step 6 — Configure Supabase Auth

1. In Supabase → **Authentication → URL Configuration**, set:
   - **Site URL**: `https://mattchat.vercel.app`
   - **Redirect URLs**: `https://mattchat.vercel.app/**`
2. Under **Email Templates**, customize the confirmation email if desired.

---

## Step 7 — Test end-to-end

### App → App messaging
1. Sign up as two users at `https://mattchat.vercel.app`.
2. Start a conversation — messages should appear in real time.

### Email → App messaging
1. Send an email to `matt+username@mattchat.yourdomain.com`.
2. Within seconds it should appear in the app as a chat message with the 📧 badge.

### App → Email messaging
When a Mattchat user sends a message to an external (email-only) contact, the backend sends a formatted email. The recipient can reply by email and it flows back into the chat.

---

## Custom domain (optional)

- **Vercel**: Go to your project → **Domains** → add your domain.
- **Railway**: Go to your service → **Settings → Domains** → add a custom domain.
- Update all environment variables and SendGrid settings with the new URLs.

---

## Scaling considerations

| Concern | Solution |
|---|---|
| More than 500 concurrent users | Upgrade Supabase to Pro ($25/mo) |
| Email volume > 100/day | Upgrade SendGrid to Essentials ($20/mo) |
| Backend always-on | Upgrade Railway to Starter ($5/mo) |
| File attachments | Add Supabase Storage (included in Pro) |
| Push notifications | Add Firebase Cloud Messaging (free) |

---

## Project structure

```
mattchat/
├── frontend/
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js          — routing & auth state
│   │   ├── App.css         — global styles
│   │   ├── lib/supabase.js — DB helpers & queries
│   │   ├── hooks/useChat.js — real-time chat logic
│   │   └── pages/
│   │       ├── AuthPage.js  — login / sign up
│   │       └── ChatPage.js  — main chat UI
│   ├── package.json
│   └── .env.example
│
├── backend/
│   ├── src/
│   │   ├── index.js               — Express server
│   │   ├── routes/
│   │   │   ├── email.js           — outbound email route
│   │   │   └── webhook.js         — inbound email handler
│   │   └── services/
│   │       └── mailer.js          — nodemailer / SendGrid
│   ├── package.json
│   └── .env.example
│
└── docs/
    ├── schema.sql    — Supabase database schema + RLS
    └── DEPLOY.md     — this file
```
