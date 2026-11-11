# Admin portal setup (about 10 minutes, works from a phone)

The website stays free and fast. The admin portal stores the menu, prices, photos,
settings and orders in **Supabase** (free plan is plenty for one cafe).

Until this is done the website simply uses the built-in menu in `menu.js`, so nothing breaks.

## 1. Create the project
1. Go to **supabase.com** and sign in with GitHub or email.
2. **New project** → name `genius-coffeebar` → choose a database password (save it) →
   region closest to Oman (e.g. **Frankfurt** or **Mumbai**) → Create.
3. Wait ~1 minute until the project is ready.

## 2. Create the tables
1. In Supabase open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy everything, paste it in.
3. Change `OWNER_EMAIL_HERE` (last line) to the owner's real email.
4. Press **Run**. You should see “Success”.

## 3. Create the owner's login
1. **Authentication → Users → Add user → Create new user**.
2. Use the *same email* as in step 2 and a strong password. Tick **Auto Confirm User**.
3. (Recommended) **Authentication → Sign In / Providers → Email** → turn **off** “Allow new users to sign up”.
   The database also checks the admins list, so strangers could never edit anything anyway.

## 4. Connect the website
1. **Project Settings → API** (or **Data API**). Copy:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** key (a long text starting with `eyJ…`). The *anon* key is meant to be public.
     **Never** use the `service_role` key.
2. Put them in `config.js`:
   ```js
   window.GENIUS_CFG = { url: 'https://abcdxyz.supabase.co', key: 'eyJ...' };
   ```
3. Commit and push. Done.

## 5. First login
1. Open `https://<your-site>/admin/` and sign in.
2. Go to **Menu** → **Import current menu** (one tap). Now everything is editable.
3. Tip: on iPhone, Share → **Add to Home Screen** so it opens like an app.

For “Forgot password” to work, set **Authentication → URL Configuration → Site URL** to the site address
and add `<site>/admin/` to **Redirect URLs**.

## What the owner can do
| Tab | Does |
|---|---|
| Orders | See website orders live (auto-refresh, sound + vibration), move them New → Preparing → Ready → Done, today's totals |
| Menu | Edit names and prices, Hot/Iced columns, add / delete / reorder items and sections, **Sold out** and **Hide** switches |
| Photos | Replace any website photo from the phone camera roll (auto-resized) |
| Settings | Announcement banner (e.g. Eid closure), opening hours, “Temporarily closed”, Google rating, change password |

## Notes
- Orders are saved when the customer taps **Send order on WhatsApp**. The WhatsApp message is still the real order.
- No online payment. Nothing is charged.
- If Supabase is down, the website falls back to the last menu it cached, then to `menu.js`.
- Free plan note: Supabase can pause a free project after about a week of no activity. If the site ever falls back to the
  built-in menu, open the Supabase dashboard and press **Restore**. A paid plan avoids this.
