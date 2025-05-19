document.addEventListener('DOMContentLoaded', function() {
    // Track library loading state
    const libraryStatus = {
        hljs: typeof hljs !== 'undefined',
        marked: typeof marked !== 'undefined'
    };

    // Check for libraries periodically if not available at first
    if (!libraryStatus.hljs || !libraryStatus.marked) {
        const libraryCheckInterval = setInterval(() => {
            if (typeof hljs !== 'undefined') libraryStatus.hljs = true;
            if (typeof marked !== 'undefined') libraryStatus.marked = true;
            
            if (libraryStatus.hljs && libraryStatus.marked) {
                console.log("All required libraries loaded successfully.");
                clearInterval(libraryCheckInterval);
            }
        }, 500);
    }

    // Elements
    const chatHistory = document.getElementById('chat-history');
    const queryInput = document.getElementById('query-input');
    const queryForm = document.getElementById('query-form');
    const submitBtn = document.getElementById('submit-btn');
    const exampleQueriesList = document.getElementById('example-queries-list');
    const themeSwitch = document.getElementById('theme-switch');
    const connectionStatus = document.querySelector('#k8s-connection-status .status');
    const contextSelector = document.getElementById('k8s-context');
    const resetConversationBtn = document.getElementById('reset-conversation');
    
    // Load preferences
    const darkModePreferred = localStorage.getItem('darkMode') === 'true';
    if (darkModePreferred) {
        document.body.classList.add('dark-theme');
        themeSwitch.checked = true;
    }
    
    // Auto-resize textarea
    queryInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Theme switcher
    themeSwitch.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('darkMode', 'false');
        }
    });
    
    // Reset conversation button
    resetConversationBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to reset the conversation? This will clear all chat history.')) {
            resetConversation();
        }
    });
    
    // Function to reset the conversation
    function resetConversation() {
        fetch('/api/reset_conversation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Clear the chat UI, but keep the welcome message
                while (chatHistory.firstChild) {
                    chatHistory.removeChild(chatHistory.firstChild);
                }
                
                // Re-add the welcome message
                const welcomeMsg = document.createElement('div');
                welcomeMsg.className = 'welcome-message';
                welcomeMsg.innerHTML = `
                    <h2>Welcome to kubectl-ai Web Interface</h2>
                    <p>Ask any questions about your Kubernetes cluster using natural language.</p>
                    <div class="example-queries">
                        <h3>Try these example queries:</h3>
                        <ul id="example-queries-list"></ul>
                    </div>
                `;
                chatHistory.appendChild(welcomeMsg);
                
                // Reload example queries
                fetchExampleQueries();
                
                // Show confirmation message
                addMessage('ai', 'Conversation has been reset. You can start a new chat with context maintained between messages.');
            } else {
                console.error('Failed to reset conversation:', data.error);
            }
        })
        .catch(error => {
            console.error('Error resetting conversation:', error);
        });
    }
    
    // Load Kubernetes contexts
    loadContexts();
    
    // Context selector
    contextSelector.addEventListener('change', function() {
        const selectedContext = this.value;
        if (selectedContext) {
            setContext(selectedContext);
        }
    });
    
    // Load example queries
    fetchExampleQueries();
    
    // Check connection status
    checkConnectionStatus();
    
    // Handle form submission
    queryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const query = queryInput.value.trim();
        
        if (!query) return;
        
        // Disable input while processing
        queryInput.disabled = true;
        submitBtn.disabled = true;
        
        // Add user message to chat
        addMessage('user', query);
        
        // Add loading indicator
        const loadingEl = addLoadingIndicator();
        
        // Send query to backend
        sendQuery(query)
            .then(response => {
                // Remove loading indicator
                if (loadingEl) {
                    loadingEl.remove();
                }
                
                // The response is already displayed by the sendQuery function
                // Don't add another response message here
                console.log("Query completed successfully");
            })
            .catch(error => {
                // Remove loading indicator
                if (loadingEl) {
                    loadingEl.remove();
                }
                
                // Show error message
                addMessage('ai', `An error occurred: ${error.message}`);
                console.error('Error:', error);
            })
            .finally(() => {
                // Re-enable input
                queryInput.disabled = false;
                submitBtn.disabled = false;
                queryInput.value = '';
                queryInput.style.height = 'auto';
                queryInput.focus();
            });
    });
    
    // Load available Kubernetes contexts
    function loadContexts() {
        fetch('/api/contexts')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading contexts:', data.error);
                    contextSelector.innerHTML = '<option value="">Error loading contexts</option>';
                    return;
                }
                
                const contexts = data.contexts || [];
                const currentContext = data.current;
                
                contextSelector.innerHTML = '';
                
                contexts.forEach(context => {
                    const option = document.createElement('option');
                    option.value = context;
                    option.textContent = getShortContextName(context);
                    option.title = context; // Show full name on hover
                    
                    // Make current context selected
                    if (context === currentContext) {
                        option.selected = true;
                    }
                    
                    contextSelector.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Failed to load contexts:', error);
                contextSelector.innerHTML = '<option value="">Error loading contexts</option>';
            });
    }
    
    // Set current Kubernetes context
    function setContext(contextName) {
        fetch('/api/contexts/set', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ context: contextName }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Add message to chat
                    addMessage('ai', `Context switched to **${getShortContextName(contextName)}**`);
                    
                    // Update connection status
                    checkConnectionStatus();
                } else {
                    addMessage('ai', `Error: ${data.error}`);
                }
            })
            .catch(error => {
                console.error('Failed to set context:', error);
                addMessage('ai', `Error: Failed to set context. ${error.message}`);
            });
    }
    
    // Format context name to be more readable
    function getShortContextName(fullName) {
        // Handle GKE contexts
        if (fullName.startsWith('gke_')) {
            const parts = fullName.split('_');
            if (parts.length >= 4) {
                return `${parts[parts.length - 1]} (${parts[parts.length - 2]})`;
            }
        }
        
        return fullName;
    }
    
    // Fetch example queries from backend
    function fetchExampleQueries() {
        fetch('/api/available-commands')
            .then(response => response.json())
            .then(data => {
                if (data.commands && Array.isArray(data.commands)) {
                    exampleQueriesList.innerHTML = '';
                    
                    data.commands.forEach(command => {
                        const li = document.createElement('li');
                        li.textContent = command;
                        li.addEventListener('click', () => {
                            queryInput.value = command;
                            queryInput.dispatchEvent(new Event('input'));
                            queryInput.focus();
                        });
                        exampleQueriesList.appendChild(li);
                    });
                }
            })
            .catch(error => {
                console.error('Failed to fetch example queries:', error);
            });
    }
    
    // Check connection status to Kubernetes cluster
    function checkConnectionStatus() {
        fetch('/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: 'check connection status' }),
        })
            .then(response => {
                if (response.ok) {
                    connectionStatus.textContent = 'connected';
                    connectionStatus.classList.add('connected');
                } else {
                    connectionStatus.textContent = 'disconnected';
                    connectionStatus.classList.add('disconnected');
                }
            })
            .catch(() => {
                connectionStatus.textContent = 'disconnected';
                connectionStatus.classList.add('disconnected');
            });
    }
    
    // Send query to backend
    function sendQuery(query) {
        return new Promise((resolve, reject) => {
            fetch('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Server responded with status: ${response.status}`);
                    }
                    
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let result = '';
                    let messageElement = null;
                    
                    function readChunk() {
                                            return reader.read().then(({ value, done }) => {
                        if (done) {
                            // Remove typing indicator when done
                            const typingIndicator = messageElement?.querySelector('.typing-indicator');
                            if (typingIndicator) {
                                typingIndicator.remove();
                            }
                            return { response: result };
                        }
                            
                            const chunk = decoder.decode(value, { stream: true });
                            
                            // Parse each line as a separate JSON object
                            const lines = chunk.trim().split('\n');
                            lines.forEach(line => {
                                if (line.trim()) {
                                    try {
                                        const data = JSON.parse(line);
                                        if (data.error) {
                                            result += `\n**Error:** ${data.error}`;
                                        } else if (data.response) {
                                            // Only add to result, don't create a new message
                                            result += data.response;
                                        }
                                    } catch (e) {
                                        console.error('Error parsing JSON:', e, line);
                                    }
                                }
                            });
                            
                            // Create or update the AI message in the UI
                            if (!messageElement) {
                                // Create message element only once
                                messageElement = addMessage('ai', result);
                            } else {
                                // Update existing message with new content
                                messageElement.innerHTML = formatMessage(result);
                                // Scroll to bottom of chat history
                                chatHistory.scrollTop = chatHistory.scrollHeight;
                            }
                            
                            // Add typing indicator animation when throttled
                            const typingIndicator = document.querySelector('.typing-indicator');
                            if (!typingIndicator && lines.length > 0) {
                                const indicator = document.createElement('div');
                                indicator.className = 'typing-indicator';
                                indicator.innerHTML = `
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                `;
                                messageElement.appendChild(indicator);
                            }
                            
                            return readChunk();
                        });
                    }
                    
                    return readChunk();
                })
                .then(resolve)
                .catch(reject);
        });
    }
    
    // Add a message to the chat
    function addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        if (type === 'user') {
            messageDiv.textContent = content;
        } else {
            messageDiv.innerHTML = formatMessage(content);
        }
        
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        return messageDiv;
    }
    
    // Add loading indicator
    function addLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai-message loading';
        loadingDiv.innerHTML = `
            <span>kubectl-ai is thinking</span>
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        chatHistory.appendChild(loadingDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        return loadingDiv;
    }
    
    // Format message with markdown
    function formatMessage(text) {
        // Escape HTML to prevent XSS
        function escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
        
        // Convert escaped HTML back within code blocks
        text = escapeHtml(text);
        
        // Use marked.js for markdown formatting
        let formattedText;
        try {
            if (typeof marked !== 'undefined') {
                formattedText = marked.parse(text);
            } else {
                // Fallback if marked is not loaded
                console.warn("marked.js is not loaded yet, displaying plain text");
                formattedText = text.replace(/\n/g, '<br>');
            }
        } catch (e) {
            console.error("Error parsing markdown:", e);
            formattedText = text.replace(/\n/g, '<br>');
        }
        
        // Apply syntax highlighting to code blocks
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = formattedText;
        
        // Find all code blocks and apply syntax highlighting if hljs is available
        if (typeof hljs !== 'undefined') {
            tempDiv.querySelectorAll('pre code').forEach((block) => {
                try {
                    hljs.highlightElement(block);
                } catch (e) {
                    console.error("Error highlighting code block:", e);
                    // Fallback to just displaying the code without highlighting
                }
            });
        } else {
            console.warn("highlight.js is not loaded yet, code blocks won't be highlighted");
        }
        
        return tempDiv.innerHTML;
    }
}); 