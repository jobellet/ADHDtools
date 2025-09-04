// gemini-settings.js - UI for managing Gemini API key
// Provides simple controls to save or clear the key in localStorage

document.addEventListener('DOMContentLoaded', () => {
  const aboutSection = document.getElementById('about') || document.querySelector('main .container');
  if (!aboutSection) return;

  const container = document.createElement('div');
  container.id = 'gemini-settings';
  container.innerHTML = `
    <h3>Gemini API Key</h3>
    <input type="password" id="gemini-api-key-input" placeholder="Enter API Key" />
    <button id="save-gemini-key" class="btn btn-primary">Save</button>
    <button id="clear-gemini-key" class="btn btn-secondary">Clear</button>
    <span id="gemini-key-status" style="margin-left:0.5rem"></span>
  `;
  aboutSection.appendChild(container);

  const input = container.querySelector('#gemini-api-key-input');
  const status = container.querySelector('#gemini-key-status');
  const existingKey = localStorage.getItem('geminiApiKey');
  if (existingKey) {
    status.textContent = 'Key saved';
  }

  container.querySelector('#save-gemini-key').addEventListener('click', () => {
    const key = input.value.trim();
    if (!key) {
      status.textContent = 'No key entered';
      return;
    }
    localStorage.setItem('geminiApiKey', key);
    input.value = '';
    status.textContent = 'Key saved';
  });

  container.querySelector('#clear-gemini-key').addEventListener('click', () => {
    localStorage.removeItem('geminiApiKey');
    status.textContent = 'Key cleared';
  });
});

