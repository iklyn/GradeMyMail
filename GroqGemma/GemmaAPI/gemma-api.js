import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

// --- Configure Environment ---
// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the .env file from the same directory as the script
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize Groq client
// The client automatically looks for the GROQ_API_KEY in the loaded environment
const groq = new Groq();

// --- Load System Prompt ---
let systemPrompt = '';
try {
  // Load the system prompt from the same directory as the script
  systemPrompt = fs.readFileSync(path.join(__dirname, 'systemprompt.txt'), 'utf8');
  console.log('✅ System prompt loaded successfully.');
} catch (error) {
  console.error('❌ Error loading system prompt:', error.message);
  console.error('Please make sure systemprompt.txt is in the same directory.');
  process.exit(1);
}

/**
 * Main function to get a response from the Groq API.
 * @param {string} userPrompt The prompt from the user.
 * @returns {Promise<void>}
 */
async function main(userPrompt) {
  if (!userPrompt) {
    console.log('Usage: node GemmaAPI/gemma-api.js "Your prompt here"');
    return;
  }

  console.log(`
🤖 Sending prompt to Gemma-3:4b...`);
  console.log(`   User Prompt: ${userPrompt}`);

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      model: 'gemma2-9b-it', // Make sure you have access to this model
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: false, // Set to true for streaming responses
      stop: null,
    });

    const response = chatCompletion.choices[0]?.message?.content || 'No response from model.';
    console.log('\n✅ Gemma-3:4b Response:');
    console.log('--------------------------------------------------');
    console.log(response);
    console.log('--------------------------------------------------');

  } catch (error) {
    console.error('❌ An error occurred while contacting the Groq API:');
    console.error(error.message);
  }
}

// Get the user prompt from command-line arguments
const userPrompt = process.argv[2];

main(userPrompt);