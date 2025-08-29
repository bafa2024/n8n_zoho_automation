// Test setup file for Vitest
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test timeout
// Note: Vitest handles timeouts differently than Jest
// setTimeout is not needed in Vitest

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: vi.fn(),
  // debug: vi.fn(),
  // info: vi.fn(),
  // warn: vi.fn(),
  error: vi.fn(),
};

// Global test utilities
global.testUtils = {
  // Add any global test utilities here
  generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substring(2)}`,
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global test data
export const testData = {
  sampleRun: {
    id: 'test-run-1',
    status: 'pending' as const,
    invoiceNo: null,
    vendor: null,
    billTo: null,
    shipTo: null,
    date: null,
    terms: null,
    agent: null,
    items: [],
    totals: {
      subtotal: 0,
      tax: 0,
      discount: 0,
      rounding: 0,
      total: 0
    },
    billLink: null,
    duration: 0,
    file: 'test.pdf',
    notes: [],
    createdAt: Date.now()
  },
  
  sampleRuns: [
    {
      id: 'test-run-1',
      status: 'success' as const,
      invoiceNo: 'I-2024-001',
      vendor: 'Test Supplier',
      billTo: 'Test Company',
      shipTo: 'Test Company',
      date: '2024-01-01',
      terms: 30,
      agent: 'AUTO',
      items: [
        {
          desc: 'Test Item 1',
          sku: 'TEST001',
          qty: 1,
          unit: 'PC' as const,
          rate: 100,
          disc: 0,
          tax: 0
        }
      ],
      totals: {
        subtotal: 100,
        tax: 0,
        discount: 0,
        rounding: 0,
        total: 100
      },
      billLink: 'https://example.com/bill',
      duration: 5.2,
      file: 'test1.pdf',
      notes: [],
      createdAt: Date.now()
    },
    {
      id: 'test-run-2',
      status: 'error' as const,
      invoiceNo: null,
      vendor: null,
      billTo: null,
      shipTo: null,
      date: null,
      terms: null,
      agent: null,
      items: [],
      totals: {
        subtotal: 0,
        tax: 0,
        discount: 0,
        rounding: 0,
        total: 0
      },
      billLink: null,
      duration: 0,
      file: 'test2.pdf',
      notes: ['Missing required fields'],
      createdAt: Date.now()
    }
  ]
};

// Mock environment variables for testing
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.CORS_ORIGIN = 'http://localhost:3001';
