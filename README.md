# GEO Auditor — Monorepo

Ši saugykla talpina pilną GEO (Generative Engine Optimization) Audito sistemos kodą ir konfigūracijas.

---

## Saugyklos struktūra

- **`frontend/`**: Next.js App Router (React, Stripe, Supabase client). Vercel priglobiama interneto svetainė.
- **`worker/`**: Node.js foninis procesas (Queue Worker), kuris stebi Supabase užklausas ir jas apdoroja per OpenClaw.
- **`openclaw/`**: OpenClaw agento konfigūracija (`openclaw.json`) ir autorinis GEO Audito įgūdis (`skills/geo-auditor/`).

---

## Paleidimas lokaliai ir VPS serveryje

### 1. Duomenų bazė (Supabase)
Duomenų bazės schema sukurta naudojant 3 pagrindines lenteles:
- `profiles` — vartotojų balansai ir informacija.
- `audit_requests` — GEO audito eilių užklausos.
- `transactions` — Stripe apmokėjimų istorija.

### 2. Interneto Svetainė (`frontend/`)
Svetainė priglobiama Vercel platformoje.
```bash
cd frontend
npm install
npm run dev
```

### 3. Eilės Workeris (`worker/`)
Worker procesas stebi Supabase duomenų bazę ir naudoja OpenClaw agentą užklausų apdorojimui.
```bash
cd worker
npm install
node worker.js
```
*Gamybinėje aplinkoje rekomenduojama paleisti per PM2:*
```bash
pm2 start worker.js --name geo-auditor-worker
```

### 4. OpenClaw Konfigūracija (`openclaw/`)
OpenClaw agentas atlieka semantinės analizės skaičiavimus.
- Įdiekite OpenClaw CLI globaliai: `npm install -g openclaw`
- Konfigūracija (`openclaw.json`) turi būti nukopijuota į `~/.openclaw/openclaw.json`.
- GEO įgūdis (Skill) iš `openclaw/skills/geo-auditor` turi būti patalpintas į `~/.openclaw/workspace/skills/geo-auditor`.
