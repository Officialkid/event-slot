# Google OAuth Configuration — EventSlot Setup Guide

## Overview
This guide walks you through configuring Google OAuth 2.0 redirect URIs in Google Cloud Console to enable the EventSlot platform to authenticate users via Google.

**Current Status:**
- ✅ EventSlot infrastructure migrated to project: **eventslot** (ID: 458973844514)
- ✅ Domain mappings created: `eventsslot.com` → Cloud Run service
- ✅ NextAuth configuration: Ready (conditional GoogleProvider + CredentialsProvider)
- ⏳ **PENDING:** Google OAuth redirect URIs must be configured in Google Cloud Console

---

## Prerequisites

Before starting, have the following information ready:

| Item | Value |
|---|---|
| **Google Cloud Project** | eventslot (458973844514) |
| **OAuth 2.0 Client ID** | `458973844514-us2dl394j2cpc33agpjeaslgdmo8lbba.apps.googleusercontent.com` |
| **Custom Domain** | www.eventsslot.com |
| **Cloud Run Service URL** | https://eventslot-web-2lis6lk3ka-uc.a.run.app |
| **Auth Callback Path** | /api/auth/callback/google |

---

## Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **Sign in** with your Google account (must have access to EventSlot project)
3. In the top-left, click **Select a Project**
   - Search for: **eventslot** 
   - Select **eventslot (458973844514)**
   - Click **Open**

⚠️ **CRITICAL:** Ensure you've selected the **eventslot** project, NOT the old **dotted-spot-476513-i2** project.

---

## Step 2: Navigate to OAuth 2.0 Credentials

1. In the left sidebar, click **APIs & Services**
2. Click **Credentials**
3. Under **OAuth 2.0 Client IDs**, you should see:
   - **Type:** Web application
   - **Client ID:** 458973844514-us2dl394j2cpc33agpjeaslgdmo8lbba.apps.googleusercontent.com
4. Click on this Client ID to open its settings

If you don't see it, you may need to create it:
- Click **+ Create Credentials**
- Select **OAuth 2.0 Client ID**
- Choose **Web application**
- Name it: `eventslot-web`
- Proceed to the next step

---

## Step 3: Configure Authorized Redirect URIs

Once the OAuth 2.0 Client ID settings are open:

1. Scroll down to **Authorized redirect URIs** section
2. You should see a list of URIs (or it may be empty)
3. **Add or verify BOTH of these URIs exist:**

   **URI 1 (Custom Domain — Production):**
   ```
   https://www.eventsslot.com/api/auth/callback/google
   ```

   **URI 2 (Cloud Run URL — Direct Access):**
   ```
   https://eventslot-web-2lis6lk3ka-uc.a.run.app/api/auth/callback/google
   ```

### If URIs are missing:

1. Click **+ Add URI** (if visible) or **Add to list**
2. Paste the first URI: `https://www.eventsslot.com/api/auth/callback/google`
3. Press Enter or click the add button
4. Click **+ Add URI** again
5. Paste the second URI: `https://eventslot-web-2lis6lk3ka-uc.a.run.app/api/auth/callback/google`
6. Press Enter

### If URIs already exist but are incorrect:

1. Delete any old URIs (e.g., pointing to old projects or `http://` instead of `https://`)
2. Add the two correct URIs above

---

## Step 4: Save Configuration

1. Scroll to the bottom of the page
2. Click **Save** button
3. You should see a confirmation message: "OAuth client updated"

**Important:** The changes take effect immediately, but Google caches settings for a few minutes. If OAuth still fails, wait 2-3 minutes and retry.

---

## Step 5: Verify OAuth Configuration

Once saved, verify that OAuth is working:

### Test 1: Check Available Providers
```bash
curl -s https://eventslot-web-2lis6lk3ka-uc.a.run.app/api/auth/providers \
  -H "Host: www.eventsslot.com" | jq .
```

Expected response should include:
```json
{
  "google": { "id": "google", "name": "Google", "signinUrl": "...", "callbackUrl": "..." },
  "credentials": { "id": "credentials", "name": "credentials", "signinUrl": "...", "callbackUrl": "..." }
}
```

