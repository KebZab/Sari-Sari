# Aling Nena's Sari-Sari Store

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

## Current limitations

This is a demo, **not ready for public production use**. It seeds demo accounts, stores passwords in browser storage and Firestore, and `firestore.rules` currently allows all reads and writes. Replace the authentication and database security model before deploying it for real customers. The smoke check covers local ordering flows; it does not verify device GPS or live Firebase synchronization.
