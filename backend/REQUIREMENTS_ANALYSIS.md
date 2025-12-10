# Requirements Analysis Report

## Project Requirements vs Current Implementation

### ✅ COMPLETE FEATURES

#### 1. PDF File Submission
- **Status**: ✅ **COMPLETE**
- **Implementation**: `POST /api/upload` endpoint in `server.ts`
- **Details**: Accepts PDF files via multipart/form-data, saves to uploads directory

#### 2. PDF Parsing
- **Status**: ✅ **COMPLETE**
- **Implementation**: Parser service at `http://localhost:8000/parse`
- **Details**: FastAPI parser extracts header, items, totals from PDF

#### 3. Zoho Books Integration
- **Status**: ✅ **COMPLETE**
- **Implementation**: `backend/src/integrations/zohoBooks.ts`
- **Details**: 
  - Vendor creation/lookup
  - Item creation/lookup
  - Bill draft creation

#### 4. n8n Integration
- **Status**: ✅ **COMPLETE**
- **Implementation**: `backend/src/integrations/n8nClient.ts`
- **Details**: Webhook client with authentication support

#### 5. Bill Creation as Draft
- **Status**: ✅ **COMPLETE**
- **Implementation**: `createBillDraft()` in `zohoBooks.ts`
- **Details**: Creates bills in Zoho Books with draft status

#### 6. Basic Vendor/Item Validation
- **Status**: ⚠️ **PARTIAL**
- **Implementation**: Simple name matching (case-insensitive)
- **Missing**: Fuzzy matching, GST validation, address matching

---

### ❌ MISSING FEATURES

#### 1. Fuzzy Logic Matching for Vendors
**Requirement**: 
- Check vendor by fuzzy matching against: name, GST, and address
- Current: Only exact name matching (case-insensitive)

**Missing Implementation**:
```typescript
// Need to implement:
- Fuzzy string matching (Levenshtein distance, similarity score)
- GST number extraction and matching
- Address comparison logic
- Multi-field matching (name OR GST OR address)
```

**Priority**: 🔴 **HIGH** - Core requirement

---

#### 2. Fuzzy Logic Matching for Items
**Requirement**:
- Check item by fuzzy matching against: item name, SKU, sales description, purchase description
- Current: Only exact name matching (case-insensitive)

**Missing Implementation**:
```typescript
// Need to implement:
- Fuzzy matching for item name
- SKU/code extraction and matching
- Sales description matching
- Purchase description matching
- Multi-field matching logic
```

**Priority**: 🔴 **HIGH** - Core requirement

---

#### 3. SKU Generation with Supplier Initials
**Requirement**:
- For new items, include supplier initials as suffix for the SKU
- Example: If supplier is "ABC Corp", item SKU becomes "ITEM-CODE-ABC"

**Missing Implementation**:
```typescript
// Need to implement:
- Extract supplier initials from vendor name
- Generate SKU with format: {itemCode}-{supplierInitials}
- Store SKU when creating item in Zoho
```

**Priority**: 🟡 **MEDIUM** - Important for item tracking

---

#### 4. Email Notification (Gmail)
**Requirement**:
- Send email via Gmail with summary of:
  - What was done
  - New vendors added
  - New items added
  - Bill created

**Missing Implementation**:
```typescript
// Need to implement:
- Gmail SMTP integration (nodemailer or similar)
- Email template with summary
- Track what was created (vendor/item flags)
- Send email after bill creation
```

**Priority**: 🔴 **HIGH** - Core requirement

---

#### 5. GST Number Extraction and Matching
**Requirement**:
- Extract GST number from PDF
- Match vendors by GST number

**Missing Implementation**:
- Parser needs to extract GST from PDF
- Vendor matching needs GST comparison
- Store GST in vendor creation

**Priority**: 🟡 **MEDIUM** - Important for vendor validation

---

#### 6. Address Extraction and Matching
**Requirement**:
- Extract vendor address from PDF
- Match vendors by address (fuzzy)

**Missing Implementation**:
- Parser needs to extract address
- Address normalization
- Address similarity matching

**Priority**: 🟡 **MEDIUM** - Important for vendor validation

---

#### 7. Item Code/SKU Extraction
**Requirement**:
- Extract item codes/SKUs from PDF
- Match items by code/SKU

**Missing Implementation**:
- Parser needs to extract item codes
- Store SKU when creating items
- Match by SKU in addition to name

**Priority**: 🟡 **MEDIUM** - Important for item validation

---

#### 8. Sales/Purchase Description Matching
**Requirement**:
- Match items by sales description
- Match items by purchase description

**Missing Implementation**:
- Parser needs to extract descriptions
- Store descriptions when creating items
- Match by descriptions

**Priority**: 🟢 **LOW** - Nice to have

---

## Architecture Analysis

