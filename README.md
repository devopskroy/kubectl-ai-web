# kubectl-ai Web Interface

A modern web interface for interacting with the kubectl-ai tool, providing a user-friendly way to query your Kubernetes cluster using natural language.

## Features

- 🚀 Modern, responsive web interface
- 🌙 Dark/Light mode support
- 💬 Chat-like interface with persistent conversation context
- 🔄 Kubernetes context selector for switching between clusters
- 🔍 Syntax highlighting for code responses
- 📋 Example queries for quick reference
- 📱 Mobile-friendly design
- ⏱️ API throttling to handle Gemini free tier limitations
- 🗑️ Conversation reset functionality

## Prerequisites

- Python 3.8 or higher
  - Run `python3 --version` to check your Python version
  - If not installed, download from [python.org](https://www.python.org/downloads/) or use your system's package manager
- kubectl-ai installed and working on your machine
- Access to a Kubernetes cluster configured with kubectl

## Installation

1. Clone this repository:

```bash
git clone https://github.com/devopskroy/kubectl-ai-web.git
cd kubectl-ai-web
```

2. Install the required Python dependencies:

```bash
pip3 install -r requirements.txt
```
Note: Use `pip3` instead of `pip` to ensure you're using Python 3 packages.

## Usage

1. Set your Gemini API key as an environment variable:

```bash
export GEMINI_API_KEY=your_api_key_here
```

You can generate a free Gemini API key by:
- Visiting [Google AI Studio](https://aistudio.google.com/apikey)
- Signing in with your Google account
- Creating a new API key

This project uses the `gemini-2.5-flash` model by default, as it is available for free through the Google AI Studio and provides excellent performance for Kubernetes operations.

2. Start the web server:

```bash
python3 app.py
```

Or use the convenience script:

```bash
./start.sh
```

3. Open your browser and navigate to:

```
http://localhost:8082
```

4. Start interacting with your Kubernetes cluster using natural language!

## Features in Detail

### Kubernetes Context Switching
The application allows you to easily switch between different Kubernetes contexts/clusters directly from the web UI. This is useful if you manage multiple clusters.

### Conversation Context
The application maintains conversation context between messages, allowing you to ask follow-up questions without repeating information. For example:
1. "Show me all pods in default namespace"
2. "Which ones are in Running state?"

### Throttling for Free API Tiers
The application implements throttling mechanisms to handle Gemini API free tier limitations, breaking large responses into smaller chunks with delays between them to avoid rate limits.

### Reset Conversation
You can reset the conversation history at any time by clicking the "Reset" button in the chat header.

## Configuration

You can configure the application by setting the following environment variables:

- `GEMINI_API_KEY`: Your Gemini API key (required)
- `KUBECTL_AI_MODEL`: The model to use (default: gemini-2.5-flash-preview-04-17)
- `FLASK_ENV`: Set to `development` for debug mode
- `SECRET_KEY`: Custom secret key for Flask sessions (generated randomly if not provided)

For throttling configuration, you can modify these variables in app.py:
- `TOKEN_LIMIT_PER_CHUNK`: Approximate tokens per chunk (default: 100)
- `DELAY_BETWEEN_CHUNKS`: Delay in seconds between chunks (default: 1.0)

## Deployment

For production deployment, you can use Gunicorn:

```bash
gunicorn -b 0.0.0.0:8082 app:app
```

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.

## Author

Created by [Kishan Ray](https://github.com/devopskroy)

## Acknowledgements

- [kubectl-ai](https://github.com/GoogleCloudPlatform/kubectl-ai) for the core functionality
- Google for the Gemini API 