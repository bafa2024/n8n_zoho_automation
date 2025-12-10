"""
End-to-end tests for PDF parsing.
Requires actual PDF files for testing.
"""
import unittest
import os
from pathlib import Path
from pdf_utils import extract_text
from extract_fields import extract_header, extract_items


class TestEndToEndPDF(unittest.TestCase):
    
    def setUp(self):
        """Set up test environment."""
        self.test_pdf_dir = Path(__file__).parent.parent.parent / "samples"
        self.test_pdf = self.test_pdf_dir / "test.pdf"
    
    def test_text_extraction(self):
        """Test that we can extract text from a PDF."""
        if not self.test_pdf.exists():
            self.skipTest(f"Test PDF not found at {self.test_pdf}")
        
        with open(self.test_pdf, "rb") as f:
            pdf_bytes = f.read()
        
        text = extract_text(pdf_bytes, use_ocr=False)
        self.assertIsInstance(text, str)
        self.assertGreater(len(text), 0, "Should extract some text from PDF")
    
    def test_header_extraction_from_pdf(self):
        """Test header extraction from actual PDF."""
        if not self.test_pdf.exists():
            self.skipTest(f"Test PDF not found at {self.test_pdf}")
        
        with open(self.test_pdf, "rb") as f:
            pdf_bytes = f.read()
        
        text = extract_text(pdf_bytes, use_ocr=False)
        header = extract_header(text)
        
        # At least one field should be extracted
        has_data = any([
            header.get("vendor"),
            header.get("invoiceNo"),
            header.get("date"),
        ])
        self.assertTrue(has_data, "Should extract at least one header field")
    
    def test_items_extraction_from_pdf(self):
        """Test items extraction from actual PDF."""
        if not self.test_pdf.exists():
            self.skipTest(f"Test PDF not found at {self.test_pdf}")
        
        with open(self.test_pdf, "rb") as f:
            pdf_bytes = f.read()
        
        text = extract_text(pdf_bytes, use_ocr=False)
        items = extract_items(text)
        
        # Should extract at least some items (or handle gracefully)
        self.assertIsInstance(items, list)
    
    @unittest.skipUnless(
        os.getenv("RUN_FULL_TESTS") == "true",
        "Set RUN_FULL_TESTS=true to run full PDF parsing tests"
    )
    def test_full_parsing_pipeline(self):
        """Full integration test of parsing pipeline."""
        if not self.test_pdf.exists():
            self.skipTest(f"Test PDF not found at {self.test_pdf}")
        
        with open(self.test_pdf, "rb") as f:
            pdf_bytes = f.read()
        
        # Extract text
        text = extract_text(pdf_bytes, use_ocr=False)
        self.assertGreater(len(text), 0)
        
        # Extract header
        header = extract_header(text)
        self.assertIsNotNone(header)
        
        # Extract items
        items = extract_items(text)
        self.assertIsInstance(items, list)
        
        # Validate structure
        if items:
            first_item = items[0]
            self.assertIn("desc", first_item)
            self.assertIn("qty", first_item)
            self.assertIn("rate", first_item)


if __name__ == "__main__":
    unittest.main()









