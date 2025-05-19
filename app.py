import os
import subprocess
import json
import time
import re
import uuid
from flask import Flask, render_template, request, jsonify, Response, stream_with_context, session

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24).hex())

# Configuration
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
KUBECTL_AI_MODEL = os.environ.get('KUBECTL_AI_MODEL', 'gemini-2.5-flash-preview-04-17')
# Throttling settings
TOKEN_LIMIT_PER_CHUNK = 100  # Approximate number of tokens per chunk
DELAY_BETWEEN_CHUNKS = 1.0  # Delay in seconds between chunks

# Store conversation history for each session
# Format: {session_id: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
conversation_history = {}

@app.route('/')
def index():
    # Generate session ID if not exists
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    
    # Initialize conversation history for this session if needed
    if session['session_id'] not in conversation_history:
        conversation_history[session['session_id']] = []
    
    return render_template('index.html')

@app.route('/api/query', methods=['POST'])
def query():
    data = request.json
    user_query = data.get('query', '')
    
    if not user_query:
        return jsonify({"error": "Query is required"}), 400
    
    # Get session ID
    session_id = session.get('session_id')
    if not session_id:
        session_id = str(uuid.uuid4())
        session['session_id'] = session_id
        conversation_history[session_id] = []
    
    # Retrieve conversation history for this session
    history = conversation_history.get(session_id, [])
    
    # Add user query to history
    history.append({"role": "user", "content": user_query})
    
    # Prepare history for kubectl-ai
    history_text = ""
    for entry in history:
        history_text += f"{entry['role']}: {entry['content']}\n"
    
    # Construct the full query with history context
    full_query = user_query
    if len(history) > 1:  # If there's previous history
        full_query = f"Based on our previous conversation:\n{history_text}\n\nNow answer this: {user_query}"
    
    # Set up the environment for kubectl-ai
    env = os.environ.copy()
    env['GEMINI_API_KEY'] = GEMINI_API_KEY
    
    # Run kubectl-ai with the query
    process = subprocess.Popen(
        ["kubectl-ai", "--skip-permissions", "--quiet", "--model", KUBECTL_AI_MODEL, full_query],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
        bufsize=1,
        universal_newlines=True
    )
    
    def generate():
        # Buffer to hold accumulated output
        output_buffer = ""
        approximate_token_count = 0
        last_chunk_time = time.time()
        full_response = ""
        
        for line in process.stdout:
            output_buffer += line
            full_response += line  # Collect the complete response
            # Roughly estimate the token count (this is approximate)
            approximate_token_count += estimate_tokens(line)
            
            current_time = time.time()
            time_since_last_chunk = current_time - last_chunk_time
            
            # Check if we should send a chunk based on token count or if it's been a while
            if approximate_token_count >= TOKEN_LIMIT_PER_CHUNK or time_since_last_chunk >= 5.0:
                # Send current buffer
                yield json.dumps({"response": output_buffer}) + "\n"
                # Reset buffer and token count
                output_buffer = ""
                approximate_token_count = 0
                # Add delay to avoid rate limits
                time.sleep(DELAY_BETWEEN_CHUNKS)
                last_chunk_time = time.time()
        
        # Send any remaining content in the buffer
        if output_buffer:
            yield json.dumps({"response": output_buffer}) + "\n"
        
        process.wait()
        
        if process.returncode != 0:
            error = process.stderr.read()
            yield json.dumps({"error": error}) + "\n"
        else:
            # Add assistant response to conversation history
            history.append({"role": "assistant", "content": full_response.strip()})
            # Limit history length to keep context manageable (last 10 messages)
            conversation_history[session_id] = history[-10:]
    
    return Response(stream_with_context(generate()), mimetype='application/json')

@app.route('/api/reset_conversation', methods=['POST'])
def reset_conversation():
    """Reset the conversation history for the current session"""
    session_id = session.get('session_id')
    if session_id and session_id in conversation_history:
        conversation_history[session_id] = []
    
    return jsonify({"success": True, "message": "Conversation history has been reset"})

# Helper function to roughly estimate token count
def estimate_tokens(text):
    # A very rough approximation - about 4 chars per token on average
    return len(text) // 4 + 1

@app.route('/api/available-commands', methods=['GET'])
def available_commands():
    # You can expand this with more example commands
    example_commands = [
        "list all pods in the default namespace",
        "show nodes in the cluster",
        "describe deployment nginx-deployment",
        "what pods are in a CrashLoopBackOff state?",
        "show the logs for pod my-pod",
        "what versions of kubernetes are running on my nodes?",
    ]
    return jsonify({"commands": example_commands})

@app.route('/api/contexts', methods=['GET'])
def get_contexts():
    try:
        # Run kubectl config get-contexts command
        result = subprocess.run(
            ["kubectl", "config", "get-contexts", "-o", "name"],
            capture_output=True,
            text=True,
            check=True
        )
        
        # Get current context
        current_context_result = subprocess.run(
            ["kubectl", "config", "current-context"],
            capture_output=True,
            text=True
        )
        
        # Parse the output
        contexts = [context.strip() for context in result.stdout.strip().split('\n') if context.strip()]
        current_context = current_context_result.stdout.strip() if current_context_result.returncode == 0 else None
        
        return jsonify({
            "contexts": contexts,
            "current": current_context
        })
    except subprocess.CalledProcessError as e:
        return jsonify({"error": f"Failed to get contexts: {e.stderr}"}), 500

@app.route('/api/contexts/set', methods=['POST'])
def set_context():
    data = request.json
    context_name = data.get('context', '')
    
    if not context_name:
        return jsonify({"error": "Context name is required"}), 400
    
    try:
        # Run kubectl config use-context command
        result = subprocess.run(
            ["kubectl", "config", "use-context", context_name],
            capture_output=True,
            text=True,
            check=True
        )
        
        return jsonify({
            "success": True,
            "message": result.stdout.strip(),
            "context": context_name
        })
    except subprocess.CalledProcessError as e:
        return jsonify({
            "success": False,
            "error": f"Failed to set context: {e.stderr}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8082) 