// Data Export and Import Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add export/import buttons to the navigation or footer
    const addDataManagementControls = function() {
        // Create container for data management controls
        const dataManagementContainer = document.createElement('div');
        dataManagementContainer.className = 'data-management-container';
        dataManagementContainer.innerHTML = `
            <h3>Data Management</h3>
            <p>Export your data to continue on another device or as a backup.</p>
            <div class="data-management-buttons">
                <button id="export-data" class="btn btn-primary"><i class="fas fa-download"></i> Export Data</button>
                <button id="import-data" class="btn btn-secondary"><i class="fas fa-upload"></i> Import Data</button>
            </div>
            <input type="file" id="import-file" accept=".json" style="display: none;">
        `;
        
        // Add to the page - find appropriate location
        const aboutSection = document.getElementById('about');
        if (aboutSection) {
            aboutSection.appendChild(dataManagementContainer);
        } else {
            // If no about section, add to the end of the main container
            const mainContainer = document.querySelector('main .container');
            if (mainContainer) {
                mainContainer.appendChild(dataManagementContainer);
            }
        }
        
        // Add event listeners
        const exportBtn = document.getElementById('export-data');
        const importBtn = document.getElementById('import-data');
        const importFile = document.getElementById('import-file');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', exportUserData);
        }
        
        if (importBtn) {
            importBtn.addEventListener('click', function() {
                importFile.click();
            });
        }
        
        if (importFile) {
            importFile.addEventListener('change', importUserData);
        }
        
        // Also add a data management section to the home page
        const homeSection = document.getElementById('home');
        if (homeSection) {
            const toolsGrid = homeSection.querySelector('.tools-grid');
            if (toolsGrid) {
                const dataManagementCard = document.createElement('div');
                dataManagementCard.className = 'tool-card';
                dataManagementCard.dataset.tool = 'about';
                dataManagementCard.innerHTML = `
                    <div class="tool-icon"><i class="fas fa-database"></i></div>
                    <h3>Data Management</h3>
                    <p>Export or import your data to continue on another device.</p>
                    <button class="btn">Manage Data</button>
                `;
                toolsGrid.appendChild(dataManagementCard);
            }
        }
    };
    
    // Function to export all user data
    const exportUserData = function() {
        // Collect all data from localStorage
        const userData = {};
        
        // Get all localStorage keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            try {
                // Try to parse as JSON, if not, store as string
                const value = localStorage.getItem(key);
                try {
                    userData[key] = JSON.parse(value);
                } catch (e) {
                    userData[key] = value;
                }
            } catch (e) {
                console.error('Error exporting data for key:', key, e);
            }
        }
        
        // Add metadata
        userData.metadata = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            appName: 'ADHD Tools Hub'
        };
        
        // Convert to JSON string
        const jsonData = JSON.stringify(userData, null, 2);
        
        // Create download link
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonData);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "adhd-tools-data-" + new Date().toISOString().split('T')[0] + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        // Show success message
        showNotification('Data exported successfully! You can save this file or email it to yourself to use on another device.');
    };
    
    // Function to import user data
    const importUserData = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const userData = JSON.parse(e.target.result);
                
                // Verify this is valid ADHD Tools Hub data
                if (!userData.metadata || userData.metadata.appName !== 'ADHD Tools Hub') {
                    throw new Error('Invalid data file. This does not appear to be ADHD Tools Hub data.');
                }
                
                // Confirm before overwriting existing data
                if (localStorage.length > 0) {
                    if (!confirm('This will overwrite your existing data. Are you sure you want to continue?')) {
                        return;
                    }
                }
                
                // Clear existing localStorage data
                localStorage.clear();
                
                // Import all data except metadata
                for (const key in userData) {
                    if (key !== 'metadata') {
                        localStorage.setItem(key, JSON.stringify(userData[key]));
                    }
                }
                
                // Show success message
                showNotification('Data imported successfully! Refreshing page to load your data...');
                
                // Refresh the page after a short delay to load the new data
                setTimeout(function() {
                    window.location.reload();
                }, 2000);
                
            } catch (e) {
                console.error('Error importing data:', e);
                showNotification('Error importing data: ' + e.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    
    // Function to show notifications
    const showNotification = function(message, type = 'success') {
        // Check if notification container exists, if not create it
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            document.body.appendChild(notificationContainer);
            
            // Add styles if not already in CSS
            const style = document.createElement('style');
            style.textContent = `
                #notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                }
                .notification {
                    background-color: #fff;
                    border-radius: 4px;
                    box-shadow: 0 3px 6px rgba(0,0,0,0.16);
                    margin-bottom: 10px;
                    padding: 15px 20px;
                    transition: all 0.3s ease;
                    max-width: 350px;
                }
                .notification.success {
                    border-left: 4px solid #4CAF50;
                }
                .notification.error {
                    border-left: 4px solid #F44336;
                }
                .notification.info {
                    border-left: 4px solid #2196F3;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add to container
        notificationContainer.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(function() {
            notification.style.opacity = '0';
            setTimeout(function() {
                notification.remove();
            }, 300);
        }, 5000);
    };
    
    // Add email export functionality
    const addEmailExportOption = function() {
        // Create email export modal
        const emailModal = document.createElement('div');
        emailModal.id = 'email-export-modal';
        emailModal.className = 'modal';
        emailModal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h2>Export Data via Email</h2>
                <p>Enter your email address to receive your ADHD Tools Hub data:</p>
                <div class="email-form">
                    <input type="email" id="export-email" placeholder="your@email.com" required>
                    <button id="send-email-export" class="btn btn-primary">Send Data</button>
                </div>
                <div class="email-instructions">
                    <p>Alternative method:</p>
                    <ol>
                        <li>Click "Export Data" to download your data file</li>
                        <li>Attach this file to an email and send it to yourself</li>
                        <li>On your other device, download the file</li>
                        <li>Visit ADHD Tools Hub and click "Import Data"</li>
                    </ol>
                </div>
            </div>
        `;
        document.body.appendChild(emailModal);
        
        // Add styles for modal
        const style = document.createElement('style');
        style.textContent = `
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            }
            .modal-content {
                background-color: #fff;
                margin: 10% auto;
                padding: 20px;
                border-radius: 5px;
                max-width: 500px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }
            .close-modal {
                color: #aaa;
                float: right;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
            }
            .close-modal:hover {
                color: #555;
            }
            .email-form {
                margin: 20px 0;
                display: flex;
                gap: 10px;
            }
            .email-form input {
                flex: 1;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            .email-instructions {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #eee;
            }
        `;
        document.head.appendChild(style);
        
        // Add "Email Data" button next to Export Data button
        const exportBtn = document.getElementById('export-data');
        if (exportBtn) {
            const emailExportBtn = document.createElement('button');
            emailExportBtn.id = 'email-export';
            emailExportBtn.className = 'btn btn-secondary';
            emailExportBtn.innerHTML = '<i class="fas fa-envelope"></i> Email Data';
            exportBtn.after(emailExportBtn);
            
            // Add event listener to show modal
            emailExportBtn.addEventListener('click', function() {
                document.getElementById('email-export-modal').style.display = 'block';
            });
        }
        
        // Add event listeners for modal
        const closeModal = document.querySelector('.close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', function() {
                document.getElementById('email-export-modal').style.display = 'none';
            });
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            const modal = document.getElementById('email-export-modal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Handle email export
        const sendEmailExportBtn = document.getElementById('send-email-export');
        if (sendEmailExportBtn) {
            sendEmailExportBtn.addEventListener('click', function() {
                const email = document.getElementById('export-email').value;
                if (!email || !email.includes('@')) {
                    showNotification('Please enter a valid email address', 'error');
                    return;
                }
                
                // In a real implementation, this would send the data to a server
                // that would email it to the user. Since we don't have a server,
                // we'll simulate this by creating a mailto link with instructions.
                
                // Get the data as a JSON string
                const userData = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    try {
                        const value = localStorage.getItem(key);
                        try {
                            userData[key] = JSON.parse(value);
                        } catch (e) {
                            userData[key] = value;
                        }
                    } catch (e) {
                        console.error('Error exporting data for key:', key, e);
                    }
                }
                
                // Add metadata
                userData.metadata = {
                    exportDate: new Date().toISOString(),
                    version: '1.0',
                    appName: 'ADHD Tools Hub'
                };
                
                // Create mailto link with instructions
                const subject = encodeURIComponent('ADHD Tools Hub Data Export');
                const body = encodeURIComponent(
                    'Your ADHD Tools Hub data is attached to this email.\n\n' +
                    'To import this data on another device:\n' +
                    '1. Save the attached file\n' +
                    '2. Visit ADHD Tools Hub\n' +
                    '3. Click "Import Data" and select the file\n\n' +
                    'Note: This email does not actually contain your data attachment because ' +
                    'web applications cannot automatically attach files to emails for security reasons. ' +
                    'Instead, please use the "Export Data" button to download your data file, then ' +
                    'manually attach it to an email.'
                );
                
                const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`;
                window.location.href = mailtoLink;
                
                // Show instructions
                showNotification('Email client opened. Please attach your exported data file to the email manually.');
                
                // Close modal
                document.getElementById('email-export-modal').style.display = 'none';
                
                // Trigger data export to download the file
                exportUserData();
            });
        }
    };
    
    // Add data management controls to the page
    addDataManagementControls();
    
    // Add email export functionality
    addEmailExportOption();
    
    // Add About section if it doesn't exist
    if (!document.getElementById('about')) {
        const aboutSection = document.createElement('section');
        aboutSection.id = 'about';
        aboutSection.className = 'tool-section';
        aboutSection.innerHTML = `
            <h2>About ADHD Tools Hub</h2>
            <p>ADHD Tools Hub is a collection of interactive tools designed to help individuals with ADHD manage their symptoms, improve productivity, and enhance focus.</p>
            
            <div class="about-content">
                <h3>How to Use This Website</h3>
                <p>This website works entirely in your browser. All your data is stored locally on your device using browser storage. No data is sent to any server unless you explicitly export it.</p>
                
                <h3>Data Privacy</h3>
                <p>Your privacy is important. All your tasks, schedules, and settings remain on your device. To use your data across multiple devices, use the Export/Import feature.</p>
            </div>
        `;
        
        const mainContainer = document.querySelector('main .container');
        if (mainContainer) {
            mainContainer.appendChild(aboutSection);
        }
    }
});
