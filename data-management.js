 (() => {
   const APP_NAME = 'ADHD Tools Hub';
   const APP_VERSION = '1.0';

   // Utility: show a temporary notification
   function showNotification(message, type = 'success') {
     let container = document.getElementById('data-notification-container');
     if (!container) {
       container = document.createElement('div');
       container.id = 'data-notification-container';
       container.style.position = 'fixed';
       container.style.top = '20px';
       container.style.right = '20px';
       container.style.zIndex = '10000';
       document.body.appendChild(container);
     }
     const note = document.createElement('div');
     note.textContent = message;
     note.style.marginBottom = '0.5rem';
     note.style.padding = '1rem';
     note.style.borderRadius = '4px';
     note.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
     note.style.backgroundColor = type === 'error'
       ? '#fdecea'
       : '#e8f5e9';
     container.appendChild(note);
     setTimeout(() => note.remove(), 4000);
   }

   // Collect all data from localStorage
   function collectAllData() {
     const data = {};
     for (let i = 0; i < localStorage.length; i++) {
       const key = localStorage.key(i);
       try {
         data[key] = JSON.parse(localStorage.getItem(key));
       } catch {
         data[key] = localStorage.getItem(key);
       }
     }
     data.metadata = {
       app: APP_NAME,
       version: APP_VERSION,
       exportedAt: new Date().toISOString()
     };
     return data;
   }

   // Export data to a downloadable JSON file
   function exportDataToFile() {
     const data = collectAllData();
     const json = JSON.stringify(data, null, 2);
     const blob = new Blob([json], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `${APP_NAME.toLowerCase().replace(/\s+/g, '-')}-data-${new Date().toISOString().split('T')[0]}.json`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
     showNotification('Data exported successfully.', 'success');
   }

   // Import data from a selected JSON file
   function importDataFromFile(file) {
     if (!file) return;
     const reader = new FileReader();
     reader.onload = event => {
       try {
         const imported = JSON.parse(event.target.result);
         if (!imported.metadata || imported.metadata.app !== APP_NAME) {
           throw new Error('Invalid data file');
         }
         if (localStorage.length && !confirm('This will overwrite existing data. Continue?')) {
           return;
         }
         localStorage.clear();
         Object.keys(imported).forEach(key => {
           if (key !== 'metadata') {
             localStorage.setItem(key, JSON.stringify(imported[key]));
           }
         });
         showNotification('Data imported successfully. Reloading...', 'success');
         setTimeout(() => location.reload(), 1500);
       } catch (err) {
         console.error(err);
         showNotification(`Import failed: ${err.message}`, 'error');
       }
     };
     reader.readAsText(file);
   }

   // Build and append the data management UI
   function createDataManagementUI() {
     const container = document.createElement('div');
     container.className = 'data-management-container';
     container.innerHTML = `
       <h3>Data Management</h3>
       <button id="export-data-btn" class="btn btn-primary">
         <i class="fas fa-download"></i> Export Data
       </button>
       <button id="import-data-btn" class="btn btn-secondary">
         <i class="fas fa-upload"></i> Import Data
       </button>
       <button id="email-data-btn" class="btn btn-secondary">
         <i class="fas fa-envelope"></i> Email Data
       </button>
       <input type="file" id="import-data-file" accept=".json" style="display:none" />
     `;
     const aboutSection = document.getElementById('about') || document.querySelector('main .container');
     aboutSection.appendChild(container);

     const exportBtn = document.getElementById('export-data-btn');
     const importBtn = document.getElementById('import-data-btn');
     const emailBtn = document.getElementById('email-data-btn');
     const fileInput = document.getElementById('import-data-file');

     exportBtn.addEventListener('click', exportDataToFile);
     importBtn.addEventListener('click', () => fileInput.click());
     fileInput.addEventListener('change', e => importDataFromFile(e.target.files[0]));

     emailBtn.addEventListener('click', () => {
       exportDataToFile();
       setTimeout(() => {
         const subject = encodeURIComponent(`${APP_NAME} Data Export`);
         const body = encodeURIComponent(
           'Please find your data export attached as a JSON file. ' +
           'After exporting, attach the downloaded file to this email and send it to yourself.'
         );
         window.location.href = `mailto:?subject=${subject}&body=${body}`;
       }, 500);
     });
   }

   document.addEventListener('DOMContentLoaded', createDataManagementUI);
 })();
