# NelGlenn's Sari-Sari Store

A single-page ordering and delivery demo for a sari-sari store. Customers can browse products, place cash-on-delivery orders, set a map drop-off pin, and view delivery status. The admin view manages products, inventory, orders, and delivery locations.

## Run locally

Serve this directory over HTTP and open `sari-sari-store.html`. For example:

```sh
python -m http.server 8765
```

Open `http://localhost:8765/sari-sari-store.html` in a browser. Location access requires a secure context such as `localhost` or HTTPS.

Run the offline smoke check with `node smoke-check.cjs`.

## Map setup

The admin delivery screen asks for the device's GPS location. Open it on the device at the store and allow location access to set the shared store pin. Customers select a drop-off pin at checkout using device GPS or the map. Rider location sharing starts from the admin delivery screen when an order is **Out for Delivery**; the device sharing GPS must stay on that screen.

Maps use OpenStreetMap tiles and OSRM road routing. Browser location access and network access are required for live maps and cross-device tracking.

## Deploy to Vercel

This repository includes a preconfigured `vercel.json` for seamless static hosting on Vercel.

### Option 1: Via Vercel CLI
Run the following in the project root:
```sh
npx vercel
```
Follow the interactive prompts to link and deploy to your Vercel account. For production deployment:
```sh
npx vercel --prod
```

### Option 2: Via GitHub / Git Repository
1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In the [Vercel Dashboard](https://vercel.com/new), click **Add New... -> Project**.
3. Import the repository.
4. Leave Framework Preset as **Other** (Root directory `./`).
5. Click **Deploy**.

Vercel will serve `sari-sari-store.html` at the root domain (`/`), provide automatic HTTPS (required for GPS geolocation and maps), and connect directly to the Cloud Firestore database.

## Google Authentication

Customers can also sign in using **Sign in with Google**:
- Uses **Firebase Authentication** (`sarisaristore-ffa71`) via Google OAuth popup or redirect.
- New Google users are automatically provisioned an account with their Google full name, email, and avatar.
- To enable live Google Sign-in on Firebase:
  1. Open [Firebase Console](https://console.firebase.google.com/project/sarisaristore-ffa71/authentication/providers).
  2. Navigate to **Authentication > Sign-in method**.
  3. Click **Google**, toggle **Enable**, select the support email, and save.
  4. In **Settings > Authorized domains**, ensure `sari-sari-mu.vercel.app` (or your custom domain) is added.
- An **Instant Demo Account** option is also built-in for testing the Google customer experience without delay.

## Seeded Accounts

The application automatically seeds default accounts for testing. Use these credentials to log in:

| Role | Name | Phone Number (Username) | Password | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | NelGlenn (Store Owner) | `09171234567` | `admin123` | Full access to Admin Dashboard, Inventory, Products, Orders, and Live Store GPS Setup. |
| **Admin** | Zabal (Admin) | `zabal@sarisari.com` | `123456` | Full admin access. |
| **Customer** | Juan Dela Cruz | `09201112222` | `juan123` | Customer account (Pre-configured address: 123 Mabini St., Barangay San Isidro). |
| **Customer** | Maria Santos | `09183334444` | `maria123` | Customer account (Pre-configured address: 45 Taft Ave., Barangay San Isidro). |
| **Customer** | Sign in with Google | *(Google Account)* | *(OAuth)* | 1-Tap Google login; auto-creates customer profile. |

## Current limitations

This is a demo, **not ready for public production use**. It seeds demo accounts, stores passwords in browser storage and Firestore, and `firestore.rules` currently allows all reads and writes. Replace the authentication and database security model before deploying it for real customers. The smoke check covers local ordering flows; it does not verify device GPS or live Firebase synchronization.
