import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware - Helmet
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
const rateLimitStore = new Map();

const simpleRateLimit = (windowMs, max, message) => {
  return (req, res, next) => {
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
const temporaryStorage = new Map();

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mock analyze endpoint
app.post('/api/analyze', simpleRateLimit(5 * 60 * 1000, 20, 'Too many AI requests'), (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  console.log(`📧 Analyzing email content (${message.length} characters)`);
  
  // Mock analysis
  setTimeout(() => {
    let taggedContent = message;
    taggedContent = taggedContent.replace(/\b(amazing|incredible|fantastic)\b/gi, '<fluff>$1</fluff>');
    taggedContent = taggedContent.replace(/\b(free|urgent|act now|limited time)\b/gi, '<spam_words>$1</spam_words>');
    
    res.json({
      message: {
        content: taggedContent
      }
    });
  }, 1000);
});

// Mock fix endpoint
app.post('/api/fix', simpleRateLimit(5 * 60 * 1000, 20, 'Too many AI requests'), (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  console.log(`🔧 Fixing tagged content (${message.length} characters)`);
  
  setTimeout(() => {
    res.json({
      message: {
        content: '<old_draft>amazing</old_draft><optimized_draft>excellent</optimized_draft>'
      }
    });
  }, 1500);
});

// Store endpoint
app.post('/api/store', (req, res) => {
  const { payload } = req.body;
  const id = uuidv4();
  
  temporaryStorage.set(id, {
    id,
    payload,
    created: Date.now(),
    expires: Date.now() + (30 * 60 * 1000),
  });
  
  console.log(`💾 Stored data with ID: ${id}`);
  res.json({ id });
});

// Load endpoint
app.get('/api/load', (req, res) => {
  const { id } = req.query;
  const data = temporaryStorage.get(id);
  
  if (!data || Date.now() > data.expires) {
    return res.status(404).json({ error: 'Data not found or expired' });
  }
  
  console.log(`📤 Retrieved data with ID: ${id}`);
  res.json(data);
});

// Error handling
app.use((err, req, res, next) => {
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