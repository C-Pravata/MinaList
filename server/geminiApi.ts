import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';

// Load environment variables with explicit path to the root directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Also try loading from server directory as fallback
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

// Get API key with fallback
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBAl6oys66hGOlifNpm5nSyyiqDgccUVl8';
console.log('API Key status:', GEMINI_API_KEY ? 'Found and configured' : 'Not found');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface GeminiMessage {
  role: 'user' | 'model' | 'system';
  parts: { text: string }[];
}

export interface GeminiChatRequest {
  contents: GeminiMessage[];
}

export async function generateGeminiResponse(messages: GeminiMessage[]): Promise<string> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const requestBody: GeminiChatRequest = {
      contents: messages
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract the response text from the Gemini API response
    if (data.candidates && data.candidates[0]?.content?.parts && data.candidates[0].content.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Unexpected response format from Gemini API');
    }
  } catch (error) {
    console.error('Error generating Gemini response:', error);
    throw error;
  }
} 