# Notes pour l'équipe de relecture (App Review Information)

Brouillon à coller dans App Store Connect > Vérification de l'app > Notes (en anglais). À relire avant envoi : les points entre crochets sont à compléter par Benny.

---

**Summary**
Elearn Prepa is a study app for high-school students and entrance-exam candidates in French-speaking Africa. It offers lessons, quizzes, past exam papers (annales) and an AI-assisted photo correction. Core content is free; a time-limited Pass unlocks extended access and full corrections.

**Access without an account**
- The app opens without registration. The first screen is a welcome screen with no account request.
- Free features work for a guest: the Réviser tab, the annales catalogue (browse exam centres, years and subjects), free past papers, lessons and quizzes.
- An account is only needed to save progress across devices and to purchase a Pass. Sign-in options: Sign in with Apple and Google.

**How to test the Pass purchase (In-App Purchase)**
1. Open the app and go to the Moi tab, then tap the Pass entry (or open any locked correction and tap "Voir les Pass").
2. The Pass screen lists three options: weekly, monthly and exam-season (contest). Each is a consumable in-app purchase: `pass_weeks`, `pass_month`, `pass_contest`.
3. Select an option and tap the purchase button. The price shown is the App Store price in the local currency. The purchase is processed by StoreKit through RevenueCat.
4. "Restore purchases" is available on the same screen.
5. Sandbox: please use your Sandbox tester Apple ID on the device (Settings > App Store > Sandbox Account). No demo account is needed: the app works for a guest, and sign-in with Apple is available if you want to test an account.

**No other payment method on iOS**
On iOS, the app does not show Mobile Money, web checkout, parent payment links or any external purchase link. The only way to buy a Pass on iOS is the in-app purchase above. Credits (the in-app currency used for explanations and corrections) are not sold separately; they are granted by the app (welcome allowance and a weekly allowance) and spent on content. The Pass is the only paid product.

**Account deletion**
Moi tab > Settings > Delete my account. The deletion is available in the app.

**Background modes**
The app does not use background audio. Background modes are limited to remote notifications (study reminders and results).

**Contact**
Support: support@elearnprepa.com

**Notes on the previous rejections**
- Build 17 (3.1.0) — 5.1.1(v): browsing the annales catalogue and free content no longer requires an account. 3.1.1: paid digital content on iOS is only available through in-app purchase (see above); external payment paths are hidden on iOS.
- Build 18 (3.1.0, reviewed 28 Oct 2026) — 5.1.1(iv): the camera pre-permission screens (photo correction and exam-paper sheets) no longer use an "Allow" button: the button now reads "Continue", as requested, on both screens and in both app languages.
- Build 18 — 2.5.4: the previous submission stated that the background audio mode had been removed. That was only true of the hand-written configuration: two Expo config plugins silently added the "audio" background mode back during the build (expo-audio enables background playback by default, and expo-video adds it when picture-in-picture is on). Both are now explicitly disabled in the app configuration, and the generated Info.plist has been verified directly: it declares only "remote-notification". The app never plays audio or video in the background (its audio players are configured with background playback off).
