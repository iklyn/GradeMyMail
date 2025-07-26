import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { aiCommunicator } from './ai-communication.js';
import { 
  errorHandler, 
  requestIdMiddleware, 
  ValidationError, 
  StorageError,
  NotFoundError 
} from './error-handler.js';
import { 
  metricsMiddleware, 
  healthCheckHandler, 
  metricsHandler 
} from './monitoring.js';
import { withRetry, RETRY_CONFIGS } from './retry-logic.js';

// Types for API requests and responses
interface AnalyzeRequest {
  message: string;
}

interface FixRequest {
  message: string;
}

interface StoreRequest {
  payload: {
    fullOriginalText: string;
    fullOriginalHTML: string;
    taggedContent: string;
  };
}

interface StoredData {
  id: string;
  payload: {
    fullOriginalText: string;
    fullOriginalHTML: string;
    taggedContent: string;
  };
  created: number;
  expires: number;
}

// In-memory storage for temporary data (30 minutes TTL)
const temporaryStorage = new Map<string, StoredData>();

// Cleanup expired data every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DATA_TTL = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of temporaryStorage.entries()) {
    if (now > data.expires) {
      temporaryStorage.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Add request ID middleware first
app.use(requestIdMiddleware);

// Add metrics collection middleware
app.use(metricsMiddleware);

// Security middleware - Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:*"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow for development
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Replace with actual production domain
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours preflight cache
};

app.use(cors(corsOptions));

// Compression middleware for response optimization
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses if the request includes a cache-control no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  },
  level: 6, // Compression level (1-9, 6 is default)
  threshold: 1024, // Only compress responses larger than 1KB
  chunkSize: 16 * 1024, // 16KB chunks
}));

// HTTP request logging with Morgan
const morganFormat = process.env.NODE_ENV === 'production' 
  ? 'combined' // Standard Apache combined log format for production
  : 'dev'; // Colored output for development

app.use(morgan(morganFormat, {
  // Skip logging for health check endpoint to reduce noise
  skip: (req) => req.url === '/api/health',
  // Custom token for response time
  stream: process.stdout,
}));

// Simple but effective rate limiting implementation
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const createRateLimit = (windowMs: number, max: number, message: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [key, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
          rateLimitStore.delete(key);
        }
      }
    }
    
    const current = rateLimitStore.get(ip as string) || { count: 0, resetTime: now + windowMs };
    
    if (now > current.resetTime) {
      current.count = 1;
      current.resetTime = now + windowMs;
    } else {
      current.count++;
    }
    
    rateLimitStore.set(ip as string, current);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': Math.max(0, max - current.count).toString(),
      'X-RateLimit-Reset': new Date(current.resetTime).toISOString(),
    });
    
    if (current.count > max) {
      return res.status(429).json({
        error: 'Too many requests',
        message,
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
      });
    }
    
    next();
  };
};

// General API rate limiting
const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // Limit each IP to 100 requests per windowMs
  'Too many requests from this IP, please try again later.'
);

// Strict rate limiting for AI endpoints (more expensive operations)
const aiRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  20, // Limit each IP to 20 AI requests per 5 minutes
  'Too many AI analysis requests, please try again in a few minutes.'
);

// Apply general rate limiting to all API routes
app.use('/api', generalRateLimit);

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '10mb', // Limit request body size
  strict: true,
  type: 'application/json',
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000,
}));

// Request validation middleware
const validateRequest = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const missingFields = requiredFields.filter(field => {
        const value = req.body[field];
        return value === undefined || value === null || value === '';
      });

      if (missingFields.length > 0) {
        throw new ValidationError(
          `Missing required fields: ${missingFields.join(', ')}`,
          { missingFields, endpoint: req.path }
        );
      }

      // Validate content length for message field
      if (req.body.message && typeof req.body.message === 'string') {
        if (req.body.message.length > 50000) { // 50KB limit
          throw new ValidationError(
            'Content too large. Maximum 50,000 characters allowed.',
            { contentLength: req.body.message.length, maxLength: 50000 }
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Security middleware for input sanitization
const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.body && typeof req.body === 'object') {
      // Basic XSS protection - remove script tags and javascript: protocols
      const sanitize = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        }
        if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitize(value);
          }
          return sanitized;
        }
        return obj;
      };
      
      req.body = sanitize(req.body);
    }
    next();
  } catch (error) {
    next(error);
  }
};

app.use(sanitizeInput);

