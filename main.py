from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI(title="VIRAI - Virtual Intelligent Research AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"

class ADMETInput(BaseModel):
    name: str
    logp: float
    mw: float
    hbd: int
    hba: int
    tpsa: float

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/compound/{name}")
def get_compound(name: str):
    props_url = (
        f"{PUBCHEM_BASE}/compound/name/{name}/property/"
        "MolecularWeight,MolecularFormula,CanonicalSMILES,"
        "HBondDonorCount,HBondAcceptorCount,XLogP,TPSA/JSON"
    )
    try:
        resp = requests.get(props_url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.HTTPError:
        raise HTTPException(status_code=404, detail=f"Compound '{name}' not found in PubChem.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    props = data["PropertyTable"]["Properties"][0]
    cid = props.get("CID", "")
    image_url = f"{PUBCHEM_BASE}/compound/name/{name}/PNG"

    return {
        "name": name,
        "cid": cid,
        "molecular_formula": props.get("MolecularFormula", "N/A"),
        "molecular_weight": props.get("MolecularWeight", 0),
        "smiles": props.get("CanonicalSMILES", "N/A"),
        "hbd": props.get("HBondDonorCount", 0),
        "hba": props.get("HBondAcceptorCount", 0),
        "logp": props.get("XLogP", 0),
        "tpsa": props.get("TPSA", 0),
        "image_url": image_url,
    }

@app.post("/admet")
def admet_analysis(data: ADMETInput):
    score = 100

    if data.mw > 500:
        score -= 20
    if data.logp > 5:
        score -= 15
    if data.hbd > 5:
        score -= 10
    if data.hba > 10:
        score -= 10
    if data.tpsa > 140:
        score -= 15

    score = max(0, min(100, score))

    if score > 80:
        classification = "Excellent"
    elif score >= 60:
        classification = "Good"
    elif score >= 40:
        classification = "Moderate"
    else:
        classification = "Poor"

    # Derive component scores
    absorption = max(0, 100 - (max(0, data.tpsa - 60) * 0.5) - (max(0, data.mw - 300) * 0.05))
    distribution = max(0, 100 - abs(data.logp - 2) * 10)
    metabolism = max(0, 100 - (data.hbd * 5) - (data.hba * 3))
    excretion = max(0, 100 - (max(0, data.mw - 400) * 0.2))
    toxicity_risk = max(0, 100 - (max(0, data.logp - 3) * 12) - (max(0, data.tpsa - 100) * 0.3))

    return {
        "admet_score": round(score, 1),
        "classification": classification,
        "components": {
            "absorption": round(min(100, absorption), 1),
            "distribution": round(min(100, distribution), 1),
            "metabolism": round(min(100, metabolism), 1),
            "excretion": round(min(100, excretion), 1),
            "toxicity_risk": round(min(100, toxicity_risk), 1),
        }
    }
