from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import math
import os
import pathlib
from pdf_utils import extract_text
from extract_fields import extract_header, extract_items, normalize_number

app = FastAPI(title="Bills Parser", version="0.1")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Debug mode from environment variable
DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"

# Configure logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

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

async def parse_pdf_file(file: Optional[UploadFile] = None, pdf_bytes: Optional[bytes] = None) -> ParseResult:
    """
    Internal function to parse PDF file.
    Used by both /parse and /api/upload endpoints.
    Can accept either UploadFile or bytes directly.
    """
    if file:
        name = file.filename or "upload.pdf"
        # Read PDF bytes from file
        pdf_bytes = await file.read()
    else:
        name = "upload.pdf"
        if not pdf_bytes:
            raise ValueError("Either file or pdf_bytes must be provided")
    
    anomalies: list[str] = []
    raw_text = ""
    
    if not pdf_bytes or len(pdf_bytes) < 100:
        raise HTTPException(status_code=400, detail="Invalid PDF file: file too small or empty")
    
    # Verify PDF header
    if not pdf_bytes.startswith(b'%PDF'):
        anomalies.append("File may not be a valid PDF (missing PDF header)")
    
    # Extract text from PDF
    try:
        raw_text = extract_text(pdf_bytes, use_ocr=False)
        
        if not raw_text or len(raw_text.strip()) < 10:
            anomalies.append("No text could be extracted from PDF - may be image-based")
            # Try OCR as fallback
            raw_text = extract_text(pdf_bytes, use_ocr=True)
            if raw_text and len(raw_text.strip()) > 10:
                anomalies.append("Used OCR fallback for text extraction")
    except Exception as e:
        error_msg = f"Text extraction failed: {str(e)}"
        anomalies.append(error_msg)
        if DEBUG_MODE:
            raise HTTPException(status_code=400, detail=error_msg)
        # Continue with empty text, will return empty results
    
    # Extract header fields
    header_data = extract_header(raw_text)
    header = Header(
        vendor=header_data.get("vendor"),
        invoiceNo=header_data.get("invoiceNo"),
        date=header_data.get("date"),
        terms=header_data.get("terms"),
        agent=header_data.get("agent") or "AUTO",
        billTo=header_data.get("billTo"),
        shipTo=header_data.get("shipTo"),
    )
    
    # Extract line items
    try:
        items_data = extract_items(raw_text)
        items: List[LineItem] = []
        
        for item_data in items_data:
            try:
                item = LineItem(
                    desc=item_data.get("desc", "") or "Item",
                    sku=item_data.get("sku", "") or "",
                    qty=float(item_data.get("qty", 0)) or 0.0,
                    unit=item_data.get("unit", "PC") or "PC",
                    rate=float(item_data.get("rate", 0)) or 0.0,
                    disc=float(item_data.get("disc", 0)) or 0.0,
                    tax=float(item_data.get("tax", 0)) or 0.0,
                )
                items.append(item)
            except Exception as e:
                anomalies.append(f"Failed to parse item: {str(e)}")
                continue
        
        if not items:
            anomalies.append("No line items could be extracted from PDF")
            # Create a placeholder item to avoid empty items list
            items = [LineItem(desc="No items found", sku="", qty=0, unit="PC", rate=0, disc=0, tax=0)]
    except Exception as e:
        error_msg = f"Item extraction failed: {str(e)}"
        anomalies.append(error_msg)
        items = [LineItem(desc="Extraction error", sku="", qty=0, unit="PC", rate=0, disc=0, tax=0)]
    
    # Compute totals
    totals = compute_totals(items)
    
    # Validate extracted data
    if not header.vendor and not header.invoiceNo:
        anomalies.append("Could not extract vendor or invoice number")
    
    if len(items) == 0 or (len(items) == 1 and items[0].qty == 0 and items[0].rate == 0):
        anomalies.append("No valid line items found")
    
    # Build response
    result = ParseResult(
        header=header,
        items=items,
        totals=totals,
        anomalies=anomalies
    )
    
    return result

@app.post("/parse", response_model=ParseResult)
async def parse(file: UploadFile = File(...)):
    """
    Parse PDF invoice and extract structured data.
    Returns header, items, totals, and anomalies.
    """
    name = file.filename or "upload.pdf"
    
    try:
        result = await parse_pdf_file(file=file)
        
        # Add debug info if enabled
        if DEBUG_MODE:
            result_dict = result.model_dump()
            result_dict["_debug"] = {
                "filename": name,
            }
            return result_dict
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to parse invoice: {str(e)}"
        if DEBUG_MODE:
            import traceback
            error_msg += f"\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "parser"}

@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    """
    Upload endpoint for frontend integration.
    Accepts multipart/form-data with file field.
    Saves file to /data/uploads and returns parsed result.
    """
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Received upload request: filename={file.filename}, content_type={file.content_type}")
        
        # Read file content once
        content = await file.read()
        logger.info(f"Read {len(content)} bytes from file")
        
        if not content or len(content) < 100:
            raise HTTPException(status_code=400, detail="Invalid PDF file: file too small or empty")
        
        # Ensure uploads directory exists
        uploads_dir = pathlib.Path("data/uploads")
        uploads_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Uploads directory: {uploads_dir.absolute()}")
        
        # Save file to disk
        file_path = uploads_dir / (file.filename if file.filename else "upload.pdf")
        file_path.write_bytes(content)
        logger.info(f"Saved file to: {file_path}")
        
        # Parse the PDF directly from bytes
        logger.info("Starting PDF parsing...")
        parsed_result = await parse_pdf_file(pdf_bytes=content)
        logger.info(f"Parsing complete. Items: {len(parsed_result.items)}")
        
        # Return success response
        response = {
            "ok": True,
            "data": parsed_result.model_dump()
        }
        logger.info("Returning success response")
        return response
        
    except HTTPException as e:
        logger.error(f"HTTPException: {e.status_code} - {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Exception in api_upload: {str(e)}", exc_info=True)
        error_msg = f"Failed to upload and parse invoice: {str(e)}"
        if DEBUG_MODE:
            import traceback
            error_msg += f"\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_msg)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)