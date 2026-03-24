// Popup脚本 - iOS风格界面

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusText = document.getElementById('statusText');
  const statusIcon = document.getElementById('statusIcon');
  const progressBar = document.getElementById('progressBar');
  const progressContainer = document.getElementById('progressContainer');
  const progressPercent = document.getElementById('progressPercent');
  const logArea = document.getElementById('logArea');
  const fullscreenToggle = document.getElementById('fullscreenToggle');
  const initialTime = document.getElementById('initialTime');

  let isCapturing = false;

  // 设置初始时间
  initialTime.textContent = new Date().toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });

  function addLog(message, type = 'info') {
    const logItem = document.createElement('div');
    logItem.className = 'log-item ' + type;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = new Date().toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    
    logItem.appendChild(timeSpan);
    logItem.appendChild(messageSpan);
    logArea.appendChild(logItem);
    logArea.scrollTop = logArea.scrollHeight;

    // 限制日志数量
    while (logArea.children.length > 30) {
      logArea.removeChild(logArea.firstChild);
    }
  }

  function updateStatus(status, message) {
    statusText.textContent = message;

    // 更新状态图标
    statusIcon.className = 'status-icon ' + status;
    
    // 更新图标SVG
    let iconSvg = '';
    switch (status) {
      case 'ready':
        iconSvg = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        statusText.style.color = 'var(--ios-text)';
        progressContainer.style.display = 'none';
        break;
      case 'starting':
        iconSvg = '<svg viewBox="0 0 24 24"><path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/></svg>';
        statusText.style.color = 'var(--ios-blue)';
        progressContainer.style.display = 'block';
        break;
      case 'capturing':
        iconSvg = '<svg viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>';
        statusText.style.color = 'var(--ios-blue)';
        progressContainer.style.display = 'block';
        break;
      case 'processing':
        iconSvg = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
        statusText.style.color = 'var(--ios-orange)';
        progressContainer.style.display = 'block';
        break;
      case 'complete':
        iconSvg = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        statusText.style.color = 'var(--ios-green)';
        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
        setTimeout(() => {
          progressContainer.style.display = 'none';
        }, 2000);
        break;
      case 'error':
        iconSvg = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
        statusText.style.color = 'var(--ios-red)';
        progressContainer.style.display = 'none';
        addLog(message, 'error');
        break;
      case 'stopped':
        iconSvg = '<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>';
        statusText.style.color = 'var(--ios-orange)';
        progressContainer.style.display = 'none';
        addLog('截图已停止', 'error');
        break;
      default:
        iconSvg = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        statusText.style.color = 'var(--ios-text)';
    }
    statusIcon.innerHTML = iconSvg;

    // 更新进度条
    if (status === 'capturing') {
      const progress = Math.min(95, 5 + (parseInt(message) || 0) * 5);
      progressBar.style.width = progress + '%';
      progressPercent.textContent = Math.round(progress) + '%';
    } else if (status === 'processing') {
      progressBar.style.width = '95%';
      progressPercent.textContent = '95%';
    }

    // 完成或错误时更新按钮状态
    if (status === 'complete' || status === 'error' || status === 'stopped') {
      updateButtons(false);
    }
  }

  function updateButtons(capturing) {
    isCapturing = capturing;
    startBtn.disabled = capturing;
    stopBtn.disabled = !capturing;
    fullscreenToggle.disabled = capturing;
    
    // 更新按钮文字
    if (capturing) {
      startBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="animation: spin 1s linear infinite;"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        截图中...
      `;
    } else {
      startBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
        开始截图
      `;
    }
  }

  async function startCapture() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        addLog('无法获取当前标签页', 'error');
        return;
      }

      addLog('正在启动截图任务...', 'info');
      updateButtons(true);
      updateStatus('starting', '准备中...');

      const fullscreen = fullscreenToggle.checked;

      chrome.tabs.sendMessage(tab.id, { action: 'startCapture', fullscreen: fullscreen }, (response) => {
        if (chrome.runtime.lastError) {
          addLog('页面未加载，请刷新后重试', 'error');
          updateButtons(false);
          updateStatus('error', '启动失败');
        } else {
          addLog('截图任务已启动', 'success');
        }
      });

    } catch (error) {
      addLog('启动失败: ' + error.message, 'error');
      updateButtons(false);
    }
  }

  async function stopCapture() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'stopCapture' });
      }

    } catch (error) {
      addLog('停止失败: ' + error.message, 'error');
    }
  }

  // 监听来自content script的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateProgress') {
      const { status, message } = request;
      updateStatus(status, message);
    }
  });

  startBtn.addEventListener('click', startCapture);
  stopBtn.addEventListener('click', stopCapture);

  // 添加旋转动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
});
