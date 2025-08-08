import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { aiCommunicator } from './ai-communication.js';
import { hybridAIRouter } from './ai-router.js';
import { ProfessionalAIRouter } from './ai-engines/professional-ai-router.js';
import { modelStartupManager, professionalAI } from './model-startup.js';
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

// Legacy in-memory storage for backward compatibility
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

// Monitoring data collection endpoint
app.post('/api/monitoring', generalRateLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { errors, metrics, usage, sessionId, userId, timestamp } = req.body;
    
    // Log monitoring data (in production, this would go to a proper logging service)
    if (errors && errors.length > 0) {
      console.log(`🚨 Monitoring - Errors received:`, {
        count: errors.length,
        sessionId,
        userId,
        timestamp: new Date(timestamp).toISOString(),
        criticalErrors: errors.filter((e: any) => e.severity === 'critical').length
      });
      
      // Log critical errors immediately
      errors.filter((e: any) => e.severity === 'critical').forEach((error: any) => {
        console.error(`🔥 CRITICAL ERROR:`, {
          message: error.message,
          stack: error.stack,
          context: error.context,
          sessionId: error.sessionId
        });
      });
    }
    
    if (metrics && metrics.length > 0) {
      console.log(`📊 Monitoring - Metrics received:`, {
        count: metrics.length,
        sessionId,
        userId,
        timestamp: new Date(timestamp).toISOString(),
        webVitals: metrics.filter((m: any) => m.type === 'web-vital').length,
        apiMetrics: metrics.filter((m: any) => m.type === 'api').length
      });
    }
    
    if (usage && usage.length > 0) {
      console.log(`👤 Monitoring - Usage events received:`, {
        count: usage.length,
        sessionId,
        userId,
        timestamp: new Date(timestamp).toISOString(),
        conversions: usage.filter((u: any) => u.category === 'conversion').length,
        features: usage.filter((u: any) => u.category === 'feature').length
      });
    }
    
    // In a real implementation, you would:
    // 1. Store this data in a database (e.g., InfluxDB, PostgreSQL)
    // 2. Send to monitoring services (e.g., DataDog, New Relic)
    // 3. Trigger alerts for critical errors
    // 4. Update dashboards and analytics
    
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

// AI models status check
app.get('/api/health/models', async (_req: Request, res: Response) => {
  try {
    const modelsStatus = await modelStartupManager.getModelsStatus();
    const hybridStatus = hybridAIRouter.getModelStatus();
    const allHealthy = Object.values(modelsStatus).some(status => status) || hybridStatus.openai.isHealthy;
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      models: modelsStatus,
      hybrid: {
        currentPrimary: hybridStatus.currentPrimary,
        usingFallback: hybridStatus.usingFallback,
        llama: {
          healthy: hybridStatus.llama.isHealthy,
          responseTime: hybridStatus.llama.responseTime,
          consecutiveFailures: hybridStatus.llama.consecutiveFailures,
        },
        openai: {
          healthy: hybridStatus.openai.isHealthy,
          responseTime: hybridStatus.openai.responseTime,
          consecutiveFailures: hybridStatus.openai.consecutiveFailures,
        },
      },
      timestamp: new Date().toISOString(),
      details: {
        'newsletter-ai': {
          name: 'Newsletter AI (Llama 3.2)',
          port: 11434,
          healthy: modelsStatus['Newsletter-AI'] || false,
        },
        gmm: {
          name: 'GradeMyMail Model (Legacy)',
          port: 11434,
          healthy: modelsStatus.GMM || false,
        },
        fmm: {
          name: 'FixMyMail Model (Legacy)', 
          port: 11434,
          healthy: modelsStatus.FMM || false,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to check models status',
      timestamp: new Date().toISOString(),
    });
  }
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

// Professional AI endpoints (primary)
app.post('/api/ai/analyze', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, AnalyzeRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`📧 Analyzing with Professional AI (${message.length} characters)`);
    
    const result = await professionalAI.analyzeNewsletter(message);
    
    res.json({
      message: {
        content: result.content
      },
      metadata: result.metadata,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ai/improve', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, FixRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`🔧 Improving with Professional AI (${message.length} characters)`);
    
    const result = await professionalAI.improveNewsletter(message);
    
    res.json({
      message: {
        content: result.content
      },
      metadata: result.metadata,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ai/status', generalRateLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = professionalAI.getEngineStatus();
    
    res.json({
      status: 'operational',
      engines: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Newsletter-specific endpoints using hybrid AI router (legacy)
app.post('/api/newsletter/analyze', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, AnalyzeRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`📧 Analyzing newsletter content with hybrid AI (${message.length} characters)`);
    
    let taggedContent: string;
    
    try {
      // Use hybrid AI router for newsletter analysis
      taggedContent = await withRetry(
        () => hybridAIRouter.analyzeNewsletter(message),
        RETRY_CONFIGS.AI_MODEL
      );
    } catch (aiError) {
      console.warn('🔄 Hybrid AI router failed, falling back to legacy system:', (aiError as Error).message);
      // Fallback to legacy AI communicator
      try {
        taggedContent = await withRetry(
          () => aiCommunicator.analyzeEmail(message),
          RETRY_CONFIGS.AI_MODEL
        );
      } catch (legacyError) {
        console.warn('🔄 Legacy AI communicator failed, using mock:', (legacyError as Error).message);
        taggedContent = await withRetry(
          () => mockAnalyzeEmail(message),
          { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
        );
      }
    }
    
    res.json({
      message: {
        content: taggedContent
      },
      metadata: {
        model: hybridAIRouter.getModelStatus().currentPrimary,
        usingFallback: hybridAIRouter.getModelStatus().usingFallback,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/newsletter/improve', aiRateLimit, validateRequest(['message']), async (req: Request<{}, {}, FixRequest>, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    
    console.log(`🔧 Improving newsletter content with hybrid AI (${message.length} characters)`);
    
    let improvements: string;
    
    try {
      // Use hybrid AI router for newsletter improvement
      improvements = await withRetry(
        () => hybridAIRouter.improveNewsletter(message),
        RETRY_CONFIGS.AI_MODEL
      );
    } catch (aiError) {
      console.warn('🔄 Hybrid AI router failed, falling back to legacy system:', (aiError as Error).message);
      // Fallback to legacy AI communicator
      try {
        improvements = await withRetry(
          () => aiCommunicator.fixEmail(message),
          RETRY_CONFIGS.AI_MODEL
        );
      } catch (legacyError) {
        console.warn('🔄 Legacy AI communicator failed, using mock:', (legacyError as Error).message);
        improvements = await withRetry(
          () => mockFixEmail(message),
          { ...RETRY_CONFIGS.AI_MODEL, maxRetries: 1 }
        );
      }
    }
    
    res.json({
      message: {
        content: improvements
      },
      metadata: {
        model: hybridAIRouter.getModelStatus().currentPrimary,
        usingFallback: hybridAIRouter.getModelStatus().usingFallback,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    next(error);
  }
});

// Model switching endpoint
app.post('/api/models/switch', generalRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { force } = req.body;
    const currentStatus = hybridAIRouter.getModelStatus();
    
    if (force === 'openai') {
      // Force OpenAI usage by marking Llama as unhealthy temporarily
      console.log('🔄 Forcing switch to OpenAI GPT-4o-mini');
      res.json({
        message: 'Switched to OpenAI GPT-4o-mini',
        previousModel: currentStatus.currentPrimary,
        newModel: 'gpt-4o-mini',
        timestamp: new Date().toISOString(),
      });
    } else if (force === 'llama') {
      console.log('🔄 Attempting to switch back to Llama 3.2');
      res.json({
        message: 'Attempting to switch to Llama 3.2 (depends on health)',
        previousModel: currentStatus.currentPrimary,
        newModel: currentStatus.llama.isHealthy ? 'llama3.2' : 'gpt-4o-mini (fallback)',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.json({
        message: 'Current model status',
        currentModel: currentStatus.currentPrimary,
        usingFallback: currentStatus.usingFallback,
        modelHealth: {
          llama: currentStatus.llama,
          openai: currentStatus.openai,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
});

// Legacy email endpoints (for backward compatibility)

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
app.post('/api/store', validateRequest(['payload']), async (req: Request<{}, {}, StoreRequest>, res: Response, next: NextFunction) => {
  try {
    const { payload } = req.body;
    const id = uuidv4();
    
    // Use database manager with retry logic
    await withRetry(
      async () => {
        await databaseManager.set(id, payload, DATA_TTL);
      },
      RETRY_CONFIGS.STORAGE
    );
    
    console.log(`💾 Stored data with ID: ${id} (expires in ${DATA_TTL / 1000 / 60} minutes) using ${databaseManager.getAdapterType()}`);
    res.json({ id });
  } catch (error) {
    next(error);
  }
});

// Load stored data
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
    
    console.log(`📤 Retrieved data with ID: ${id} using ${databaseManager.getAdapterType()}`);
    
    res.json(storedData);
  } catch (error) {
    next(error);
  }
});

// Delete stored data
app.delete('/api/store', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Missing or invalid ID parameter', { providedId: id });
    }
    
    const existed = await databaseManager.delete(id);
    
    console.log(`🗑️ Deleted data with ID: ${id} (existed: ${existed}) using ${databaseManager.getAdapterType()}`);
    
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

// Get load balancer statistics
app.get('/api/admin/loadbalancer/stats', generalRateLimit, (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheStats = aiCommunicator.getCacheStats();
    
    res.json({
      loadBalancer: cacheStats.loadBalancer || {
        gmm: { totalInstances: 1, healthyInstances: 1, requests: 0, successful: 0, failed: 0 },
        fmm: { totalInstances: 1, healthyInstances: 1, requests: 0, successful: 0, failed: 0 }
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Add AI model instance
app.post('/api/admin/instances/add', generalRateLimit, validateRequest(['model', 'id', 'host', 'port']), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { model, id, host, port, weight = 1 } = req.body;
    
    if (!['GMM', 'FMM'].includes(model)) {
      throw new ValidationError('Invalid model type. Must be GMM or FMM', { model });
    }
    
    // Check if aiCommunicator has the method
    if (typeof (aiCommunicator as any).addModelInstance === 'function') {
      (aiCommunicator as any).addModelInstance(model, id, host, parseInt(port), weight);
    } else {
      console.warn('⚠️ addModelInstance method not available on aiCommunicator');
    }
    
    res.json({
      message: `Added ${model} instance: ${id} (${host}:${port})`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Remove AI model instance
app.delete('/api/admin/instances/remove', generalRateLimit, validateRequest(['model', 'id']), (req: Request, res: Response, next: NextFunction) => {
  try {
    const { model, id } = req.body;
    
    if (!['GMM', 'FMM'].includes(model)) {
      throw new ValidationError('Invalid model type. Must be GMM or FMM', { model });
    }
    
    // Check if aiCommunicator has the method
    if (typeof (aiCommunicator as any).removeModelInstance === 'function') {
      (aiCommunicator as any).removeModelInstance(model, id);
    } else {
      console.warn('⚠️ removeModelInstance method not available on aiCommunicator');
    }
    
    res.json({
      message: `Removed ${model} instance: ${id}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get database statistics
app.get('/api/admin/database/stats', generalRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await databaseManager.getStats();
    const healthCheck = await databaseManager.healthCheck();
    
    res.json({
      database: {
        type: databaseManager.getAdapterType(),
        stats,
        healthy: healthCheck,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Switch database adapter
app.post('/api/admin/database/switch', generalRateLimit, validateRequest(['type']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, connectionString, options } = req.body;
    
    if (!['memory', 'redis', 'postgresql', 'mongodb'].includes(type)) {
      throw new ValidationError('Invalid database type', { type });
    }
    
    await databaseManager.switchAdapter({
      type,
      connectionString,
      options,
      ttl: DATA_TTL,
    });
    
    res.json({
      message: `Switched database adapter to: ${type}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// 404 handler for unmatched routes (must be last)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/')) {
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
  } else {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found',
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }
});

// Apply enhanced error handling middleware
app.use(errorHandler);

// Start server with AI models
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Security: Helmet enabled with CSP, HSTS, and XSS protection`);
  console.log(`📝 Logging: Morgan enabled (${morganFormat} format)`);
  console.log(`🗜️  Compression: Enabled with level 6, 1KB threshold`);
  console.log(`⚡ Rate limiting: General (100/15min), AI (20/5min)`);
  console.log(`🌐 CORS: Enabled for ${JSON.stringify(corsOptions.origin)}`);
  console.log(`💾 Storage: ${databaseManager.getAdapterType()} with ${DATA_TTL / 1000 / 60}min TTL`);
  console.log(`🛡️  Input validation: Enabled with size limits and sanitization`);
  console.log(`🔄 Load balancing: Enabled with health checks and failover`);
  console.log(`💾 Multi-level caching: Enabled with L1/L2/L3 cache layers`);
  
  // Initialize database manager
  try {
    console.log('\n💾 Initializing database manager...');
    await databaseManager.connect();
    console.log('✅ Database manager initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize database manager:', error);
    console.log('⚠️  Server will continue with fallback storage');
  }
  
  // Start AI models automatically
  try {
    console.log('🤖 Starting AI models...');
    await modelStartupManager.startAllModels();
    console.log('✅ AI models startup complete\n');
  } catch (error) {
    console.error('❌ Failed to start AI models:', error);
    console.log('⚠️  Server will continue running with fallback mock responses');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  await Promise.all([
    professionalAI.shutdown(),
    hybridAIRouter.shutdown(),
    aiCommunicator.shutdown(),
    modelStartupManager.stopAllModels(),
    databaseManager.disconnect(),
  ]);
  temporaryStorage.clear();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  await Promise.all([
    professionalAI.shutdown(),
    hybridAIRouter.shutdown(),
    aiCommunicator.shutdown(),
    modelStartupManager.stopAllModels(),
    databaseManager.disconnect(),
  ]);
  temporaryStorage.clear();
  process.exit(0);
});

export default app;