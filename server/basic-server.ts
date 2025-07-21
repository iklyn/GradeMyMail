import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { aiCommunicator } from './ai-communication.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

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
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com']
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression({
  level: 6,
  threshold: 1024,
}));

// HTTP request logging with Morgan
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req) => req.url === '/api/health',
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const simpleRateLimit = (windowMs: number, max: number, message: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, data] of rateLimitStore.entries()) {
      if (now > data.resetTime) {
        rateLimitStore.delete(key);
      }
    }
    
    const current = rateLimitStore.get(ip) || { count: 0, resetTime: now + windowMs };
    
    if (now > current.resetTime) {
      current.count = 1;
      current.resetTime = now + windowMs;
    } else {
      current.count++;
    }
    
    rateLimitStore.set(ip, current);
    
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

// Apply rate limiting
app.use('/api', simpleRateLimit(15 * 60 * 1000, 100, 'Too many requests'));

// In-memory storage
const temporaryStorage = new Map<string, any>();

// Health check
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const aiHealth = await aiCommunicator.healthCheck();
    const cacheStats = aiCommunicator.getCacheStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ai: {
        models: aiHealth,
        cache: cacheStats,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ai: {
        models: { gmm: false, fmm: false },
        cache: { size: 0, hitRate: 0 },
      },
    });
  }
});

// Analyze endpoint with AI optimization and fallback
app.post('/api/analyze', simpleRateLimit(5 * 60 * 1000, 20, 'Too many AI requests'), async (req: Request, res: Response) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    let taggedContent: string;
    
    try {
      // Try optimized AI communicator first
      taggedContent = await aiCommunicator.analyzeEmail(message);
      console.log('🤖 Used AI communicator for analysis');
    } catch (aiError) {
      console.warn('🔄 AI communicator failed, falling back to mock:', (aiError as Error).message);
      // Fallback to mock analysis
      await new Promise(resolve => setTimeout(resolve, 1000));
      taggedContent = message;
      taggedContent = taggedContent.replace(/\b(amazing|incredible|fantastic)\b/gi, '<fluff>$1</fluff>');
      taggedContent = taggedContent.replace(/\b(free|urgent|act now|limited time)\b/gi, '<spam_words>$1</spam_words>');
    }
    
    res.json({
      message: {
        content: taggedContent
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis Failed',
      message: 'Failed to analyze email content. Please try again.',
    });
  }
});

// Fix endpoint with AI optimization and fallback
app.post('/api/fix', simpleRateLimit(5 * 60 * 1000, 20, 'Too many AI requests'), async (req: Request, res: Response) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    let improvements: string;
    
    try {
      // Try optimized AI communicator first
      improvements = await aiCommunicator.fixEmail(message);
      console.log('🤖 Used AI communicator for fix');
    } catch (aiError) {
      console.warn('🔄 AI communicator failed, falling back to mock:', (aiError as Error).message);
      // Fallback to mock fix
      await new Promise(resolve => setTimeout(resolve, 1500));
      improvements = '<old_draft>amazing</old_draft><optimized_draft>excellent</optimized_draft>';
    }
    
    res.json({
      message: {
        content: improvements
      }
    });
  } catch (error) {
    console.error('Fix error:', error);
    res.status(500).json({
      error: 'Fix Failed',
      message: 'Failed to generate improvements. Please try again.',
    });
  }
});

// Store endpoint
app.post('/api/store', (req: Request, res: Response) => {
  const { payload } = req.body;
  const id = uuidv4();
  
  temporaryStorage.set(id, {
    id,
    payload,
    created: Date.now(),
    expires: Date.now() + (30 * 60 * 1000),
  });
  
  res.json({ id });
});

// Load endpoint
app.get('/api/load', (req: Request, res: Response) => {
  const { id } = req.query;
  const data = temporaryStorage.get(id as string);
  
  if (!data || Date.now() > data.expires) {
    return res.status(404).json({ error: 'Data not found or expired' });
  }
  
  res.json(data);
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 Security: Helmet enabled`);
  console.log(`📝 Logging: Morgan enabled`);
  console.log(`🗜️  Compression: Enabled`);
  console.log(`⚡ Rate limiting: Enabled`);
  console.log(`🌐 CORS: Enabled`);
});