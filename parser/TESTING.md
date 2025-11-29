# PDF Parser Testing Guide

## Overview

This document provides manual testing instructions for the PDF invoice parser.

## Prerequisites

1. Install dependencies:
```bash
cd parser
pip install -r requirements.txt
```

2. (Optional) Install Tesseract OCR for fallback text extraction:
   - Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
   - Linux: `sudo apt-get install tesseract-ocr`
   - macOS: `brew install tesseract`

3. Start the parser server:
```bash
python app.py
# Or with custom port:
PORT=8000 python app.py
```

The parser will run on `http://localhost:8000` by default.

## Manual Testing Steps

### 1. Run Parser Locally

Start the FastAPI server:
```bash
cd parser
python app.py
```

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 2. Upload a Real PDF

#### Using curl:
```bash
curl -X POST http://localhost:8000/parse \
  -F "file=@samples/test.pdf" \
  -H "Content-Type: multipart/form-data"
```

#### Using Python requests:
```python
import requests

with open('samples/test.pdf', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/parse',
        files={'file': f}
    )
    print(response.json())
```

#### Using Postman/Insomnia:
- Method: POST
- URL: `http://localhost:8000/parse`
- Body: form-data
- Key: `file` (type: File)
- Value: Select your PDF file

### 3. Confirm Correct JSON Response

Expected response structure:
```json
{
  "header": {
    "vendor": "SUPPLIER NAME",
    "invoiceNo": "INV-001",
    "date": "2024-03-15",
    "terms": 30,
    "agent": "AUTO",
    "billTo": "Customer Name",
    "shipTo": "Shipping Address"
  },
  "items": [
    {
      "desc": "Product Description",
      "sku": "SKU123",
      "qty": 10.0,
      "unit": "PC",
      "rate": 100.0,
      "disc": 0.0,
      "tax": 0.0
    }
  ],
  "totals": {
    "subtotal": 1000.0,
    "tax": 0.0,
    "discount": 0.0,
    "rounding": 0.0,
    "total": 1000.0
  },
  "anomalies": []
}
```

### 4. Validate Totals

Check that:
- `subtotal` = sum of (qty × rate × (1 - disc/100)) for all items
- `tax` = sum of (subtotal × tax/100) for all items
- `total` = subtotal + tax - discount + rounding

Example calculation:
- Item 1: qty=10, rate=100, disc=5%, tax=10%
  - Line total = 10 × 100 × (1 - 5/100) = 950
  - Tax = 950 × 10/100 = 95
- Item 2: qty=5, rate=50, disc=0%, tax=0%
  - Line total = 5 × 50 = 250
  - Tax = 0
- Subtotal = 950 + 250 = 1200
- Total tax = 95
- Total = 1200 + 95 = 1295

### 5. Validate Items

For each item, verify:
- `desc` contains product/service description
- `sku` matches product code (if present in PDF)
- `qty` is a positive number
- `unit` is a valid unit (PC, SET, UNIT, etc.)
- `rate` is the unit price
- `disc` is discount percentage (0-100)
- `tax` is tax percentage (0-100)

### 6. Check Anomaly Detection

The parser will add messages to `anomalies` array for:
- Missing or invalid PDF header
- No text extracted (image-based PDFs)
- OCR fallback used
- Missing vendor or invoice number
- No valid line items found
- Individual item parsing errors

Example with anomalies:
```json
{
  "anomalies": [
    "No text could be extracted from PDF - may be image-based",
    "Used OCR fallback for text extraction",
    "Could not extract vendor or invoice number"
  ]
}
```

### 7. Debug Mode

Enable debug mode to see raw extracted text and parsing details:

```bash
DEBUG=true python app.py
```

Then make a request. The response will include a `_debug` field:
```json
{
  "header": {...},
  "items": [...],
  "totals": {...},
  "anomalies": [],
  "_debug": {
    "filename": "test.pdf",
    "text_length": 1234,
    "text_preview": "First 500 chars of extracted text...",
    "items_count": 5
  }
}
```

**Note:** Do NOT enable debug mode in production as it exposes internal parsing details.

## Example Test PDFs

### Test Case 1: Simple Invoice
- **File:** `samples/simple_invoice.pdf`
- **Expected:**
  - Vendor: Extracted from first line
  - Invoice No: Extracted from "Invoice No:" field
  - Date: Extracted and normalized to YYYY-MM-DD
  - Items: 3-5 line items with qty, rate
  - Totals: Calculated correctly

### Test Case 2: Complex Invoice with Discounts
- **File:** `samples/complex_invoice.pdf`
- **Expected:**
  - All header fields extracted
  - Items with discount percentages
  - Tax calculations correct
  - Multiple line items parsed

### Test Case 3: Image-based PDF (Scanned)
- **File:** `samples/scanned_invoice.pdf`
- **Expected:**
  - OCR fallback triggered
  - Anomaly: "Used OCR fallback for text extraction"
  - Basic fields still extracted (may be less accurate)

## Running Automated Tests

Run unit tests:
```bash
cd parser
python -m pytest tests/ -v
```

Or run specific test file:
```bash
python -m pytest tests/test_extract_header.py -v
python -m pytest tests/test_extract_items.py -v
```

For end-to-end PDF tests (requires test PDFs):
```bash
RUN_FULL_TESTS=true python -m pytest tests/test_end_to_end_pdf.py -v
```

## Troubleshooting

### Issue: "No text could be extracted"
- **Cause:** PDF is image-based (scanned)
- **Solution:** Ensure Tesseract OCR is installed for fallback

### Issue: "Failed to parse invoice"
- **Cause:** Invalid PDF format or corrupted file
- **Solution:** Verify PDF is valid, check file size > 100 bytes

### Issue: Empty items array
- **Cause:** Table structure not recognized
- **Solution:** Check PDF format, may need to adjust extraction patterns

### Issue: Incorrect totals
- **Cause:** Item extraction missed some fields
- **Solution:** Enable debug mode to see extracted text and validate parsing

## Performance Notes

- **CPU Usage:** Text extraction is lightweight
- **OCR Fallback:** CPU-intensive, only used when needed
- **Memory:** Minimal, processes PDF in chunks
- **Timeout:** 30 seconds default (configurable in backend)

## Integration with Backend

The backend calls the parser at `http://localhost:8000/parse`:
```typescript
const response = await axios.post(
  'http://localhost:8000/parse',
  formData,
  { timeout: 30000 }
);
```

Ensure the parser is running on port 8000 or update backend configuration.









