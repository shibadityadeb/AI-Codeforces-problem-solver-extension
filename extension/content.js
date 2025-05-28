if (!window.__CodeforcesAIAssistantDefined) {
    window.__CodeforcesAIAssistantDefined = true;

// Enhanced Content script for Codeforces AI Assistant using OpenRouter

class CodeforcesAIAssistant {
    constructor() {
        this.apiKey = null;
        this.chatWidget = null;
        this.isInitialized = false;
        this.currentProblemUrl = null;
        this.helpLevel = 0; // 0: explanation, 1: hints, 2: concepts
        this.preferredLanguage = 'cpp'; // default programming language
        const existingWidget = document.getElementById('cf-ai-assistant');
        if (existingWidget) existingWidget.remove();
        this.init();
    }

    async init(languageOverride) {
        const result = await chrome.storage.sync.get(['openRouterApiKey', 'preferredLanguage']);
        this.apiKey = result.openRouterApiKey;
        this.preferredLanguage = languageOverride || result.preferredLanguage || 'cpp';
        if (!this.apiKey) {
            // Do not proceed if API key is missing
            return;
        }
        // Always reset help level to 0 for the current problem
        this.helpLevel = 0;
        this.saveProblemState();
        if (this.isOnProblemPage() && !document.getElementById('cf-ai-assistant')) {
            this.currentProblemUrl = window.location.href;
            this.createChatWidget();
            this.isInitialized = true;
        }
    }

    isOnProblemPage() {
        const url = window.location.href;
        return url.includes('codeforces.com') &&
               (url.includes('/problem/') || url.includes('/problemset/problem/'));
    }

    async loadProblemState() {
        const problemKey = this.getProblemKey();
        const result = await chrome.storage.local.get([problemKey]);
        if (result[problemKey]) {
            this.helpLevel = result[problemKey].helpLevel || 0;
            this.preferredLanguage = result[problemKey].language || 'cpp';
        }
    }

    async saveProblemState() {
        const problemKey = this.getProblemKey();
        await chrome.storage.local.set({
            [problemKey]: {
                helpLevel: this.helpLevel,
                language: this.preferredLanguage,
                lastAccessed: Date.now()
            }
        });
    }

    getProblemKey() {
        const match = window.location.href.match(/\/(problemset\/problem|problem)\/(\d+)\/([A-Z])/);
        return match ? `problem_${match[2]}_${match[3]}` : `problem_${Date.now()}`;
    }

    extractProblemData() {
        const problemStatement = document.querySelector('.problem-statement');
        if (!problemStatement) return null;

        const title = document.querySelector('.title')?.textContent?.trim() || 'Problem';
        const timeLimit = document.querySelector('.time-limit')?.textContent?.trim() || '';
        const memoryLimit = document.querySelector('.memory-limit')?.textContent?.trim() || '';
        const problemText = problemStatement.innerText || '';
        const samples = [];

        document.querySelectorAll('.sample-test').forEach(test => {
            const input = test.querySelector('.input pre')?.textContent?.trim() || '';
            const output = test.querySelector('.output pre')?.textContent?.trim() || '';
            if (input || output) samples.push({ input, output });
        });

        return { title, timeLimit, memoryLimit, problemText, samples, url: window.location.href };
    }

    createChatWidget() {
        this.chatWidget = document.createElement('div');
        this.chatWidget.id = 'cf-ai-assistant';
        this.chatWidget.classList.add('cf-ai-hidden'); // Hide by default
        this.chatWidget.innerHTML = `
            <div class="cf-ai-header">
                <span>🤖 AI Assistant (Level ${this.helpLevel + 1}/3)</span>
                <div class="cf-ai-controls">
                    <select id="cf-ai-language" class="cf-ai-lang-select">
                        <option value="cpp">C++</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="javascript">JavaScript</option>
                        <option value="c">C</option>
                        <option value="rust">Rust</option>
                        <option value="go">Go</option>
                    </select>
                    <button id="cf-ai-reset" title="Reset Progress">🔄</button>
                    <button id="cf-ai-minimize">−</button>
                    <button id="cf-ai-close">×</button>
                </div>
            </div>
            <div class="cf-ai-body">
                <div id="cf-ai-messages"></div>
                <div class="cf-ai-input-area">
                    <textarea id="cf-ai-input" placeholder="Ask me about this problem..."></textarea>
                    <div class="cf-ai-buttons">
                        <button id="cf-ai-help" class="cf-ai-main-btn">${this.getHelpButtonText()}</button>
                        <button id="cf-ai-send">Send</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.chatWidget);
        this.setupEventListeners();
        this.addWelcomeMessage();
        
        // Set selected language
        document.getElementById('cf-ai-language').value = this.preferredLanguage;
        this.chatWidget.classList.remove('cf-ai-hidden'); // Show when created from launcher
    }

    getHelpButtonText() {
        const helpTexts = [
            'Explain Problem',
            'Get Hints',
            'Show Concepts'
        ];
        return helpTexts[this.helpLevel] || 'Explain Problem';
    }

    setupEventListeners() {
        const body = document.querySelector('.cf-ai-body');
        
        document.getElementById('cf-ai-minimize').addEventListener('click', () => {
            this.chatWidget.classList.add('cf-ai-hidden');
        });

        document.getElementById('cf-ai-close').addEventListener('click', () => {
            this.chatWidget.classList.add('cf-ai-hidden');
        });

        document.getElementById('cf-ai-reset').addEventListener('click', () => {
            this.resetProgress();
        });

        document.getElementById('cf-ai-language').addEventListener('change', (e) => {
            this.preferredLanguage = e.target.value;
            this.saveProblemState();
        });

        document.getElementById('cf-ai-send').addEventListener('click', () => this.sendMessage());
        document.getElementById('cf-ai-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        const helpBtn = document.getElementById('cf-ai-help');
        helpBtn.addEventListener('click', () => this.provideProgressiveHelp());

        this.makeDraggable();
    }

    makeDraggable() {
        const header = document.querySelector('.cf-ai-header');
        let isDragging = false, initialX, initialY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
            isDragging = true;
            initialX = e.clientX - this.chatWidget.offsetLeft;
            initialY = e.clientY - this.chatWidget.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            this.chatWidget.style.left = `${e.clientX - initialX}px`;
            this.chatWidget.style.top = `${e.clientY - initialY}px`;
        });

        document.addEventListener('mouseup', () => isDragging = false);
    }

    addWelcomeMessage() {
        const levelDescriptions = [
            "I'll explain the problem clearly",
            "I'll give you strategic hints",
            "I'll show key concepts needed"
        ];
        
        this.addMessage(`
            👋 <strong>Welcome!</strong><br>
            Current Help Level: <strong>${this.helpLevel + 1}/3</strong><br>
            ${levelDescriptions[this.helpLevel]}<br><br>
            
            <strong>Progressive Help System:</strong>
            <ul>
                <li><strong>Level 1:</strong> Problem Explanation</li>
                <li><strong>Level 2:</strong> Hints & Approach</li>
                <li><strong>Level 3:</strong> Key Concepts</li>
            </ul>
            
            Click the main help button or ask me anything!
        `, 'bot', true);
    }

    async resetProgress() {
        this.helpLevel = 0;
        await this.saveProblemState();
        
        // Update UI
        document.querySelector('.cf-ai-header span').textContent = `🤖 AI Assistant (Level ${this.helpLevel + 1}/3)`;
        const helpBtn = document.getElementById('cf-ai-help');
        helpBtn.textContent = this.getHelpButtonText();
        
        this.addMessage('🔄 Progress reset! Starting from Level 1: Problem Explanation', 'bot');
    }

    async provideProgressiveHelp() {
        const helpBtn = document.getElementById('cf-ai-help');
        helpBtn.disabled = true;
        const originalText = helpBtn.textContent;
        helpBtn.textContent = 'Fetching data...';
        const problemData = this.extractProblemData();
        if (!problemData) {
            this.addMessage('⚠️ Could not load problem data. Please refresh the page.', 'error');
            helpBtn.disabled = false;
            helpBtn.textContent = originalText;
            return;
        }
        let response;
        switch (this.helpLevel) {
            case 0:
                response = `<h3>Explanation</h3>\n` + await this.getProblemExplanation(problemData);
                this.helpLevel = 1;
                break;
            case 1:
                response = `<h3>Hints</h3>\n` + await this.getHints(problemData);
                this.helpLevel = 2;
                break;
            case 2:
                response = `<h3>Concepts</h3>\n` + await this.getConcepts(problemData);
                this.helpLevel = 3;
                break;
            default:
                response = "You've reached the maximum help level. Try solving the problem now!";
                this.helpLevel = 0;
        }
        this.addMessage(response, 'ai', true);
        await this.saveProblemState();
        document.querySelector('.cf-ai-header span').textContent = `🤖 AI Assistant (Level ${Math.min(this.helpLevel + 1, 3)}/3)`;
        helpBtn.textContent = this.getHelpButtonText();
        if (this.helpLevel >= 3) {
            helpBtn.disabled = true;
            helpBtn.textContent = 'Done';
        } else {
            helpBtn.disabled = false;
        }
    }

    getProblemExplanation(problemData) {
        const prompt = `You are a helpful programming tutor. Explain this Codeforces problem in a clear and concise way:

${this.formatProblemPrompt(problemData)}

Please provide:
1. Problem summary in simple terms
2. Input/output format explanation
3. Example test cases explanation
4. Key constraints and edge cases to consider
5. Initial thoughts on approach (without giving away the solution)

Make it easy to understand for someone new to competitive programming.`;

        return this.callOpenRouterAPI(prompt);
    }

    async getHints(problemData) {
        const prompt = `You are a helpful programming tutor. The student has already understood the problem. Now provide strategic hints and approaches for solving this Codeforces problem. Give hints that guide them toward the solution without revealing the complete approach.

${this.formatProblemPrompt(problemData)}

Provide hints about:
1. What data structures might be useful
2. What algorithmic approach to consider
3. Key observations about the problem
4. Edge cases to think about
5. Time/space complexity considerations

Give hints that make them think, not direct solutions.`;

        return await this.callOpenRouterAPI(prompt);
    }

    async getConcepts(problemData) {
        const prompt = `You are a helpful programming tutor. The student understands the problem and has some hints. Now explain the key concepts, algorithms, and techniques needed to solve this Codeforces problem.

${this.formatProblemPrompt(problemData)}

Explain the concepts:
1. Main algorithm/technique required
2. Key data structures needed
3. Mathematical concepts (if any)
4. Implementation details to consider
5. Common patterns this problem follows

Focus on teaching the concepts they need to know, with brief examples where helpful.`;

        return await this.callOpenRouterAPI(prompt);
    }

    async sendMessage() {
        const input = document.getElementById('cf-ai-input');
        const userMessage = input.value.trim();
        if (!userMessage) return;

        this.addMessage(userMessage, 'user');
        input.value = '';

        const problemData = this.extractProblemData();
        const response = await this.getAIResponse(userMessage, problemData);
        this.addMessage(response, 'bot');
    }

    async getAIResponse(userMessage, problemData) {
        const contextPrompt = `You are a helpful AI assistant for Codeforces programming problems. The user is currently at help level ${this.helpLevel + 1}/3 for this problem. Their preferred programming language is ${this.preferredLanguage}.

Current Problem:
${this.formatProblemPrompt(problemData)}

User Question: ${userMessage}

Please provide a helpful response that's appropriate for their current level and question. If they ask for code examples, use ${this.preferredLanguage} unless they specify otherwise.`;

        return await this.callOpenRouterAPI(contextPrompt);
    }

    formatProblemPrompt(problemData) {
        return `Title: ${problemData.title}
${problemData.timeLimit}
${problemData.memoryLimit}

Problem Statement:
${problemData.problemText}

Sample Tests:
${problemData.samples.map((s, i) => `Input ${i + 1}:
${s.input}
Output ${i + 1}:
${s.output}`).join('\n\n')}`;
    }

    async callOpenRouterAPI(prompt) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "openai/gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "⚠️ No response from the AI.";
        } catch (error) {
            console.error("OpenRouter API error:", error);
            return "⚠️ Error: Could not get a response. Please check your API key or try again later.";
        }
    }

    addMessage(content, sender, isHtml = false) {
        const messagesDiv = document.getElementById('cf-ai-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `cf-ai-message cf-ai-${sender}`;
        const msgContent = document.createElement('div');
        msgContent.className = 'cf-ai-message-content';
        if (sender === 'bot' || sender === 'ai') {
            //typing effect for bopt response
            msgContent.innerHTML = '';
            msgDiv.appendChild(msgContent);
            messagesDiv.appendChild(msgDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            this.typeText(msgContent, isHtml ? content : this.formatMarkdown(content));
            return;
        } else if (isHtml) {
            msgContent.innerHTML = content;
        } else {
            msgContent.textContent = content;
        }
        msgDiv.appendChild(msgContent);
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    typeText(element, html, speed = 18) {
        //typing effect
        let i = 0;
        let tag = '';
        let isTag = false;
        function type() {
            if (i < html.length) {
                if (html[i] === '<') isTag = true;
                if (isTag) tag += html[i];
                else element.innerHTML += html[i];
                if (html[i] === '>') {
                    isTag = false;
                    element.innerHTML += tag;
                    tag = '';
                }
                i++;
                setTimeout(type, speed);
            } else if (tag) {
                element.innerHTML += tag;
            }
        }
        type();
    }

    escapeHtml(text) {
        return text.replace(/[&<>"']/g, (match) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#039;'
        })[match]);
    }

    formatMarkdown(text) {
        // First escape HTML to prevent XSS
        const escaped = this.escapeHtml(text);
        
        // Then convert markdown to HTML
        return escaped
            .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => 
                `<pre><code class="language-${lang || ''}">${this.escapeHtml(code)}</code></pre>`)
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/<br><br>/g, '<br>'); // Remove double line breaks
    }
}

