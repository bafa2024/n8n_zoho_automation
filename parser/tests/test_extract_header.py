"""
Tests for header field extraction.
"""
import unittest
from extract_fields import extract_header, parse_date


class TestExtractHeader(unittest.TestCase):
    
    def test_extract_invoice_number(self):
        text = """
        INVOICE
        Invoice No: INV-2024-001
        Date: 15/03/2024
        """
        header = extract_header(text)
        self.assertIsNotNone(header.get("invoiceNo"))
        self.assertIn("INV-2024-001", header.get("invoiceNo", "").upper())
    
    def test_extract_date(self):
        text = """
        Invoice Date: 15/03/2024
        """
        header = extract_header(text)
        self.assertIsNotNone(header.get("date"))
        self.assertEqual(header.get("date"), "2024-03-15")
    
    def test_extract_terms(self):
        text = """
        Payment Terms: 30 days
        """
        header = extract_header(text)
        self.assertEqual(header.get("terms"), 30)
    
    def test_extract_vendor(self):
        text = """
        SUPPLIER SDN BHD
        123 Main Street
        Invoice No: INV-001
        """
        header = extract_header(text)
        self.assertIsNotNone(header.get("vendor"))
    
    def test_extract_bill_to(self):
        text = """
        Bill To:
        UCON MOTORSPORT
        456 Business Ave
        """
        header = extract_header(text)
        self.assertIsNotNone(header.get("billTo"))
        self.assertIn("UCON", header.get("billTo", "").upper())
    
    def test_parse_date_formats(self):
        # Test various date formats
        self.assertEqual(parse_date("15/03/2024"), "2024-03-15")
        self.assertEqual(parse_date("2024-03-15"), "2024-03-15")
        self.assertEqual(parse_date("15-03-2024"), "2024-03-15")
        self.assertIsNone(parse_date("invalid date"))
        self.assertIsNone(parse_date(""))


if __name__ == "__main__":
    unittest.main()


