"""
Tests for line items extraction.
"""
import unittest
from extract_fields import extract_items, normalize_number


class TestExtractItems(unittest.TestCase):
    
    def test_extract_simple_items(self):
        text = """
        Item Description          Qty  Unit  Rate
        BLOCK SCREW A - EX5CLASS  20   PC    4.50
        METER ASSY TCB            2    SET   175.00
        """
        items = extract_items(text)
        self.assertGreater(len(items), 0)
        if items:
            self.assertEqual(items[0].get("qty"), 20.0)
            self.assertEqual(items[0].get("rate"), 4.50)
    
    def test_extract_items_with_sku(self):
        text = """
        Description              SKU      Qty  Rate
        BLOCK SCREW A           [D0054]  20   4.50
        """
        items = extract_items(text)
        self.assertGreater(len(items), 0)
        if items:
            self.assertEqual(items[0].get("sku"), "D0054")
    
    def test_normalize_number(self):
        self.assertEqual(normalize_number("1,234.56"), 1234.56)
        self.assertEqual(normalize_number("$1,234.56"), 1234.56)
        self.assertEqual(normalize_number("1234"), 1234.0)
        self.assertEqual(normalize_number(""), 0.0)
        self.assertEqual(normalize_number("invalid"), 0.0)
    
    def test_extract_items_with_discount(self):
        text = """
        Item                    Qty  Rate  Disc
        PRODUCT A               10  100.00 5
        """
        items = extract_items(text)
        self.assertGreater(len(items), 0)
        if items:
            self.assertEqual(items[0].get("disc"), 5.0)
    
    def test_extract_items_with_tax(self):
        text = """
        Item                    Qty  Rate  Tax
        PRODUCT A               10  100.00 10
        """
        items = extract_items(text)
        self.assertGreater(len(items), 0)
        if items:
            self.assertEqual(items[0].get("tax"), 10.0)


if __name__ == "__main__":
    unittest.main()

