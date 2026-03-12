# VIRAI – Virtual Intelligent Research AI

A full-stack early-stage drug discovery platform powered by real molecular data from the PubChem database.

---

## Overview

VIRAI helps researchers:
- Fetch real molecular data (MW, LogP, TPSA, SMILES, etc.) from **PubChem**
- Compute **ADMET scores** using rule-based pharmacokinetic logic
- Perform **virtual screening** to rank and compare compound libraries
- Visualize results in a biotech-themed analytical dashboard

---

## Tech Stack

| Layer    | Tech                     |
|----------|--------------------------|
| Backend  | Python, FastAPI, Requests|
| Frontend | HTML, CSS, JavaScript    |
| Charts   | Chart.js                 |
| Data     | PubChem REST API (live)  |

---

## Project Structure

```
virai/
├── backend/
│   └── main.py          # FastAPI server
├── frontend/
│   ├── index.html       # Dashboard UI
│   ├── style.css        # Dark biotech theme
│   └── script.js        # Frontend logic & API calls
└── README.md
```

---

## Setup & Running

### 1. Install Python dependencies

```bash
pip install fastapi uvicorn requests
```

### 2. Start the backend

```bash
cd virai/backend
uvicorn main:app --reload
```

Backend runs at: `http://localhost:8000`

You can verify it's working: `http://localhost:8000/health`

### 3. Serve the frontend

Open a new terminal:

```bash
cd virai/frontend
python -m http.server 3000
```

### 4. Open in browser

```
http://localhost:3000
```

---

## API Endpoints

| Method | Endpoint              | Description                          |
|--------|-----------------------|--------------------------------------|
| GET    | `/health`             | Health check                         |
| GET    | `/compound/{name}`    | Fetch molecular data from PubChem    |
| POST   | `/admet`              | Calculate ADMET score                |

### Example: Fetch compound
```
GET http://localhost:8000/compound/aspirin
```

### Example: ADMET analysis
```json
POST http://localhost:8000/admet
{
  "name": "aspirin",
  "logp": 1.2,
  "mw": 180,
  "hbd": 1,
  "hba": 3,
  "tpsa": 63
}
```

---

## ADMET Scoring Logic

| Rule                   | Penalty |
|------------------------|---------|
| Molecular Weight > 500 | −20     |
| LogP > 5               | −15     |
| H-Bond Donors > 5      | −10     |
| H-Bond Acceptors > 10  | −10     |
| TPSA > 140             | −15     |

**Classification:**
- `> 80` → Excellent
- `60–80` → Good
- `40–60` → Moderate
- `< 40` → Poor

---

## Features

- **Dashboard** – Session statistics, ADMET history chart, score distribution
- **Compound Search** – Live PubChem lookup with structure image, properties, Lipinski badges
- **ADMET Analysis** – Score ring, component bars, radar chart, Lipinski checklist
- **Virtual Screening** – Batch processing with progress tracking and ranked results table
- **Analytics** – Distribution histogram, top compounds bar, LogP vs MW scatter plot

---

## Sample Compounds to Try

```
aspirin
caffeine
ibuprofen
paracetamol
morphine
penicillin
metformin
atorvastatin
sildenafil
naproxen
```

---

## Notes

- No heavy chemistry libraries needed (no RDKit)
- All molecular data is fetched live from PubChem
- The frontend auto-detects if the backend is offline
- CORS is enabled for local development

---

## Author

VIRAI – Academic Drug Discovery Platform  
Built with FastAPI + PubChem REST API