### Test 2: Initiate OAuth Flow
1. Go to https://www.eventsslot.com/signin
2. Click **"Sign in with Google"** button
3. You should be redirected to Google's login page
4. After logging in, you should be redirected back to https://www.eventsslot.com
5. You should see a success message or user profile

---

## Troubleshooting

### Issue: "Redirect URI mismatch" Error
**Cause:** The URI in Google Cloud Console doesn't exactly match the callback URL.

**Solution:**
- Ensure **NO trailing slashes** (`/api/auth/callback/google` not `/api/auth/callback/google/`)
- Ensure **https://** (not http://)
- Check for typos or extra spaces
- Verify you're in the correct project (eventslot)

### Issue: OAuth Still Shows "error=google"
**Cause:** Google redirect URIs are not yet saved, or there's a network delay.

**Solution:**
1. Wait 2-3 minutes for Google's caching
2. Clear your browser cookies: https://www.eventsslot.com → Settings → Clear cookies
3. Try signing in again
4. If still failing, check:
   - Browser Developer Tools (F12) → Network tab
   - Look for the request to `accounts.google.com`
   - Check the response status and error message

### Issue: "Custom domain certificate not ready"
**Cause:** Google Cloud hasn't yet provisioned an SSL certificate for your custom domain.

**Solution:**
- This happens automatically after you update your DNS records
- For now, you can test OAuth via the Cloud Run URL: https://eventslot-web-2lis6lk3ka-uc.a.run.app
- Once DNS is configured and certificate is ready, the custom domain (www.eventsslot.com) will fully work

---

## DNS Configuration (Optional — For Custom Domain)

If your custom domain certificate isn't issuing, you may need to update DNS records:

1. Go back to Google Cloud Console
2. Navigate to **Cloud Run** → **Domain Mappings**
3. Click on **eventsslot.com** or **www.eventsslot.com**
4. Under **DNS Records**, you'll see A and AAAA records
5. Update your domain registrar's DNS settings with these records
6. Wait 24-48 hours for DNS to propagate
7. Google will automatically provision the certificate once DNS is verified

---

## Environment Variables Reference

For reference, here are the OAuth-related environment variables currently set in Cloud Run:

| Variable | Value | Source |
|---|---|---|
| NEXTAUTH_URL | https://www.eventsslot.com | Secret: EVENTSLOT_NEXTAUTH_URL |
| GOOGLE_CLIENT_ID | 458973844514-us2dl394j2cpc33agpjeaslgdmo8lbba.apps.googleusercontent.com | Secret: EVENTSLOT_GOOGLE_CLIENT_ID |
| GOOGLE_CLIENT_SECRET | (stored securely) | Secret: EVENTSLOT_GOOGLE_CLIENT_SECRET |
| NEXTAUTH_SECRET | (stored securely) | Secret: NEXTAUTH_SECRET |

All values are correctly configured. You only need to verify the Google OAuth redirect URIs in Google Cloud Console.

---

## Summary

✅ **What's Done:**
- Infrastructure migrated to eventslot project
- Cloud Run service deployed with latest code
- NextAuth configured with conditional GoogleProvider
- Secrets configured in Cloud Secret Manager
- Domain mappings created for www.eventsslot.com

⏳ **What You Need to Do:**
1. Open Google Cloud Console
2. Navigate to APIs & Services → Credentials
3. Select the OAuth 2.0 Client ID (458973844514-...)
4. Add/verify these redirect URIs:
   - https://www.eventsslot.com/api/auth/callback/google
   - https://eventslot-web-2lis6lk3ka-uc.a.run.app/api/auth/callback/google
5. Click Save
6. Test OAuth flow by visiting https://www.eventsslot.com/signin

---

## Questions or Issues?

If you encounter any problems:
1. Check the [Troubleshooting](#troubleshooting) section above
2. Verify browser Developer Tools (F12) for network errors
3. Confirm the OAuth Client ID and Project ID match what's shown here
4. Wait 2-3 minutes for Google's settings to propagate

Once you've configured the redirect URIs and see OAuth working, all 5 bugs will be resolved! 🎉
