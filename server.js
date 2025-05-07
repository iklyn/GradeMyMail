// Import required libraries
require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');       
const axios = require('axios');     

// Initialize the express app
const app = express();

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

  const payload = {
    model: 'mistralai/mistral-7b-instruct',
    messages: [
      {
        role: 'system',
        content: `You are an expert newsletter readability evaluator.

Carefully review the following text sentence by sentence.

For each sentence:
- If it is very simple and short, wrap it with <Fluff> ... </Fluff>
- If it is moderately complex, wrap it with <Spam_words> ... </Spam_words>
- If it is very long, complicated, or hard to follow, wrap it with <Hard_to_read> ... </Hard_to_read>

**Important:**
- Every sentence must be categorized — no skipping allowed.
- Do not use any special formatting like curly braces or slashes.
- Only use the tags exactly as shown.

**Format Strictly Like This:**
<Fluff> Sentence </Fluff>
<Spam_words> Sentence </Spam_words>
<Hard_to_read> Sentence </Hard_to_read>

Now, here's the text:
[USER_INPUT_TEXT]`
      },
      {
        role: 'user',
        content: userMessage
      }
    ]
  };

  try {
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