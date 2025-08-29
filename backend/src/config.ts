import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 5050),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5050}`,
  dbPath: process.env.DB_PATH || (process.env.NODE_ENV === 'test' ? ':memory:' : './data/app.db'),
  uploadDir: process.env.UPLOAD_DIR || (process.env.NODE_ENV === 'test' ? './tmp-uploads-test' : './uploads'),
  parserUrl: process.env.PARSER_URL || '', // if empty, backend will use simulator
};