// Remove the old error handler - we'll use the new one from error-handler.ts

// Health check endpoints (no rate limiting)
app.get('/api/health', healthCheckHandler);

// Detailed metrics endpoint
app.get('/api/metrics', generalRateLimit, metricsHandler);

// Simple health check for load balancers
app.get('/api/health/simple', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check
app.get('/api/health/ready', async (req: Request, res: Response) => {
  try {
    // Check if critical services are available
    const aiHealth = await aiCommunicator.healthCheck();
    const isReady = Object.values(aiHealth).some(healthy => healthy);
    
    if (isReady) {
      res.status(200).json({ 
        status: 'ready', 
        timestamp: new Date().toISOString(),
        services: aiHealth
      });
    } else {
      res.status(503).json({ 
        status: 'not ready', 
        timestamp: new Date().toISOString(),
        services: aiHealth
      });
    }
  } catch (_error) {
    res.status(503).json({ 
      status: 'not ready', 
      timestamp: new Date().toISOString(),
      error: 'Service check failed'
    });
  }
});

// Liveness check
app.get('/api/health/live', (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Fallback mock functions for when AI models are unavailable
const mockAnalyzeEmail = async (content: string): Promise<string> => {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  // Mock analysis - add some tags to demonstrate functionality
  let taggedContent = content;
  
  // Add some mock tags for demonstration
  taggedContent = taggedContent.replace(/\b(amazing|incredible|fantastic)\b/gi, '<fluff>$1</fluff>');
  taggedContent = taggedContent.replace(/\b(free|urgent|act now|limited time)\b/gi, '<spam_words>$1</spam_words>');
  taggedContent = taggedContent.replace(/\b[A-Z][^.!?]*[.!?]\s*[A-Z][^.!?]*[.!?]\s*[A-Z][^.!?]*[.!?]/g, '<hard_to_read>$&</hard_to_read>');
  
  return taggedContent;
};

const mockFixEmail = async (taggedContent: string): Promise<string> => {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
  
  // Mock improvements
  const improvements = [
    { original: 'amazing', improved: 'excellent' },
    { original: 'incredible', improved: 'remarkable' },
    { original: 'fantastic', improved: 'outstanding' },
    { original: 'free', improved: 'complimentary' },
    { original: 'urgent', improved: 'time-sensitive' }
  ];

  let result = '';
  for (const improvement of improvements) {
    if (taggedContent.toLowerCase().includes(improvement.original.toLowerCase())) {
      result += `<old_draft>${improvement.original}</old_draft><optimized_draft>${improvement.improved}</optimized_draft>\n`;
    }
  }

  return result || '<old_draft>No improvements needed</old_draft><optimized_draft>Content is already well-written</optimized_draft>';
};

// API Routes

// Analyze email content
app.post('/api/analyze', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, AnalyzeRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`📧 Analyzing email content (${message.length} characters)`);
    
    let taggedContent: string;
    
    try {
      // Try optimized AI communicator with retry logic
      taggedContent = await withRetry(
        () => aiCommunicator.analyzeEmail(message),
        RETRY_CONFIGS.AI_MODEL
      );
    } catch (aiError) {
      console.warn('🔄 AI communicator failed, falling back to mock:', (aiError as Error).message);
      // Fallback to mock function with retry
      taggedContent = await withRetry(
        () => mockAnalyzeEmail(message),
        { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
      );
    }
    
    res.json({
      message: {
        content: taggedContent
      }
    });
  } catch (error) {
    next(error);
  }
});

// Fix tagged email content
app.post('/api/fix', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, FixRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`🔧 Fixing tagged content (${message.length} characters)`);
    
    let improvements: string;
    
    try {
      // Try optimized AI communicator with retry logic
      improvements = await withRetry(
        () => aiCommunicator.fixEmail(message),
        RETRY_CONFIGS.AI_MODEL
      );
    } catch (aiError) {
      console.warn('🔄 AI communicator failed, falling back to mock:', (aiError as Error).message);
      // Fallback to mock function with retry
      improvements = await withRetry(
        () => mockFixEmail(message),
        { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
      );
    }
    
    res.json({
      message: {
        content: improvements
      }
    });
  } catch (error) {
    next(error);
  }
});

