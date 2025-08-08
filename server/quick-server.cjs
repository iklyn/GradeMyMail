const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Mock analysis function
// Load professional rule-based AI
let ruleBasedAnalysis;
try {
  const aiModule = require('./ai-engines/rule-based-ai-cjs.cjs');
  ruleBasedAnalysis = aiModule.ruleBasedAnalysis;
  console.log('✅ Rule-based AI module loaded successfully');
} catch (error) {
  console.error('❌ Failed to load rule-based AI:', error);
  process.exit(1);
}

const mockAnalyzeEmail = async (content) => {
  try {
    if (!content || typeof content !== 'string') {
      return content || '';
    }
    
    // Use professional rule-based AI analysis
    return await ruleBasedAnalysis(content);
  } catch (error) {
    console.error('Professional analysis error:', error);
    return content;
  }
};

// Mock fix function
const mockFixEmail = (taggedContent) => {
  const improvements = [
    { original: 'amazing', improved: 'excellent' },
    { original: 'incredible', improved: 'remarkable' },
    { original: 'fantastic', improved: 'outstanding' },
    { original: 'great', improved: 'effective' },
    { original: 'awesome', improved: 'impressive' },
    { original: 'free', improved: 'complimentary' },
    { original: 'urgent', improved: 'time-sensitive' },
    { original: 'act now', improved: 'take action' },
    { original: 'buy now', improved: 'purchase today' }
  ];

  let result = '';
  for (const improvement of improvements) {
    if (taggedContent.toLowerCase().includes(improvement.original.toLowerCase())) {
      result += `<old_draft>${improvement.original}</old_draft><optimized_draft>${improvement.improved}</optimized_draft>\n`;
    }
  }

  return result || '<old_draft>No improvements needed</old_draft><optimized_draft>Content is already well-written</optimized_draft>';
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Quick server is running'
  });
});

// AI Models health check endpoint (for hybrid AI integration)
app.get('/api/health/models', (req, res) => {
  console.log('📊 Models health check requested');
  
  const healthResponse = {
    status: 'healthy',
    models: {
      'Newsletter-AI': true,
      'GMM': true,
      'FMM': true,
    },
    hybrid: {
      currentPrimary: 'mock-ai',
      usingFallback: false,
      llama: {
        isHealthy: false, // Mock server doesn't have real Llama
        responseTime: 0,
        consecutiveFailures: 0,
      },
      openai: {
        isHealthy: true, // Mock server simulates OpenAI
        responseTime: 150,
        consecutiveFailures: 0,
      },
    },
    timestamp: new Date().toISOString(),
    details: {
      'newsletter-ai': {
        name: 'Mock Newsletter AI (Development)',
        port: 3001,
        healthy: true,
      },
      gmm: {
        name: 'GradeMyMail Model (Mock)',
        port: 3001,
        healthy: true,
      },
      fmm: {
        name: 'FixMyMail Model (Mock)', 
        port: 3001,
        healthy: true,
      },
    },
  };
  
  console.log('✅ Returning healthy status for all models');
  res.json(healthResponse);
});

// Analyze endpoint
app.post('/api/analyze', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`📧 Analyzing email content (${message.length} characters)`);
    console.log(`📧 Content preview: ${message.substring(0, 100)}...`);
    
    // Extract plain text from HTML if needed
    let plainText = message;
    if (message.includes('<') && message.includes('>')) {
      // Simple HTML tag removal
      plainText = message.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    }
    
    console.log(`📧 Plain text: ${plainText.substring(0, 100)}...`);
    
    // Use professional analysis with minimal delay
    setTimeout(async () => {
      const taggedContent = await mockAnalyzeEmail(plainText);
      
      console.log(`✅ Analysis complete`);
      console.log('🔍 === SERVER AI OUTPUT ===');
      console.log(`📝 Full Tagged Content: ${taggedContent}`);
      console.log('🔍 === END SERVER OUTPUT ===');
      
      res.json({
        message: {
          content: taggedContent
        }
      });
    }, 500); // Reduced delay for better UX
    
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});

// Newsletter-specific analyze endpoint (for hybrid AI integration)
app.post('/api/newsletter/analyze', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`📧 Newsletter analysis with hybrid AI (${message.length} characters)`);
    console.log(`📧 Content preview: ${message.substring(0, 100)}...`);
    
    // ARCHITECTURAL CHANGE: Analyze HTML directly instead of converting to plain text
    console.log(`🎯 Analyzing HTML directly to preserve formatting`);
    
    // Use professional analysis with minimal delay - PASS HTML DIRECTLY
    setTimeout(async () => {
      const taggedContent = await mockAnalyzeEmail(message); // Pass HTML directly
      
      console.log(`✅ Newsletter analysis complete`);
      console.log('🔍 === SERVER AI OUTPUT ===');
      console.log('📝 Full Tagged Content:', taggedContent);
      console.log('🔍 === END SERVER OUTPUT ===');
      
      res.json({
        message: {
          content: taggedContent
        },
        metadata: {
          model: 'mock-ai',
          usingFallback: false,
          timestamp: new Date().toISOString(),
        }
      });
    }, 1000);
    
  } catch (error) {
    console.error('Newsletter analysis error:', error);
    res.status(500).json({ error: 'Newsletter analysis failed', details: error.message });
  }
});

// Newsletter-specific improve endpoint (for hybrid AI integration)
app.post('/api/newsletter/improve', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`🔧 Newsletter improvement with hybrid AI (${message.length} characters)`);
    
    // Simulate processing delay
    setTimeout(() => {
      const improvements = mockFixEmail(message);
      
      res.json({
        message: {
          content: improvements
        },
        metadata: {
          model: 'mock-ai',
          usingFallback: false,
          timestamp: new Date().toISOString(),
        }
      });
    }, 1500);
    
  } catch (error) {
    console.error('Newsletter improvement error:', error);
    res.status(500).json({ error: 'Newsletter improvement failed' });
  }
});

// Fix endpoint
app.post('/api/fix', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`🔧 Fixing tagged content (${message.length} characters)`);
    
    // Simulate processing delay
    setTimeout(() => {
      const improvements = mockFixEmail(message);
      
      res.json({
        message: {
          content: improvements
        }
      });
    }, 1500);
    
  } catch (error) {
    console.error('Fix error:', error);
    res.status(500).json({ error: 'Fix failed' });
  }
});

// Store endpoint
app.post('/api/store', (req, res) => {
  try {
    const { payload } = req.body;
    const id = require('crypto').randomUUID();
    
    // In a real app, you'd store this in a database
    // For now, just return the ID
    console.log(`💾 Stored data with ID: ${id}`);
    
    res.json({ id });
  } catch (error) {
    console.error('Store error:', error);
    res.status(500).json({ error: 'Store failed' });
  }
});

// Load endpoint
app.get('/api/load', (req, res) => {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }
    
    // Mock response - in real app, load from database
    res.json({
      payload: {
        fullOriginalText: 'Sample text',
        fullOriginalHTML: '<p>Sample text</p>',
        taggedContent: 'Sample text'
      }
    });
  } catch (error) {
    console.error('Load error:', error);
    res.status(500).json({ error: 'Load failed' });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Quick server running on port ${PORT}`);
  console.log(`📊 Environment: development`);
  console.log(`🔗 Frontend should connect to: http://localhost:${PORT}`);
  console.log(`✅ Ready to analyze emails!`);
});

// Keep the server alive and handle errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});