// 后台脚本 - 截图下载

// 下载图片
function downloadImage(filename, dataUrl) {
  chrome.downloads.download({
    url: dataUrl,
    filename: 'tomato-novel/' + filename,
    saveAs: false,
    conflictAction: 'uniquify'
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[Background] Download error:', chrome.runtime.lastError);
    } else {
      console.log('[Background] Download started:', filename);
    }
  });
}

// 消息监听
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received:', request.action);

  switch (request.action) {
    case 'captureTab':
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ dataUrl: dataUrl });
        }
      });
      return true;

    case 'downloadImage':
      downloadImage(request.filename, request.dataUrl);
      sendResponse({ success: true });
      break;

    case 'progress':
      chrome.runtime.sendMessage({
        action: 'updateProgress',
        status: request.status,
        message: request.message,
        screenshotCount: request.screenshotCount
      }).catch(() => {});
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true;
});

console.log('[Background] Service worker started');
