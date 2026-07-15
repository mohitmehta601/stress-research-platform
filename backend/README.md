# Stress Research Platform Backend

Express and MongoDB API used by the participant app and researcher dashboard.

## Scripts

```text
npm run dev                 Start API with nodemon.
npm start                   Start API with Node.
npm run create:super-admin  Create or update the configured super-admin.
npm run seed:super-admins   Seed required super-admin accounts.
npm run sync:mongodb        Synchronize MongoDB collections and indexes.
```

The API defaults to `http://127.0.0.1:8010/api`.

## Database shape

The participant app stores its active research data in two primary collections:

- `participants`: account, role, consent, and embedded profile data.
- `sessions`: session metadata plus embedded physiological, questionnaire, and doctor assessment data.

After changing schemas or connecting a fresh database, run the Mongo validator/index script from the repository root:

```text
mongosh "$MONGODB_URI/stress_research_platform" database/schema.js
```

For demo data that matches the app screens:

```text
mongosh "$MONGODB_URI/stress_research_platform" database/seed.js
```