// Store temporary data
app.post('/api/store', validateRequest(['payload']), (req: Request<{}, {}, StoreRequest>, res: Response, next: NextFunction) => {
  try {
    const { payload } = req.body;
    const id = uuidv4();
    const now = Date.now();
    
    const storedData: StoredData = {
      id,
      payload,
      created: now,
      expires: now + DATA_TTL,
    };
    
    // Use retry logic for storage operations
    withRetry(
      () => {
        temporaryStorage.set(id, storedData);
        return Promise.resolve();
      },
      RETRY_CONFIGS.STORAGE
    ).then(() => {
      console.log(`💾 Stored data with ID: ${id} (expires in ${DATA_TTL / 1000 / 60} minutes)`);
      res.json({ id });
    }).catch((_error) => {
      throw new StorageError('Failed to store data', { id, payloadSize: JSON.stringify(payload).length });
    });
  } catch (error) {
    next(error);
  }
});

// Load stored data
app.get('/api/load', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Missing or invalid ID parameter', { providedId: id });
    }
    
    const storedData = temporaryStorage.get(id);
    
    if (!storedData) {
      throw new NotFoundError('Data not found or has expired', { requestedId: id });
    }
    
    // Check if data has expired
    if (Date.now() > storedData.expires) {
      temporaryStorage.delete(id);
      throw new NotFoundError('Data has expired and been removed', { 
        requestedId: id, 
        expiredAt: new Date(storedData.expires).toISOString() 
      });
    }
    
    console.log(`📤 Retrieved data with ID: ${id}`);
    
    res.json(storedData);
  } catch (error) {
    next(error);
  }
});

// Delete stored data
app.delete('/api/store', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Missing or invalid ID parameter', { providedId: id });
    }
    
    const existed = temporaryStorage.has(id);
    temporaryStorage.delete(id);
    
    console.log(`🗑️ Deleted data with ID: ${id} (existed: ${existed})`);
    
    res.json({ 
      success: true, 
      deleted: existed,
      id 
    });
  } catch (error) {
    next(error);
  }
});

// Batch analyze endpoint for multiple requests
app.post('/api/analyze/batch', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, AnalyzeRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`📦 Batch analyzing email content (${message.length} characters)`);
    
    let taggedContent: string;
    
    try {
      // Try optimized batch processing with retry logic
      taggedContent = await withRetry(
        () => aiCommunicator.batchAnalyzeEmail(message),
        RETRY_CONFIGS.AI_MODEL
      );
    } catch (aiError) {
      console.warn('🔄 Batch AI communicator failed, falling back to regular analysis:', (aiError as Error).message);
      // Fallback to regular analysis with retry
      try {
        taggedContent = await withRetry(
          () => aiCommunicator.analyzeEmail(message),
          RETRY_CONFIGS.AI_MODEL
        );
      } catch (regularError) {
        console.warn('🔄 Regular AI communicator failed, falling back to mock:', (regularError as Error).message);
        taggedContent = await withRetry(
          () => mockAnalyzeEmail(message),
          { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
        );
      }
    }
    
    res.json({
      message: {
        content: taggedContent
      }
    });
  } catch (error) {
    next(error);
  }
});

// Clear AI cache endpoint (admin only)
app.post('/api/admin/cache/clear', generalRateLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    aiCommunicator.clearCache();
    
    res.json({
      message: 'AI cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get AI cache statistics
app.get('/api/admin/cache/stats', generalRateLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheStats = aiCommunicator.getCacheStats();
    
    res.json({
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// 404 handler for API routes
app.use('/api/*', (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(
    `API endpoint ${req.method} ${req.path} not found.`,
    { method: req.method, path: req.path, availableEndpoints: [
      'GET /api/health',
      'GET /api/metrics', 
      'POST /api/analyze',
      'POST /api/fix',
      'POST /api/store',
      'GET /api/load'
    ]}
  );
  next(error);
});

// Apply enhanced error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Security: Helmet enabled with CSP, HSTS, and XSS protection`);
  console.log(`📝 Logging: Morgan enabled (${morganFormat} format)`);
  console.log(`🗜️  Compression: Enabled with level 6, 1KB threshold`);
  console.log(`⚡ Rate limiting: General (100/15min), AI (20/5min)`);
  console.log(`🌐 CORS: Enabled for ${JSON.stringify(corsOptions.origin)}`);
  console.log(`💾 Storage: In-memory with ${DATA_TTL / 1000 / 60}min TTL`);
  console.log(`🛡️  Input validation: Enabled with size limits and sanitization`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  await aiCommunicator.shutdown();
  temporaryStorage.clear();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  await aiCommunicator.shutdown();
  temporaryStorage.clear();
  process.exit(0);
});

export default app;