// Enhanced Background script for Codeforces AI Assistant

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Codeforces AI Assistant installed/updated');

    if (details.reason === 'install') {
        console.log('First time installation');
        chrome.tabs.create({ url: 'https://codeforces.com/problemset', active: false });

        chrome.storage.local.set({
            installDate: Date.now(),
            version: chrome.runtime.getManifest().version
        });
    } else if (details.reason === 'update') {
        console.log('Extension updated from', details.previousVersion, 'to', chrome.runtime.getManifest().version);
        handleUpdate(details.previousVersion);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getSettings':
            chrome.storage.sync.get(['openRouterApiKey', 'preferredLanguage'], (result) => {
                sendResponse({ 
                    apiKey: result.openRouterApiKey,
                    language: result.preferredLanguage || 'cpp'
                });
            });
            return true;

        case 'saveSettings':
            chrome.storage.sync.set({ 
                openRouterApiKey: request.apiKey,
                preferredLanguage: request.language
            }, () => {
                sendResponse({ success: true });

                chrome.tabs.query({ url: "https://codeforces.com/*" }, (tabs) => {
                    tabs.forEach(tab => {
                        if (tab.url.includes('/problem/') || tab.url.includes('/problemset/problem/')) {
                            try {
                                chrome.tabs.sendMessage(tab.id, {
                                    action: 'settingsUpdated',
                                    apiKey: request.apiKey,
                                    language: request.language
                                }, () => {
                                    if (chrome.runtime.lastError) {
                                        chrome.scripting.executeScript({
                                            target: { tabId: tab.id },
                                            files: ['content.js']
                                        }).catch(console.error);
                                    }
                                });
                            } catch (err) {
                                console.warn('Error sending message to tab:', err);
                            }
                        }
                    });
                });
            });
            return true;

        case 'clearStorage':
            chrome.storage.local.clear(() => {
                chrome.storage.sync.clear(() => {
                    sendResponse({ success: true });
                });
            });
            return true;

        case 'getStats':
            getUsageStats(sendResponse);
            return true;

        case 'testApiKey':
            testApiKey(request.apiKey, sendResponse);
            return true;

        case 'launchWidget':
            launchWidgetOnTab(sendResponse);
            return true;

        default:
            console.log('Unknown message action:', request.action);
            sendResponse({ error: 'Unknown action' });
    }
});

chrome.action.onClicked.addListener(async (tab) => {
    console.log('Extension icon clicked');

    try {
        if (tab.url && tab.url.includes('codeforces.com')) {
            const result = await chrome.storage.sync.get(['openRouterApiKey']);

            if (!result.openRouterApiKey) {
                console.log('No API key found');
                return;
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['styles.css']
            });

            console.log('Content script and styles injected');
        } else {
            chrome.tabs.create({
                url: 'https://codeforces.com/problemset'
            });
        }
    } catch (error) {
        console.error('Error injecting content script:', error);
    }
});

async function launchWidgetOnTab(callback) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url.includes('codeforces.com')) {
            callback({ success: false, message: 'Please navigate to a Codeforces problem page first' });
            return;
        }

        if (!tab.url.includes('/problem/') && !tab.url.includes('/problemset/problem/')) {
            callback({ success: false, message: 'Please navigate to a specific Codeforces problem page' });
            return;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });

        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['styles.css']
        });

        setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'initializeWidget' }, () => {
                callback({ success: true, message: 'Widget launched successfully!' });
            });
        }, 500);

    } catch (error) {
        console.error('Error launching widget:', error);
        callback({ success: false, message: 'Failed to launch widget: ' + error.message });
    }
}

async function testApiKey(apiKey, callback) {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Hello! Just testing the connection.' }],
                max_tokens: 10
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                callback({ success: true, message: 'API key is valid!' });
            } else {
                callback({ success: false, message: 'Invalid response format' });
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            callback({
                success: false,
                message: errorData.error?.message || `HTTP ${response.status}`
            });
        }
    } catch (error) {
        console.error('API test failed:', error);
        callback({
            success: false,
            message: error.message || 'Connection failed'
        });
    }
}

chrome.alarms.create('cleanup', { periodInMinutes: 60 * 24 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanup') {
        cleanupOldData();
    }
});

function handleUpdate(previousVersion) {
    console.log(`Updating from version ${previousVersion}`);

    if (previousVersion && previousVersion.startsWith('1.')) {
        migrateFromV1();
    }
}

function migrateFromV1() {
    console.log('Migrating from v1.x format');

    chrome.storage.local.get(null, (data) => {
        const newData = {};

        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('problem_')) {
                newData[key] = {
                    ...value,
                    version: 2
                };
            }
        }

        if (Object.keys(newData).length > 0) {
            chrome.storage.local.set(newData, () => {
                console.log('Migration completed');
            });
        }
    });
}

function cleanupOldData() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    chrome.storage.local.get(null, (data) => {
        const keysToRemove = [];

        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('problem_') && value.lastAccessed && value.lastAccessed < thirtyDaysAgo) {
                keysToRemove.push(key);
            }
        }

        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove, () => {
                console.log(`Cleaned up ${keysToRemove.length} old problem entries`);
            });
        }
    });
}

function getUsageStats(callback) {
    chrome.storage.local.get(null, (data) => {
        let problemCount = 0;
        let totalInteractions = 0;
        const languageStats = {};

        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('problem_')) {
                problemCount++;
                totalInteractions += value.helpLevel || 0;

                const lang = value.language || 'cpp';
                languageStats[lang] = (languageStats[lang] || 0) + 1;
            }
        }

        callback({
            problemCount,
            totalInteractions,
            languageStats,
            installDate: data.installDate || null
        });
    });
}

chrome.runtime.setUninstallURL('https://forms.gle/your-feedback-form-id');

console.log('Codeforces AI Assistant background script loaded');

export {};
