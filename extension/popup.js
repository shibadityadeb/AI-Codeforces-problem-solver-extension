document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyButton = document.getElementById('saveKey');
    const testConnectionButton = document.getElementById('testConnection');
    const clearKeyButton = document.getElementById('clearKey');
    const statusDiv = document.getElementById('status');
    const languageSelect = document.getElementById('preferredLanguage');

    // Load existing settings
    chrome.storage.sync.get(['openRouterApiKey', 'preferredLanguage'], function(result) {
        if (result.openRouterApiKey) {
            apiKeyInput.value = result.openRouterApiKey;
            showStatus('API key loaded', 'success');
        }
        if (result.preferredLanguage) {
            languageSelect.value = result.preferredLanguage;
        }
    });

    // Save settings
    saveKeyButton.addEventListener('click', function () {
        const apiKey = apiKeyInput.value.trim();
        const language = languageSelect.value;

        if (!apiKey) {
            showStatus('Please enter an API key', 'error');
            return;
        }

        // Basic validation
        if (!apiKey.startsWith('sk-') && !apiKey.startsWith('gsk_')) {
            showStatus('Invalid API key format', 'error');
            return;
        }

        chrome.storage.sync.set({ 
            openRouterApiKey: apiKey,
            preferredLanguage: language
        }, function () {
            showStatus('Settings saved successfully!', 'success');

            // Send message to background script
            chrome.runtime.sendMessage({
                action: 'saveSettings',
                apiKey: apiKey,
                language: language
            }, function (response) {
                if (response && response.success) {
                    console.log('Settings saved and widget initialized if on problem page');
                }
            });

            // Attempt to launch widget if on Codeforces problem page
            launchAIWidget(apiKey, language);
        });
    });

    // Test connection
    testConnectionButton.addEventListener('click', async function() {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            showStatus('Please enter an API key first', 'error');
            return;
        }

        showStatus('Testing connection...', '');
        testConnectionButton.disabled = true;
        testConnectionButton.textContent = 'Testing...';

        try {
            // Test with OpenRouter API
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': chrome.runtime.getURL(''),
                    'X-Title': 'Codeforces AI Assistant'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-3.5-turbo',
                    messages: [{ 
                        role: 'user', 
                        content: 'Hello! Just testing the connection.' 
                    }],
                    max_tokens: 10
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    showStatus('✅ Connection successful! Now click Save Settings to launch the AI widget.', 'success');
                    // Do not launch widget or close popup here
                } else {
                    throw new Error('Invalid response format');
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            showStatus(`❌ Connection failed: ${error.message}`, 'error');
        } finally {
            testConnectionButton.disabled = false;
            testConnectionButton.textContent = 'Test Connection';
        }
    });

    // Clear settings
    clearKeyButton.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all settings?')) {
            chrome.storage.sync.remove(['openRouterApiKey', 'preferredLanguage'], function() {
                apiKeyInput.value = '';
                languageSelect.value = 'cpp';
                showStatus('Settings cleared', 'success');
                
                // Clear any stored problem states as well
                chrome.storage.local.clear(function() {
                    console.log('Cleared all problem progress data');
                });
            });
        }
    });

    // Function to launch AI widget
    function launchAIWidget(apiKey, language) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (currentTab && currentTab.url && currentTab.url.includes('codeforces.com')) {
                // Check if it's a problem page
                if (currentTab.url.includes('/problem/') || currentTab.url.includes('/problemset/problem/')) {
                    // Inject content script and CSS
                    chrome.scripting.executeScript({
                        target: { tabId: currentTab.id },
                        files: ['content.js']
                    }).then(() => {
                        return chrome.scripting.insertCSS({
                            target: { tabId: currentTab.id },
                            files: ['styles.css']
                        });
                    }).then(() => {
                        // Send message to initialize the widget
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'initializeWidget',
                            apiKey: apiKey,
                            language: language
                        });
                        showStatus('🤖 AI Widget launched!', 'success');
                        
                        // Close popup after short delay
                        setTimeout(() => {
                            window.close();
                        }, 1000);
                    }).catch(error => {
                        console.error('Error launching AI widget:', error);
                        showStatus('Error launching widget', 'error');
                    });
                } else {
                    showStatus('Please navigate to a Codeforces problem page', 'error');
                }
            } else {
                showStatus('Please navigate to Codeforces', 'error');
            }
        });
    }

    // Show/hide API key
    const toggleVisibilityButton = document.createElement('button');
    toggleVisibilityButton.textContent = '👁️';
    toggleVisibilityButton.className = 'toggle-visibility';
    toggleVisibilityButton.type = 'button';
    toggleVisibilityButton.style.cssText = `
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        opacity: 0.6;
        transition: opacity 0.2s;
    `;
    
    const inputGroup = apiKeyInput.parentElement;
    inputGroup.style.position = 'relative';
    inputGroup.appendChild(toggleVisibilityButton);
    
    toggleVisibilityButton.addEventListener('click', function() {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleVisibilityButton.textContent = '🙈';
        } else {
            apiKeyInput.type = 'password';
            toggleVisibilityButton.textContent = '👁️';
        }
    });

    toggleVisibilityButton.addEventListener('mouseenter', function() {
        this.style.opacity = '1';
    });

    toggleVisibilityButton.addEventListener('mouseleave', function() {
        this.style.opacity = '0.6';
    });

    // Enter key support
    apiKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            testConnectionButton.click(); // Test first, then auto-save on success
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + (type || '');
    }
});