"""
Invoice field extraction from extracted text.
Extracts header fields and line items using regex and pattern matching.
"""
import re
from typing import List, Optional, Dict, Tuple
from datetime import datetime


def normalize_number(text: str) -> float:
    """
    Normalize number strings to float.
    Handles commas, spaces, currency symbols.
    """
    if not text:
        return 0.0
    
    # Remove currency symbols, commas, spaces
    cleaned = re.sub(r'[^\d.\-]', '', str(text).strip())
    
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse various date formats to YYYY-MM-DD.
    Supports: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.
    """
    if not date_str:
        return None
    
    date_str = date_str.strip()
    
    # Common date patterns
    patterns = [
        (r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', '%d/%m/%Y'),  # DD/MM/YYYY or DD-MM-YYYY
        (r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', '%Y-%m-%d'),  # YYYY-MM-DD
        (r'(\d{1,2})[/-](\d{1,2})[/-](\d{2})', '%d/%m/%y'),  # DD/MM/YY
    ]
    
    for pattern, fmt in patterns:
        match = re.search(pattern, date_str)
        if match:
            try:
                if fmt == '%d/%m/%Y' or fmt == '%d-%m-%Y':
                    day, month, year = match.groups()
                    date_obj = datetime.strptime(f"{day}/{month}/{year}", "%d/%m/%Y")
                elif fmt == '%Y-%m-%d':
                    year, month, day = match.groups()
                    date_obj = datetime.strptime(f"{year}-{month}-{day}", "%Y-%m-%d")
                else:
                    day, month, year = match.groups()
                    date_obj = datetime.strptime(f"{day}/{month}/{year}", "%d/%m/%y")
                
                return date_obj.strftime("%Y-%m-%d")
            except ValueError:
                continue
    
    return None


def extract_header(text: str) -> Dict[str, Optional[str]]:
    """
    Extract header fields from invoice text.
    Returns dict with vendor, invoiceNo, date, terms, billTo, shipTo.
    """
    header = {
        "vendor": None,
        "invoiceNo": None,
        "date": None,
        "terms": None,
        "agent": None,
        "billTo": None,
        "shipTo": None
    }
    
    lines = text.split('\n')
    text_upper = text.upper()
    
    # Extract Invoice Number
    invoice_patterns = [
        r'invoice\s*(?:no|number|#|num)[:.\s]*([A-Z0-9\-]+)',
        r'inv\s*(?:no|number|#|num)[:.\s]*([A-Z0-9\-]+)',
        r'invoice[:.\s]*([A-Z0-9\-]+)',
        r'#\s*([A-Z0-9\-]+)',
    ]
    for pattern in invoice_patterns:
        match = re.search(pattern, text_upper, re.IGNORECASE)
        if match:
            header["invoiceNo"] = match.group(1).strip()
            break
    
    # Extract Date
    date_patterns = [
        r'(?:invoice\s*)?date[:.\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'date[:.\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'(\d{1,2}[/-]\d{1,2}[/-]\d{4})',  # Generic date pattern
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            parsed_date = parse_date(match.group(1))
            if parsed_date:
                header["date"] = parsed_date
                break
    
    # Extract Terms
    terms_patterns = [
        r'terms?[:.\s]*(\d+)\s*(?:days?|day)',
        r'payment\s*terms?[:.\s]*(\d+)',
        r'net\s*(\d+)',
    ]
    for pattern in terms_patterns:
        match = re.search(pattern, text_upper, re.IGNORECASE)
        if match:
            try:
                header["terms"] = int(match.group(1))
            except ValueError:
                pass
            break
    
    # Extract Vendor (usually first line or company name at top)
    # Look for company name patterns in first 10 lines
    vendor_patterns = [
        r'^([A-Z][A-Z\s&.,]+(?:SDN\s*BHD|PTE\s*LTD|LTD|INC|LLC|CORP))',
        r'^([A-Z][A-Z\s&.,]{3,40})$',
    ]
    for line in lines[:10]:
        line_clean = line.strip()
        if len(line_clean) > 3 and len(line_clean) < 100:
            for pattern in vendor_patterns:
                match = re.match(pattern, line_clean)
                if match and 'invoice' not in line_clean.lower():
                    header["vendor"] = line_clean
                    break
            if header["vendor"]:
                break
    
    # Extract Bill To
    billto_patterns = [
        r'bill\s*to[:.\s]*(.+?)(?:\n|ship\s*to|$)',
        r'billing\s*address[:.\s]*(.+?)(?:\n|ship|$)',
    ]
    for pattern in billto_patterns:
        match = re.search(pattern, text_upper, re.IGNORECASE | re.DOTALL)
        if match:
            billto = match.group(1).strip()
            # Take first 2-3 lines
            billto_lines = [l.strip() for l in billto.split('\n')[:3] if l.strip()]
            header["billTo"] = ' '.join(billto_lines) if billto_lines else None
            break
    
    # Extract Ship To
    shipto_patterns = [
        r'ship\s*to[:.\s]*(.+?)(?:\n|$)',
        r'shipping\s*address[:.\s]*(.+?)(?:\n|$)',
    ]
    for pattern in shipto_patterns:
        match = re.search(pattern, text_upper, re.IGNORECASE | re.DOTALL)
        if match:
            shipto = match.group(1).strip()
            shipto_lines = [l.strip() for l in shipto.split('\n')[:3] if l.strip()]
            header["shipTo"] = ' '.join(shipto_lines) if shipto_lines else None
            break
    
    return header


def find_table_blocks(text: str) -> List[str]:
    """
    Find potential table blocks in text.
    Returns list of text blocks that might contain item tables.
    """
    lines = text.split('\n')
    table_blocks = []
    current_block = []
    
    # Look for lines with multiple columns (numbers, separators)
    for line in lines:
        # Check if line looks like table row (has multiple numbers/separators)
        if re.search(r'\d+.*[\s|,]\d+', line) or re.search(r'[|\t]', line):
            current_block.append(line)
        else:
            if len(current_block) >= 2:  # At least 2 rows
                table_blocks.append('\n'.join(current_block))
            current_block = []
    
    if len(current_block) >= 2:
        table_blocks.append('\n'.join(current_block))
    
    return table_blocks


def extract_items(text: str) -> List[Dict[str, any]]:
    """
    Extract line items from invoice text.
    Looks for table-like structures with description, qty, rate, etc.
    Returns list of item dicts.
    """
    items = []
    lines = text.split('\n')
    
    # Find the items section (usually after "Item", "Description", "Qty", etc.)
    items_start = -1
    items_end = -1
    
    for i, line in enumerate(lines):
        line_upper = line.upper()
        # Look for table header
        if any(keyword in line_upper for keyword in ['ITEM', 'DESC', 'QTY', 'RATE', 'AMOUNT', 'PRICE']):
            items_start = i + 1
            break
    
    if items_start == -1:
        # Try to find items by pattern (lines with numbers that look like items)
        items_start = 0
    
    # Find end of items (usually before "Subtotal", "Total", "Tax", etc.)
    for i in range(items_start, len(lines)):
        line_upper = lines[i].upper()
        if any(keyword in line_upper for keyword in ['SUBTOTAL', 'TOTAL', 'TAX', 'GRAND TOTAL', 'BALANCE']):
            items_end = i
            break
    
    if items_end == -1:
        items_end = len(lines)
    
    # Extract items from the identified section
    item_lines = lines[items_start:items_end]
    
    for line in item_lines:
        line = line.strip()
        if not line or len(line) < 5:
            continue
        
        # Skip header-like lines
        if any(keyword in line.upper() for keyword in ['DESCRIPTION', 'ITEM', 'QTY', 'UNIT', 'RATE', 'AMOUNT']):
            continue
        
        # Try to parse line as item
        # Pattern: description [sku] qty unit rate [disc] [tax]
        # Split by whitespace, tabs, or pipes
        parts = re.split(r'[\s\t|]+', line)
        
        if len(parts) < 3:
            continue
        
        # Try to identify numeric columns (qty, rate, disc, tax)
        # Usually: description (text) ... qty (number) unit (text) rate (number) ...
        item = {
            "desc": "",
            "sku": "",
            "qty": 0.0,
            "unit": "PC",
            "rate": 0.0,
            "disc": 0.0,
            "tax": 0.0
        }
        
        # Find numbers in the line
        numbers = re.findall(r'\d+\.?\d*', line)
        
        # Description is usually first text part(s)
        desc_parts = []
        for part in parts:
            if re.match(r'^\d+\.?\d*$', part):
                break
            desc_parts.append(part)
        item["desc"] = ' '.join(desc_parts).strip() or "Item"
        
        # Extract quantities and rates
        if len(numbers) >= 1:
            item["qty"] = normalize_number(numbers[0])
        if len(numbers) >= 2:
            item["rate"] = normalize_number(numbers[1])
        if len(numbers) >= 3:
            item["disc"] = normalize_number(numbers[2])
        if len(numbers) >= 4:
            item["tax"] = normalize_number(numbers[3])
        
        # Try to find SKU (usually alphanumeric code, often in brackets or separate)
        sku_match = re.search(r'\[([A-Z0-9\-]+)\]|([A-Z]{2,}\d{2,})', line)
        if sku_match:
            item["sku"] = sku_match.group(1) or sku_match.group(2) or ""
        
        # Unit detection
        unit_match = re.search(r'\b(PC|SET|UNIT|PCS|EA|BOX|PKG)\b', line.upper())
        if unit_match:
            item["unit"] = unit_match.group(1).upper()
        
        # Only add if we have at least description and qty/rate
        if item["desc"] and (item["qty"] > 0 or item["rate"] > 0):
            items.append(item)
    
    return items


