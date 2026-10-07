# Connect real accounts

## Database credentials: enter privately

In the AERIX VS Code terminal, run `npm run setup:database`.
Enter the **Atlas database username**, then its password at the hidden prompt. This is separate from your Atlas website login. The cluster address is already configured for Cluster0.

The setup saves the connection string encrypted using Windows DPAPI in `.secrets/mongodb.dpapi`. Only the same Windows account on this computer can normally decrypt it. Programs running as you can access it; this is not protection against a compromised Windows account. The secret is excluded from Git. Never share the `.secrets` directory.

Run `npm run check:database`. Success confirms network/authentication connectivity, without adding sample data. This check succeeded with the `aerix_app` user on 16 September 2026. The private local `.env` now has `DEMO_MODE=false`; stop the existing server with Ctrl+C and restart `npm run dev`. Use only one server on port 4000. Check `/api/health` for `"demo":false` and `"storage":"mongodb"`.

If you need an Atlas database user, first go to Database & Network Access > Custom Roles > Add New Custom Role. Name it `aerix_rw`; for Action or Role choose `readWrite` under Database Actions and Roles, and set Database to `aerix`. Save the custom role. Then open Database Users > Add New Database User, use password authentication, assign only `aerix_rw` in Custom Roles, and leave the broad built-in role unselected. The built-in option "Read and write to any database" is broader than AERIX needs. If offered, restrict this user to Cluster0. Allow this computer's current IP in Network Access. Do not open access to all IPs as a shortcut.

The connection check does not switch an already-running demo process to Atlas; restart it after changing `.env`. No fictional hospitals are automatically copied to Atlas. A successful connection alone does not verify hospital listings, set up email, or make the site production-ready.

## Email delivery

### Gmail over HTTPS when X-VPN blocks SMTP

The free X-VPN app on this computer lets Atlas connect but blocks Gmail SMTP. X-VPN's split tunneling requires a paid plan. For a free **pilot**, AERIX can instead call a Google Apps Script over HTTPS. The script must belong to `aerixcompany@gmail.com`, so the actual sender stays that Gmail address. Google's consumer Apps Script limit is currently 100 email recipients per day; this is not enough to promise unrestricted public signup.

1. While signed in as `aerixcompany@gmail.com`, open [Google Apps Script](https://script.google.com/home/projects/create). Replace the starter code with the exact contents of [`google-apps-script/Code.gs`](../google-apps-script/Code.gs). Name the project `AERIX mail`. Do not paste the script token into the source code.
2. Click **Deploy > New deployment**, select **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**. Authorize the script under the AERIX Gmail account. Copy the Web app URL ending in `/exec`; never use the `/dev` test URL.
3. In the AERIX VS Code terminal, run `npm run setup:email-web`. Paste the `/exec` URL. The script prints a new random token **once**, then stores it encrypted for this Windows user. Do not screenshot or share that token.
4. Back in Apps Script, open **Project Settings > Script Properties > Add script property**. Set the name to `AERIX_TOKEN`, paste the token as its value, and save. This secret keeps outsiders who find the public web-app URL from sending mail through the AERIX account. Keep the URL and token out of frontend code and Git.
5. Turn X-VPN **on**. Run `npm run check:database` and `npm run check:email`. The email check makes an authenticated HTTPS request but sends no email. Restart `npm run dev` and use an inbox you control to test a real signup code. Re-running `setup:email-web` replaces the old local email settings, rotates the code-signing secret, and removes any stored SMTP App Password.

The Script owner is the only Gmail account authorized to send. Only AERIX server code calls the Web app; visitors never receive its token. If you modify `Code.gs`, deploy a **new version** under **Deploy > Manage deployments** before testing again. On a hosting service, set `EMAIL_WEB_URL`, `EMAIL_WEB_TOKEN`, and `EMAIL_CODE_SECRET` as private server environment variables; Windows DPAPI does not travel with the app. The actual deployment must be tested before inviting users. Rotate the token and deployment if either becomes public.

### Gmail SMTP alternative

For the local trial, use a separate AERIX Gmail address with 2-Step Verification. Create a Google App Password for the app, then run `npm run setup:email` in your VS Code terminal. Enter the AERIX Gmail address and the App Password at the hidden prompt; do not enter your normal Google password. The script saves the SMTP credentials and a newly generated email-code secret encrypted for your Windows account in `.secrets/email.dpapi`. It does not print them or put them in `.env`.

Run `npm run check:email` to verify the SMTP connection without sending a message. Restart `npm run dev`, then check `/api/config` for `"emailDelivery":true`. To test delivery, sign up with a test account whose inbox you control and enter the received six-digit code. Do not use real patient details for a test. A successful SMTP connection alone does not prove delivery to an inbox.

For hosting, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM and EMAIL_CODE_SECRET in the host's private server environment (see `.env.example`). The Windows-encrypted file works only with this local Windows account. Never put these values in frontend VITE_ variables. To switch later to a company-domain sender, update the host's sender settings or run the local setup again with the new service; existing verified user accounts do not need new passwords.

New accounts remain pending until the six-digit email code is accepted. Codes expire after 10 minutes, allow five attempts and can be resent after 60 seconds. Sign in with the same email/password to restart verification after closing the page. No real codes are printed in logs or exposed by the API. Passwords use salted scrypt hashing, not reversible encryption.

The admin workspace counts verified accounts separately from pending accounts. Simply visiting the website does not create a user. Appointments and requests are saved when users submit those actions. AI conversations are not saved to this database by the current implementation.

Tests use a private in-memory mail stub. They do not prove delivery to a real inbox. Live Atlas connection, actual email delivery, owner-admin provisioning, password recovery and hosting configuration must be completed before public launch.
