// gemini.js - helper for Google Gemini API
// Reads API key from localStorage under 'geminiApiKey'
// Exposes global function callGemini(prompt)

async function callGemini(prompt) {
  const apiKey = localStorage.getItem('geminiApiKey');
  if (!apiKey) {
    console.warn('Gemini API key not found. Add one in the Gemini settings.');
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }]}]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini API error:', err);
      return null;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (error) {
    console.error('Failed to call Gemini API:', error);
    return null;
  }
}

window.callGemini = callGemini;
