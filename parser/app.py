from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import math

app = FastAPI(title="Bills Parser", version="0.1")

class LineItem(BaseModel):
    desc: str
    sku: str
    qty: float
    unit: str
    rate: float
    disc: float = 0
    tax: float = 0

class Totals(BaseModel):
    subtotal: float
    tax: float
    discount: float
    rounding: float
    total: float

class Header(BaseModel):
    vendor: Optional[str] = None
    invoiceNo: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD
    terms: Optional[int] = None
    agent: Optional[str] = None
    billTo: Optional[str] = None
    shipTo: Optional[str] = None

class ParseResult(BaseModel):
    header: Header
    items: List[LineItem]
    totals: Totals
    anomalies: List[str] = Field(default_factory=list)

def r2(n: float) -> float:
    return math.floor(n * 100 + 0.5) / 100.0

def compute_totals(items: List[LineItem]) -> Totals:
    subtotal = sum((it.qty * it.rate * (1 - it.disc / 100.0)) for it in items)
    tax = sum(((it.qty * it.rate * (1 - it.disc / 100.0)) * (it.tax / 100.0)) if it.tax else 0 for it in items)
    discount = 0.0
    rounding = 0.0
    total = subtotal + tax - discount + rounding
    return Totals(subtotal=r2(subtotal), tax=r2(tax), discount=r2(discount), rounding=r2(rounding), total=r2(total))

SAMPLE_ITEMS = [
    LineItem(desc="BLOCK SCREW A - EX5CLASS", sku="D0054", qty=20, unit="PC", rate=4.5, disc=0, tax=0),
    LineItem(desc="METER ASSY TCB - Y15ZR V2 (2PV)", sku="3F0236", qty=2, unit="SET", rate=175, disc=0, tax=0),
    LineItem(desc="CLIP PANEL - WAVE", sku="W0088", qty=10, unit="PC", rate=1.8, disc=0, tax=0),
    LineItem(desc="HOSE BREATHER - EX5", sku="H0136", qty=12, unit="PC", rate=3.2, disc=0, tax=0),
]

@app.post("/parse", response_model=ParseResult)
async def parse(file: UploadFile = File(...)):
    # demo parser: we ignore actual PDF bytes for now and return a stable sample
    name = file.filename or "upload.pdf"
    today = datetime.utcnow().strftime("%Y-%m-%d")
    items = SAMPLE_ITEMS
    totals = compute_totals(items)
    header = Header(
        vendor="SUPPLIER SDN BHD",
        invoiceNo="I-DEMO-0001",
        date=today,
        terms=30,
        agent="AUTO",
        billTo="UCON MOTORSPORT",
        shipTo="UCON MOTORSPORT",
    )
    anomalies: list[str] = []
    return ParseResult(header=header, items=items, totals=totals, anomalies=anomalies)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=7071)