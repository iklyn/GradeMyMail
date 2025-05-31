// Import required libraries
require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');       
const axios = require('axios');     
const fs = require('fs');           // Add this to read files
const path = require('path');       // Add this for file paths

// Initialize the express app
const app = express();

// Function to read the prompt from file
function loadPrompt() {
  try {
    const promptPath = path.join(__dirname, 'SystemPrompt_GM.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('❌ Error reading prompt file:', error.message);
    throw new Error('Could not load prompt file');
  }
}

// Proper CORS setup
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// POST endpoint for analyzing newsletter
app.post('/api/analyze', async (req, res) => {
  const userMessage = req.body.message;

  console.log("✅ Received input from frontend.");

  try {
    // Load the prompt from the external file
    const systemPrompt = loadPrompt();
    
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

    console.log("⏳ Sending request to OpenRouter...");
    
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

    console.log("✅ AI server responded. Starting to stream...");

    // Set appropriate content type for streaming
    res.setHeader('Content-Type', 'application/json');
    
    // Pipe the response directly to the frontend
    response.data.pipe(res);

  } catch (error) {
    console.error('❌ Error talking to AI:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// Start the server
app.listen(3000, '0.0.0.0', () => {
  console.log('🚀 Server running on http://127.0.0.1:3000');
});