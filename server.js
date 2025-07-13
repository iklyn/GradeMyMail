// Import required libraries
require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');       
const axios = require('axios');     
const fs = require('fs');           
const path = require('path');  
const { v4: uuidv4 } = require('uuid');   // new
const tempStore = new Map();              // in-memory cache (auto-cleared on restart)


// Initialize the express app
const app = express();

// Function to read the GradeMyMail prompt from file
function loadGradePrompt() {
  try {
    const promptPath = path.join(__dirname, 'SystemPrompt_GM.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('❌ Error reading GradeMyMail prompt file:', error.message);
    throw new Error('Could not load GradeMyMail prompt file');
  }
}

// Function to read the FixMyMail prompt from file
function loadFixPrompt() {
  try {
    const promptPath = path.join(__dirname, 'SystemPrompt_FM.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('❌ Error reading FixMyMail prompt file:', error.message);
    throw new Error('Could not load FixMyMail prompt file');
  }
}

// Proper CORS setup
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// POST endpoint for analyzing newsletter (GradeMyMail)
app.post('/api/analyze', async (req, res) => {
  const userMessage = req.body.message;

  console.log("✅ Received input from frontend for analysis.");

  try {
    // Load the GradeMyMail prompt from the external file
    const systemPrompt = loadGradePrompt();
    
    const payload = {
      model: 'meta-llama/llama-3-8b-instruct',
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}
${userMessage}`
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    };

    console.log("⏳ Sending request to OpenRouter for analysis...");
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'GradeMyMail'
        }
      }
    );

    console.log("✅ AI server responded for analysis.");

    res.json(response.data);

  } catch (error) {
    console.error('❌ Error talking to AI for analysis:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// POST endpoint for fixing newsletter (FixMyMail)
app.post('/api/fix', async (req, res) => {
  const userMessage = req.body.message;

  console.log("✅ Received input from frontend for fixing.");

  try {
    // Load the FixMyMail prompt from the external file
    const systemPrompt = loadFixPrompt();
    
    const payload = {
      model: 'meta-llama/llama-3-8b-instruct',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    };

    console.log("⏳ Sending request to OpenRouter for fixing...");
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'FixMyMail'
        }
      }
    );

    console.log("✅ AI server responded for fixing.");

    res.json(response.data);

  } catch (error) {
    console.error('❌ Error talking to AI for fixing:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// POST /api/store   – persist blob, return short id
app.post('/api/store', (req, res) => {
  try {
    const { payload } = req.body;            // anything you need to save
    if (!payload) return res.status(400).json({ error: 'No payload in body' });

    const id = uuidv4().slice(0, 8);         // short 8-char key
    tempStore.set(id, { payload, created: Date.now() });

    res.json({ id });                         // { "id": "abc123ef" }
  } catch (err) {
    console.error('❌ /api/store error:', err);
    res.status(500).json({ error: 'Server failure' });
  }
});

// GET /api/load?id=XYZ   – fetch previously stored blob
app.get('/api/load', (req, res) => {
  try {
    const { id } = req.query;
    if (!id || !tempStore.has(id)) {
      return res.status(404).json({ error: 'ID not found or expired' });
    }
    res.json(tempStore.get(id));             // returns { payload, created }
  } catch (err) {
    console.error('❌ /api/load error:', err);
    res.status(500).json({ error: 'Server failure' });
  }
});


// simple TTL cleanup: remove items older than 30 min every 10 min
setInterval(() => {
  const THIRTY_MIN = 30 * 60 * 1000;
  const now = Date.now();
  for (const [key, value] of tempStore) {
    if (now - value.created > THIRTY_MIN) tempStore.delete(key);
  }
}, 10 * 60 * 1000);


// Start the server
app.listen(3000, '0.0.0.0', () => {
  console.log('🚀 Server running on http://127.0.0.1:3000');
});