//if API key is present and on a Codeforces problem page
async function conditionalLauncher() {
    const url = window.location.href;
    const isCF = url.includes('codeforces.com') && (url.includes('/problem/') || url.includes('/problemset/problem/'));
    if (!isCF) return;
    const result = await chrome.storage.sync.get(['openRouterApiKey']);
    if (result.openRouterApiKey) {
        createFloatingLauncher();
        const launcher = document.getElementById('cf-ai-launcher');
        if (launcher) launcher.classList.remove('cf-ai-launcher-hidden');
    } else {
        const launcher = document.getElementById('cf-ai-launcher');
        if (launcher) launcher.classList.add('cf-ai-launcher-hidden');
    }
}

function createFloatingLauncher() {
    if (document.getElementById('cf-ai-launcher')) return;
    const launcher = document.createElement('div');
    launcher.id = 'cf-ai-launcher';
    launcher.innerHTML = `<span style="font-size: 28px;">💬</span>`;
    launcher.title = 'Open Codeforces AI Assistant';
    document.body.appendChild(launcher);
    launcher.addEventListener('click', () => {
        const widget = document.getElementById('cf-ai-assistant');
        if (widget && !widget.classList.contains('cf-ai-hidden')) {
            widget.classList.add('cf-ai-hidden');
        } else {
            if (widget) {
                widget.classList.remove('cf-ai-hidden');
            } else {
                new CodeforcesAIAssistant();
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', conditionalLauncher);
} else {
    conditionalLauncher();
}

//messages to launch widget from popup or on API key update
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'initializeWidget' || request.action === 'apiKeyUpdated' || request.action === 'saveSettings') {
        console.log('[AI Assistant] Re-initializing widget from message...');
        new CodeforcesAIAssistant().init(request.language);
        conditionalLauncher();
        sendResponse?.({ success: true });
    }
    if (request.action === 'clearKey') {
        const launcher = document.getElementById('cf-ai-launcher');
        if (launcher) launcher.classList.add('cf-ai-launcher-hidden');
    }
});
}