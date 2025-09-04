// gemini.js - helper for Google Gemini API
// Reads API key from localStorage under 'geminiApiKey'
// Exposes global function callGemini(prompt)

async function callGemini(prompt) {
  const apiKey = localStorage.getItem('geminiApiKey');
  if (!apiKey) {
    throw new Error('Gemini API key not found. Set it in localStorage with key "geminiApiKey".');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

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
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

window.callGemini = callGemini;
