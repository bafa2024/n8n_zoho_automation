# N8N Zoho Automation Backend

A TypeScript-based backend service for managing N8N workflow runs and Zoho CRM integrations.

## Features

- **RESTful API** for managing workflow runs
- **TypeScript** with strict type checking
- **Express.js** web framework
- **In-memory storage** for development and testing
- **Comprehensive testing** with Jest
- **Simulation utilities** for testing and development
- **Statistics and analytics** for run data
- **Flexible ID generation** utilities

## Project Structure

```
backend/
├── src/
│   ├── lib/           # Utility libraries
│   │   ├── types.ts   # TypeScript type definitions
│   │   ├── id.ts      # ID generation utilities
│   │   ├── totals.ts  # Statistics calculation
│   │   └── simulate.ts # Test data simulation
│   ├── storage/       # Data storage layer
│   │   └── memory.ts  # In-memory storage adapter
│   ├── routes/        # API route handlers
│   │   └── runs.ts    # Run management endpoints
│   ├── config.ts      # Configuration management
│   └── server.ts      # Main server file
├── tests/             # Test files
│   ├── setup.ts       # Test configuration
│   ├── totals.test.ts # Totals utility tests
│   ├── simulate.test.ts # Simulation utility tests
│   └── api.test.ts    # API endpoint tests
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
├── jest.config.js     # Jest test configuration
├── .gitignore         # Git ignore rules
└── env.example        # Environment variables template
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp env.example .env
```

3. Configure environment variables in `.env`:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3000
```

### Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot reloading.

### Building

Build the project for production:
```bash
npm run build
```

The compiled JavaScript will be in the `dist/` directory.

### Production

Start the production server:
```bash
npm start
```

## API Endpoints

### Runs Management

- `GET /api/runs` - Get all runs
- `GET /api/runs/:id` - Get a specific run
- `POST /api/runs` - Create a new run
- `PUT /api/runs/:id` - Update a run
- `DELETE /api/runs/:id` - Delete a run

### Health Check

- `GET /health` - Server health status

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage
```

### Test Structure

- **Unit Tests**: Test individual utility functions
- **Integration Tests**: Test API endpoints
- **Mock Data**: Use simulation utilities for test data

## Utilities

### ID Generation

```typescript
import { generateId, generateShortId, generateHumanReadableId } from './src/lib/id';

const uuid = generateId();                    // UUID v4
const shortId = generateShortId();            // 8-character ID
const humanId = generateHumanReadableId();    // RUN-TIMESTAMP-RANDOM
```

### Statistics Calculation

```typescript
import { calculateRunTotalsByStatus, calculateSuccessRate } from './src/lib/totals';

const totals = calculateRunTotalsByStatus(runs);
const successRate = calculateSuccessRate(runs);
```

### Data Simulation

```typescript
import { generateSimulatedRun, generateSimulatedRuns } from './src/lib/simulate';

const singleRun = generateSimulatedRun();
const multipleRuns = generateSimulatedRuns(10);
```

## Storage

The backend uses an in-memory storage adapter for development and testing. This can be easily replaced with:

- **Database adapters** (PostgreSQL, MongoDB, etc.)
- **File-based storage** (JSON, CSV)
- **Cloud storage** (AWS S3, Google Cloud Storage)

## Configuration

Configuration is managed through environment variables and the `config.ts` file:

- **Server settings** (port, environment)
- **Security settings** (JWT secret, CORS)
- **External service credentials** (Zoho, N8N)
- **Rate limiting** and logging configuration

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Write comprehensive tests
- Use meaningful variable and function names

### Adding New Features

1. Define types in `src/lib/types.ts`
2. Implement business logic in utility files
3. Create API endpoints in route files
4. Add comprehensive tests
5. Update documentation

### Error Handling

- Use consistent error response format
- Log errors appropriately
- Return meaningful error messages
- Handle edge cases gracefully

## Deployment

### Environment Variables

Ensure all required environment variables are set:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-production-secret
CORS_ORIGIN=https://yourdomain.com
```

### Build and Deploy

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue in the repository
- Check the documentation
- Review existing issues and solutions





















