import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createDatabaseManager } from './database-abstraction.js';
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
  content?: string;
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

// Database manager for scalable storage
const databaseManager = createDatabaseManager({
  type: process.env.STORAGE_TYPE as any || 'memory',
  connectionString: process.env.DATABASE_URL,
  ttl: 30 * 60 * 1000, // 30 minutes
});

// Cleanup expired data every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DATA_TTL = 30 * 60 * 1000; // 30 minutes

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Add request timing middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  (req as any).startTime = Date.now();
  next();
});

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
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
  chunkSize: 16 * 1024,
}));

// HTTP request logging with Morgan
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';

app.use(morgan(morganFormat, {
  skip: (req) => req.url === '/api/health',
  stream: process.stdout,
}));

// Rate limiting implementation
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const createRateLimit = (windowMs: number, max: number, message: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    
    if (Math.random() < 0.01) {
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

// Rate limiting
const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again later.'
);

const aiRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  20, // 20 AI requests per window
  'Too many AI analysis requests, please try again in a few minutes.'
);

app.use('/api', generalRateLimit);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
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

      const contentField = req.body.message || req.body.content;
      if (contentField && typeof contentField === 'string') {
        if (contentField.length > 50000) {
          throw new ValidationError(
            'Content too large. Maximum 50,000 characters allowed.',
            { contentLength: contentField.length, maxLength: 50000 }
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

// Health check endpoints
app.get('/api/health', healthCheckHandler);
app.get('/api/metrics', generalRateLimit, metricsHandler);

// Simple health checks
app.get('/api/health/simple', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health/ready', async (req: Request, res: Response) => {
  try {
    // Check Gemma API service health
    const gemmaHealth = await gemmaAPIService.getHealthStatus();
    
    const allHealthy = gemmaHealth.status === 'healthy';
    
    res.status(allHealthy ? 200 : 503).json({ 
      status: allHealthy ? 'ready' : 'not ready', 
      timestamp: new Date().toISOString(),
      services: { 
        gemmaAPI: gemmaHealth,
        contentTagger: { status: 'healthy', model: 'rule-based' }
      }
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready', 
      timestamp: new Date().toISOString(),
      error: 'Service check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/health/live', (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Temporary mock functions (will be replaced with GroqGemma system)
const mockAnalyzeEmail = async (content: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  let taggedContent = content;
  taggedContent = taggedContent.replace(/\b(amazing|incredible|fantastic)\b/gi, '<fluff>$1</fluff>');
  taggedContent = taggedContent.replace(/\b(free|urgent|act now|limited time)\b/gi, '<spam_words>$1</spam_words>');
  taggedContent = taggedContent.replace(/\b[A-Z][^.!?]*[.!?]\s*[A-Z][^.!?]*[.!?]\s*[A-Z][^.!?]*[.!?]/g, '<hard_to_read>$&</hard_to_read>');
  
  return taggedContent;
};

const mockFixEmail = async (taggedContent: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
  
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

// Import GroqGemma content tagger and Gemma API service
import { contentTagger, type ContentAnalysisResult } from './ai-engines/content-tagger.js';
import { gemmaAPIService, type NewsletterAnalysis } from './ai-engines/gemma-api.js';

// API Routes - Using GroqGemma rule-based system

// Newsletter analysis endpoint with rule-based highlighting
app.post('/api/analyze', aiRateLimit, validateRequest(['content']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body;
    
    console.log(`📧 Analyzing newsletter content (${content.length} characters) - using GroqGemma rule-based system`);
    
    const analysisResult = await withRetry(
      async () => contentTagger.analyzeNewsletter(content),
      { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
    );
    
    const summary = contentTagger.getAnalysisSummary(analysisResult);
    const ranges = contentTagger.extractHighlightRanges(content, analysisResult);
    
    res.json({
      analysisResult,
      summary,
      ranges,
      metadata: {
        model: 'groq-gemma-rule-based',
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - ((req as any).startTime || Date.now())
      }
    });
  } catch (error) {
    console.error('Analysis failed:', error);
    next(error);
  }
});

// Legacy newsletter analysis endpoint (backward compatibility)
app.post('/api/newsletter/analyze', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, AnalyzeRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`📧 Analyzing newsletter content (${message.length} characters) - using GroqGemma rule-based system`);
    
    const analysisResult = await withRetry(
      async () => contentTagger.analyzeNewsletter(message),
      { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
    );
    
    res.json({
      message: {
        content: analysisResult.annotated
      },
      metadata: {
        model: 'groq-gemma-rule-based',
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - ((req as any).startTime || Date.now()),
        note: 'Using GroqGemma rule-based content analysis'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Newsletter comprehensive analysis endpoint with Gemma API scoring
app.post('/api/newsletter/score', aiRateLimit, validateRequest(['content']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body;
    
    console.log(`🎯 Scoring newsletter content (${content.length} characters) - using Groq Gemma API`);
    
    const analysis = await withRetry(
      async () => gemmaAPIService.analyzeNewsletter(content),
      { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 2 }
    );
    
    // Calculate additional metrics
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed
    
    res.json({
      metrics: {
        overallGrade: analysis.overallGrade,
        audienceFit: analysis.audienceFit,
        tone: analysis.tone,
        clarity: analysis.clarity,
        engagement: analysis.engagement,
        spamRisk: analysis.spamRisk,
        wordCount,
        readingTime,
        summary: analysis.summary,
        improvements: analysis.improvements
      },
      metadata: {
        model: 'groq-gemma-2-9b-it',
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - ((req as any).startTime || Date.now())
      }
    });
  } catch (error) {
    console.error('Gemma scoring failed:', error);
    next(error);
  }
});

// Newsletter improvement endpoint
app.post('/api/newsletter/improve', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, FixRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`🔧 Improving newsletter content (${message.length} characters) - using temporary mock`);
    
    const improvements = await withRetry(
      () => mockFixEmail(message),
      { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
    );
    
    res.json({
      message: {
        content: improvements
      },
      metadata: {
        model: 'mock',
        timestamp: new Date().toISOString(),
        note: 'Using temporary mock - will be replaced with GroqGemma system'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Legacy analyze endpoint for backward compatibility
app.post('/api/analyze-legacy', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, AnalyzeRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`📧 Analyzing email content (${message.length} characters) - using GroqGemma rule-based system`);
    
    const analysisResult = await withRetry(
      async () => contentTagger.analyzeNewsletter(message),
      { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
    );
    
    res.json({
      message: {
        content: analysisResult.annotated
      }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/fix', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, FixRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`🔧 Fixing tagged content (${message.length} characters) - using temporary mock`);
    
    const improvements = await withRetry(
      () => mockFixEmail(message),
      { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
    );
    
    res.json({
      message: {
        content: improvements
      }
    });
  } catch (error) {
    next(error);
  }
});

// Data storage endpoints
app.post('/api/store', validateRequest(['payload']), async (req: Request<{}, {}, StoreRequest>, res: Response, next: NextFunction) => {
  try {
    const { payload } = req.body;
    const id = uuidv4();
    
    await withRetry(
      async () => {
        await databaseManager.set(id, payload, DATA_TTL);
      },
      RETRY_CONFIGS.STORAGE
    );
    
    console.log(`💾 Stored data with ID: ${id} (expires in ${DATA_TTL / 1000 / 60} minutes)`);
    res.json({ id });
  } catch (error) {
    next(error);
  }
});

app.get('/api/load', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Missing or invalid ID parameter', { providedId: id });
    }
    
    const storedData = await databaseManager.get(id);
    
    if (!storedData) {
      throw new NotFoundError('Data not found or has expired', { requestedId: id });
    }
    
    console.log(`📤 Retrieved data with ID: ${id}`);
    res.json(storedData);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/store', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Missing or invalid ID parameter', { providedId: id });
    }
    
    const existed = await databaseManager.delete(id);
    
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

// Monitoring endpoint
app.post('/api/monitoring', generalRateLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { errors, metrics, usage, sessionId, userId, timestamp } = req.body;
    
    if (errors && errors.length > 0) {
      console.log(`🚨 Monitoring - Errors received:`, {
        count: errors.length,
        sessionId,
        userId,
        timestamp: new Date(timestamp).toISOString(),
        criticalErrors: errors.filter((e: any) => e.severity === 'critical').length
      });
    }
    
    if (metrics && metrics.length > 0) {
      console.log(`📊 Monitoring - Metrics received:`, {
        count: metrics.length,
        sessionId,
        userId,
        timestamp: new Date(timestamp).toISOString()
      });
    }
    
    if (usage && usage.length > 0) {
      console.log(`👤 Monitoring - Usage events received:`, {
        count: usage.length,
        sessionId,
        userId,
        timestamp: new Date(timestamp).toISOString()
      });
    }
    
    res.json({
      success: true,
      received: {
        errors: errors?.length || 0,
        metrics: metrics?.length || 0,
        usage: usage?.length || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 404 handler for API routes (temporarily disabled for debugging)
// app.use('/api/*', (req: Request, res: Response) => {
//   res.status(404).json({
//     error: 'API endpoint not found',
//     path: req.path,
//     method: req.method,
//     timestamp: new Date().toISOString()
//   });
// });

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend should connect to: http://localhost:${PORT}`);
  console.log(`⚠️  Using temporary mock AI - GroqGemma system will be implemented next`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});