### Current Flow
```
PDF Upload → Parser → Backend → Zoho Books → n8n → Dashboard
```

### Required Flow (Per Requirements)
```
PDF Upload → Parser → Backend → Fuzzy Match Vendor → Create if needed
                                    ↓
                              Fuzzy Match Items → Create if needed (with SKU)
                                    ↓
                              Create Bill Draft
                                    ↓
                              Send Email (Gmail)
                                    ↓
                              n8n Webhook
```

### Gap Analysis

| Component | Current | Required | Gap |
|-----------|---------|----------|-----|
| Vendor Matching | Exact name | Fuzzy (name+GST+address) | 🔴 High |
| Item Matching | Exact name | Fuzzy (name+SKU+descriptions) | 🔴 High |
| SKU Generation | None | Supplier initials suffix | 🟡 Medium |
| Email Notification | None | Gmail summary | 🔴 High |
| GST Extraction | Not extracted | Required | 🟡 Medium |
| Address Extraction | Partial | Full extraction | 🟡 Medium |
| Item Code Extraction | Not extracted | Required | 🟡 Medium |

---

## Recommendations

### Immediate Actions Required

1. **Implement Fuzzy Matching Library**
   - Install: `npm install string-similarity` or `fuse.js`
   - Create matching utility functions
   - Add similarity threshold (e.g., 0.8 = 80% match)

2. **Enhance Parser to Extract More Fields**
   - GST number
   - Full vendor address
   - Item codes/SKUs
   - Item descriptions

3. **Implement Email Service**
   - Install: `npm install nodemailer`
   - Configure Gmail SMTP
   - Create email template
   - Track creation flags (newVendor, newItems)

4. **Add SKU Generation Logic**
   - Extract supplier initials
   - Generate SKU format
   - Include in item creation

### Implementation Priority

**Phase 1 (Critical - Must Have)**:
1. ✅ Fuzzy matching for vendors (name + GST + address)
2. ✅ Fuzzy matching for items (name + SKU + descriptions)
3. ✅ Email notification via Gmail
4. ✅ SKU generation with supplier initials

**Phase 2 (Important - Should Have)**:
5. ✅ GST extraction from PDF
6. ✅ Address extraction from PDF
7. ✅ Item code/SKU extraction from PDF

**Phase 3 (Nice to Have)**:
8. ✅ Sales/purchase description matching
9. ✅ Enhanced error handling
10. ✅ Email templates customization

---

## Code Changes Needed

### 1. Add Fuzzy Matching Utility
**File**: `backend/src/lib/fuzzyMatch.ts` (NEW)
```typescript
export function fuzzyMatchVendor(vendor: any, candidates: any[]): any | null
export function fuzzyMatchItem(item: any, candidates: any[]): any | null
```

### 2. Update zohoBooks.ts
- Replace exact matching with fuzzy matching
- Add GST and address comparison
- Add SKU generation logic
- Track what was created (flags)

### 3. Add Email Service
**File**: `backend/src/integrations/emailService.ts` (NEW)
```typescript
export async function sendSummaryEmail(runId: string, summary: {
  newVendors: string[],
  newItems: string[],
  billId: string
}): Promise<void>
```

### 4. Update Parser
**File**: `parser/extract_fields.py`
- Add GST extraction
- Add full address extraction
- Add item code/SKU extraction
- Add item descriptions extraction

### 5. Update billProcessor.ts
- Call fuzzy matching functions
- Track creation flags
- Send email after completion

---

## Testing Checklist

### Before Production
- [ ] Fuzzy matching works with similar vendor names
- [ ] GST matching prevents duplicate vendors
- [ ] Address matching works with variations
- [ ] SKU generation includes supplier initials
- [ ] Email sends successfully via Gmail
- [ ] Email contains correct summary
- [ ] All new vendors/items tracked correctly

---

## Estimated Completion Time

- **Fuzzy Matching**: 4-6 hours
- **Email Service**: 3-4 hours
- **SKU Generation**: 1-2 hours
- **Parser Enhancements**: 4-6 hours
- **Integration & Testing**: 4-6 hours

**Total**: ~20-24 hours of development

---

## Conclusion

### Current Status: ⚠️ **70% COMPLETE**

**What Works**:
- ✅ PDF upload and parsing
- ✅ Basic vendor/item creation
- ✅ Bill draft creation
- ✅ n8n integration
- ✅ Dashboard display

**What's Missing**:
- ❌ Fuzzy matching (critical)
- ❌ Email notifications (critical)
- ❌ SKU generation (important)
- ❌ Enhanced field extraction (important)

**Recommendation**: 
The core infrastructure is solid, but **fuzzy matching and email notifications are critical requirements** that must be implemented before production use. The current exact matching will create duplicate vendors/items if names have slight variations.


