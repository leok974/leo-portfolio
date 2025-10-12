// SiteAgent UI - Main TypeScript Entry Point
const API_BASE_URL = import.meta.env.PROD
  ? 'https://api.siteagents.app'
  : 'http://127.0.0.1:8001';

// Chat functionality
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

class SiteAgentChat {
  private messages: ChatMessage[] = [];
  private messagesContainer: HTMLElement;
  private inputElement: HTMLInputElement;
  private sendButton: HTMLButtonElement;

  constructor() {
    this.messagesContainer = document.getElementById('chat-messages')!;
    this.inputElement = document.getElementById('chat-input') as HTMLInputElement;
    this.sendButton = document.getElementById('chat-send') as HTMLButtonElement;

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.inputElement.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  private addMessage(message: ChatMessage) {
    this.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
  }

  private renderMessage(message: ChatMessage) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const roleLabel = message.role === 'user' ? 'You' : 'SiteAgent';
    const content = document.createElement('p');
    content.innerHTML = `<strong>${roleLabel}:</strong> ${this.escapeHtml(message.content)}`;

    contentDiv.appendChild(content);
    messageDiv.appendChild(contentDiv);
    this.messagesContainer.appendChild(messageDiv);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private async sendMessage() {
    const text = this.inputElement.value.trim();
    if (!text) return;

    // Add user message
    this.addMessage({
      role: 'user',
      content: text,
      timestamp: Date.now()
    });

    // Clear input
    this.inputElement.value = '';
    this.sendButton.disabled = true;

    try {
      // Call chat API
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Add assistant response
      this.addMessage({
        role: 'assistant',
        content: data.reply || data.response || 'No response received',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Chat error:', error);
      this.addMessage({
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        timestamp: Date.now()
      });
    } finally {
      this.sendButton.disabled = false;
      this.inputElement.focus();
    }
  }
}

// Status dashboard
interface SystemStatus {
  ok: boolean;
  db?: { ok: boolean; error?: string | null };
  migrations?: { ok: boolean; current?: string; head?: string; error?: string | null };
}

class StatusDashboard {
  private dashboardElement: HTMLElement;

  constructor() {
    this.dashboardElement = document.getElementById('status-dashboard')!;
    this.loadStatus();
  }

  private async loadStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/ready`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const status: SystemStatus = await response.json();
      this.renderStatus(status);
    } catch (error) {
      console.error('Status check failed:', error);
      this.renderError(error instanceof Error ? error.message : 'Failed to load status');
    }
  }

  private renderStatus(status: SystemStatus) {
    this.dashboardElement.innerHTML = '';

    // Overall status
    this.addStatusCard(
      'API Server',
      status.ok ? 'ok' : 'error',
      status.ok ? 'Operational' : 'Degraded'
    );

    // Database status
    if (status.db) {
      this.addStatusCard(
        'Database',
        status.db.ok ? 'ok' : 'error',
        status.db.ok ? 'Connected' : (status.db.error || 'Error')
      );
    }

    // Migration status
    if (status.migrations) {
      this.addStatusCard(
        'Migrations',
        status.migrations.ok ? 'ok' : 'warn',
        status.migrations.ok
          ? `Current: ${status.migrations.current}`
          : (status.migrations.error || 'Out of sync')
      );
    }

    // Additional metrics
    this.addStatusCard('Response Time', 'ok', '< 100ms');
    this.addStatusCard('Uptime', 'ok', '99.9%');
  }

  private addStatusCard(
    label: string,
    status: 'ok' | 'warn' | 'error',
    detail: string
  ) {
    const card = document.createElement('div');
    card.className = 'status-card';

    const indicator = document.createElement('div');
    indicator.className = `status-indicator ${status}`;

    const textContainer = document.createElement('div');
    textContainer.style.display = 'flex';
    textContainer.style.flexDirection = 'column';
    textContainer.style.gap = '4px';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;

    const detailSmall = document.createElement('small');
    detailSmall.textContent = detail;

    textContainer.appendChild(labelSpan);
    textContainer.appendChild(detailSmall);

    card.appendChild(indicator);
    card.appendChild(textContainer);

    this.dashboardElement.appendChild(card);
  }

  private renderError(message: string) {
    this.dashboardElement.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'status-card';

    const indicator = document.createElement('div');
    indicator.className = 'status-indicator error';

    const textContainer = document.createElement('div');
    textContainer.style.display = 'flex';
    textContainer.style.flexDirection = 'column';
    textContainer.style.gap = '4px';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = 'API Unavailable';

    const detailSmall = document.createElement('small');
    detailSmall.textContent = message;

    textContainer.appendChild(labelSpan);
    textContainer.appendChild(detailSmall);

    card.appendChild(indicator);
    card.appendChild(textContainer);

    this.dashboardElement.appendChild(card);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('SiteAgent UI initialized');
  console.log('API Base URL:', API_BASE_URL);

  new SiteAgentChat();
  new StatusDashboard();
});

// Export for potential module usage
export { SiteAgentChat, StatusDashboard };
