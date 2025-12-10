"""
PDF text extraction utilities with fallback mechanisms.
Supports pdfplumber, PyMuPDF, and optional OCR fallback.
"""
import io
from typing import Optional, Tuple

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


def extract_text_pdfplumber(pdf_bytes: bytes) -> Tuple[str, bool]:
    """
    Extract text from PDF using pdfplumber.
    Returns (text, success).
    """
    if not PDFPLUMBER_AVAILABLE:
        return "", False
    
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        text_parts = []
        
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        
        text = "\n".join(text_parts)
        return text, len(text.strip()) > 0
    except Exception as e:
        return f"pdfplumber error: {str(e)}", False


def extract_text_pymupdf(pdf_bytes: bytes) -> Tuple[str, bool]:
    """
    Extract text from PDF using PyMuPDF (fitz).
    Returns (text, success).
    """
    if not PYMUPDF_AVAILABLE:
        return "", False
    
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text_parts = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_text = page.get_text()
            if page_text:
                text_parts.append(page_text)
        
        doc.close()
        text = "\n".join(text_parts)
        return text, len(text.strip()) > 0
    except Exception as e:
        return f"pymupdf error: {str(e)}", False


def extract_text_ocr(pdf_bytes: bytes) -> Tuple[str, bool]:
    """
    Extract text from PDF using OCR (Tesseract) as fallback.
    Converts PDF pages to images and runs OCR.
    Returns (text, success).
    """
    if not OCR_AVAILABLE or not PYMUPDF_AVAILABLE:
        return "", False
    
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text_parts = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            # Render page as image
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better OCR
            img_bytes = pix.tobytes("png")
            
            # Convert to PIL Image
            img = Image.open(io.BytesIO(img_bytes))
            
            # Run OCR
            ocr_text = pytesseract.image_to_string(img)
            if ocr_text:
                text_parts.append(ocr_text)
        
        doc.close()
        text = "\n".join(text_parts)
        return text, len(text.strip()) > 0
    except Exception as e:
        return f"OCR error: {str(e)}", False


def extract_text(pdf_bytes: bytes, use_ocr: bool = False) -> str:
    """
    Extract text from PDF using best available method.
    Tries pdfplumber first, then PyMuPDF, then OCR if enabled.
    Returns extracted text or empty string.
    """
    # Try pdfplumber first (best for structured text)
    text, success = extract_text_pdfplumber(pdf_bytes)
    if success:
        return text
    
    # Fallback to PyMuPDF
    text, success = extract_text_pymupdf(pdf_bytes)
    if success:
        return text
    
    # Last resort: OCR (slower, CPU-intensive)
    if use_ocr:
        text, success = extract_text_ocr(pdf_bytes)
        if success:
            return text
    
    return text or "No text could be extracted from PDF"


