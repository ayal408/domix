# System email sender

Administrators can open **Administration → System email** (`/admin/email`) to connect or replace the Gmail account used by all verification, password reset, support and notification emails. Managers cannot access these settings.

The existing server-side `Gmail` configuration supplies `ClientId` and `ClientSecret` (`GMAIL__CLIENTID` and `GMAIL__CLIENTSECRET`). Existing configured `Email` and `RefreshToken` continue to work until an administrator replaces or disconnects the account. No credentials are entered in the administration screen, and the existing AUTH service is unchanged.

For connecting an account through the screen, register the following authorized redirect URI on the **existing** Google OAuth web client:

```
https://YOUR-DOMIX-HOST/api/email/gmail/callback
```

The default is `CLIENT_APP_URL` followed by `/api/email/gmail/callback`. If the API has a different public host, set the data server configuration `Gmail:RedirectUri` (`GMAIL__REDIRECTURI`) to its exact callback URL. Keep `CLIENT_APP_URL` set to the frontend URL. Existing Google sign-in redirect URIs remain in place. Enable the Gmail API for the existing Google project and allow the `gmail.send` scope; Google's consent configuration determines which accounts can authorize it.

Deploy the updated client and data server together. The new database migration runs through the existing startup migration mechanism. Connect the sending account, save its display name, optional reply-to and signature, then send a test to an address you control. Delivery history shows the latest 50 results without storing message bodies. The test template only changes test messages; verification and notification content remains managed by its existing services.

Connected refresh tokens are encrypted in the database using a purpose-specific key derived from the existing `JWT_SECRET`. Keep that secret stable across server restarts and replicas. Rotating it requires reconnecting any account connected through this screen. Disconnecting disables email sending, including the environment-configured fallback; reconnecting enables it again. OAuth consent state is single-use, expires after ten minutes and is held in memory, so multi-instance deployments must route initiation and callback to the same instance.

## Support and language

Every support request sends an email to `ADMIN_NOTIFICATION_EMAIL` if configured, otherwise to the system sender account. The requester also receives an acknowledgement with their request reference when an email address is available. Delivery errors do not remove the saved ticket or prevent it from appearing in the support inbox.

Verification, password resets, message notifications, saved-search alerts and support messages use the branded email layout with localized subjects, buttons and footer. Hebrew is the default and uses right-to-left layout; English, Spanish and French follow the recipient's saved interface language. The client stores language changes through the authenticated `/api/preferences/language` endpoint so background alerts use the same preference. Registration forwards the selected language before the first verification email is sent; authentication, cookies and token handling retain their existing behavior. Guest support requests include the selected interface language directly. Administrator-authored signature and test-template text remains as entered.
