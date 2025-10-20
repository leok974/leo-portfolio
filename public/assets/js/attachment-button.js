/**
 * attachment-button.js
 * File upload button for chat interface with gallery integration
 *
 * Features:
 * - File chooser button (📎 icon)
 * - Accepts images and videos
 * - Auto-creates gallery card via backend API
 * - Shows upload progress
 * - Displays success message in chat
 * - Lightweight vanilla JS (no dependencies)
 *
 * Usage:
 *   <script src="/assets/js/attachment-button.js"></script>
 *   AttachmentButton.init('#chatForm', { onAdded: (result) => {...} });
 *
 * @ts-nocheck - Browser globals available at runtime
 */

(function() {
  'use strict';

  const AttachmentButton = {
    /**
     * Check if uploads feature is enabled
     * @returns {boolean} True if uploads should be available
     */
    isEnabled() {
      // Check environment variable (set by Vite)
      const envFlag = typeof window !== 'undefined' &&
                     (window.__VITE_FEATURE_AGENT_UPLOADS__ === '1' ||
                      window.__VITE_FEATURE_AGENT_UPLOADS__ === true);

      // Check dev unlock state (if available)
      const devUnlocked = typeof window !== 'undefined' &&
                         window.__DEV_UNLOCKED__ === true;

      // Check if user is admin (if available)
      const isAdmin = typeof window !== 'undefined' &&
                     window.__USER_ROLE__ === 'admin';

      // Allow if: feature flag is on, OR dev is unlocked, OR user is admin
      return envFlag || devUnlocked || isAdmin;
    },

    /**
     * Initialize attachment button
     * @param {string} formSelector - CSS selector for chat form (e.g., '#chatForm')
     * @param {Object} [options] - Configuration options
     * @param {Function} [options.onAdded] - Callback when file added: (result) => void
     * @param {Function} [options.onError] - Callback on error: (error) => void
     * @param {boolean} [options.makeCard] - Whether to create gallery card (default: true)
     * @param {string} [options.accept] - File types to accept (default: 'image/*,video/*')
     * @param {boolean} [options.forceEnable] - Override feature check (for testing)
     */
    init(formSelector, options = {}) {
      // Check if feature is enabled (unless forced)
      if (!options.forceEnable && !AttachmentButton.isEnabled()) {
        console.log('[AttachmentButton] Feature disabled, skipping initialization');
        return;
      }

      const form = document.querySelector(formSelector);
      if (!form) {
        console.error('[AttachmentButton] Form not found:', formSelector);
        return;
      }

      const {
        onAdded = null,
        onError = null,
        makeCard = true,
        accept = 'image/*,video/*'
      } = options;

      // Create hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      input.setAttribute('data-testid', 'attachment-input');
      form.appendChild(input);

      // Create attachment button
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'attachment-btn';
      button.setAttribute('aria-label', 'Attach file');
      button.setAttribute('data-testid', 'attachment-button');
      button.title = 'Attach image or video';
      button.innerHTML = '📎';

      // Find submit button and insert attachment button before it
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn?.parentNode) {
        submitBtn.parentNode.insertBefore(button, submitBtn);
      } else {
        form.appendChild(button);
      }

      // State management
      let uploading = false;

      // Click handler - open file chooser
      button.addEventListener('click', () => {
        if (uploading) return;
        input.click();
      });

      // File change handler - upload file
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;

        uploading = true;
        button.disabled = true;
        button.innerHTML = '⏳';
        button.title = 'Uploading...';

        try {
          const result = await AttachmentButton.uploadFile(file, { makeCard });

          // Success feedback
          button.innerHTML = '✓';
          button.title = 'Upload successful';

          // Show success message in chat
          if (result.item?.title) {
            AttachmentButton.showChatMessage(
              `✓ Added to gallery: **${result.item.title}**`,
              'success'
            );
          } else {
            AttachmentButton.showChatMessage(
              `✓ File uploaded: ${result.url}`,
              'success'
            );
          }

          // Callback
          if (onAdded) onAdded(result);

          // Reset after delay
          setTimeout(() => {
            button.innerHTML = '📎';
            button.title = 'Attach image or video';
          }, 2000);

        } catch (error) {
          console.error('[AttachmentButton] Upload failed:', error);

          // Error feedback
          button.innerHTML = '✗';
          button.title = 'Upload failed';

          const errorMsg = error instanceof Error ? error.message : String(error);
          AttachmentButton.showChatMessage(
            `✗ Upload failed: ${errorMsg}`,
            'error'
          );

          if (onError) onError(error);

          // Reset after delay
          setTimeout(() => {
            button.innerHTML = '📎';
            button.title = 'Attach image or video';
          }, 3000);

        } finally {
          uploading = false;
          button.disabled = false;
          input.value = ''; // Reset file input
        }
      });

      console.log('[AttachmentButton] Initialized');
    },

    /**
     * Upload file to backend
     * @param {File} file - File object from input
     * @param {Object} [options] - Upload options
     * @param {boolean} [options.makeCard] - Create gallery card
     * @param {string} [options.title] - Custom title (defaults to filename)
     * @param {string} [options.description] - Description text
     * @param {string} [options.tools] - Comma-separated tools
     * @param {string} [options.tags] - Comma-separated tags
     * @returns {Promise<Object>} Upload result
     */
    async uploadFile(file, options = {}) {
      const {
        makeCard = true,
        title = null,
        description = null,
        tools = null,
        tags = null
      } = options;

      // Check if API helper is available
      if (typeof window.API?.uploadFile === 'function') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('make_card', makeCard.toString());
        if (title) formData.append('title', title);
        if (description) formData.append('description', description);
        if (tools) formData.append('tools', tools);
        if (tags) formData.append('tags', tags);

        return window.API.uploadFile(formData);
      }

      // Fallback: direct fetch
      const formData = new FormData();
      formData.append('file', file);
      formData.append('make_card', makeCard.toString());
      if (title) formData.append('title', title);
      if (description) formData.append('description', description);
      if (tools) formData.append('tools', tools);
      if (tags) formData.append('tags', tags);

      // Get CSRF token
      const csrfToken = localStorage.getItem('csrf_token') ||
                       document.querySelector('meta[name="csrf-token"]')?.content || '';

      const headers = {};
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      // Determine base URL
      const isPages = location.hostname.endsWith('github.io');
      const base = window.__API_BASE__ ||
                  window.AGENT_BASE_URL ||
                  (isPages ? 'https://api.leoklemet.com/api' : '/api');

      const resp = await fetch(`${base}/uploads`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Upload failed: ${resp.status} ${text}`);
      }

      return resp.json();
    },

    /**
     * Show message in chat log
     * @param {string} message - Message text (supports Markdown)
     * @param {string} type - Message type: 'success' | 'error' | 'info'
     */
    showChatMessage(message, type = 'info') {
      const chatLog = document.getElementById('chatLog');
      if (!chatLog) return;

      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-message chat-message-${type}`;
      msgDiv.setAttribute('role', 'status');
      msgDiv.setAttribute('data-testid', `upload-message-${type}`);

      // Simple markdown-like bold conversion
      const html = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      msgDiv.innerHTML = html;

      chatLog.appendChild(msgDiv);

      // Auto-scroll to bottom
      chatLog.scrollTop = chatLog.scrollHeight;

      // Auto-remove after delay
      setTimeout(() => {
        msgDiv.style.transition = 'opacity 0.3s';
        msgDiv.style.opacity = '0';
        setTimeout(() => msgDiv.remove(), 300);
      }, 5000);
    }
  };

  // Export to global scope
  window.AttachmentButton = AttachmentButton;

  // Auto-init if chat form exists (optional convenience)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('chatForm')) {
        // Don't auto-init to give caller control
        console.log('[AttachmentButton] Ready for init()');
      }
    });
  }
})();
