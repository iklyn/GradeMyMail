// Import required libraries
require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');       
const axios = require('axios');     
const fs = require('fs');           
const path = require('path');       

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
        },
        responseType: 'stream'
      }
    );

    console.log("✅ AI server responded for analysis. Starting to stream...");

    // Set appropriate content type for streaming
    res.setHeader('Content-Type', 'application/json');
    
    // Pipe the response directly to the frontend
    response.data.pipe(res);

  } catch (error) {
    console.error('❌ Error talking to AI for analysis:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// POST endpoint for fixing newsletter (FixMyMail)
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
      ],
      stream: true  // Ensure streaming is enabled
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
        },
        responseType: 'stream'
      }
    );

    console.log("✅ AI server responded for fixing. Starting to stream...");

    // Set appropriate content type for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Pipe the response directly to the frontend
    response.data.pipe(res);

  } catch (error) {
    console.error('❌ Error talking to AI for fixing:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// Start the server
app.listen(3000, '0.0.0.0', () => {
  console.log('🚀 Server running on http://127.0.0.1:3000');
});