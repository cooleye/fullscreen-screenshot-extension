// 内容脚本 - 自动滚动截图 + 图片拼接

class ScreenshotCapture {
  constructor() {
    this.isCapturing = false;
    this.scrollDelay = 800;
    this.screenshots = [];
    this.page = 0;
    this.scrollContainer = null;
    console.log('[ScreenshotCapture] Initialized');
  }

  findScrollContainer() {
    const selectors = [
      'div.muye-reader',
      'div[class*="muye-reader"]',
      'div[class*="reader"]',
      '.reader-content',
      'div[class*="reader-content"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.scrollHeight > element.clientHeight) {
        console.log('[ScreenshotCapture] Found scroll container:', selector);
        return element;
      }
    }

    console.log('[ScreenshotCapture] Using default scroll container');
    return document.documentElement;
  }

  getVisibleSize() {
    if (this.scrollContainer === document.documentElement) {
      return { width: window.innerWidth, height: window.innerHeight };
    } else {
      return { width: this.scrollContainer.clientWidth, height: this.scrollContainer.clientHeight };
    }
  }

  async captureVisibleTab() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'captureTab' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[ScreenshotCapture] Capture error:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(response?.dataUrl || null);
        }
      });
    });
  }

  doScroll(step) {
    this.scrollContainer.scrollTop += step;
  }

  getScrollInfo() {
    const container = this.scrollContainer;
    if (container === document.documentElement) {
      return {
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight
      };
    } else {
      return {
        scrollY: container.scrollTop,
        innerHeight: container.clientHeight,
        scrollHeight: container.scrollHeight
      };
    }
  }

  sendProgress(status, message) {
    try {
      chrome.runtime.sendMessage({
        action: 'progress',
        status: status,
        message: message,
        screenshotCount: this.page
      });
    } catch (e) {
      console.log('[ScreenshotCapture] Send progress error:', e);
    }
  }

  downloadImage(filename, dataUrl) {
    chrome.runtime.sendMessage({
      action: 'downloadImage',
      filename: filename,
      dataUrl: dataUrl
    });
  }

  async mergeImages(images) {
    if (images.length === 0) return null;
    if (images.length === 1) return images[0];

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height * images.length;
        canvas.width = width;
        canvas.height = height;

        let currentHeight = 0;
        let loadedCount = 0;

        images.forEach((dataUrl, index) => {
          const imgEl = new Image();
          imgEl.onload = () => {
            ctx.drawImage(imgEl, 0, currentHeight, width, imgEl.height);
            currentHeight += imgEl.height;
            loadedCount++;

            if (loadedCount === images.length) {
              resolve(canvas.toDataURL('image/png'));
            }
          };
          imgEl.src = dataUrl;
        });
      };
      img.src = images[0];
    });
  }

  async mergeAndSave() {
    if (this.screenshots.length === 0) {
      this.sendProgress('error', '没有截取到任何图片');
      return;
    }

    this.sendProgress('merging', '正在合成图片...');

    const mergedImage = await this.mergeImages(this.screenshots);

    if (mergedImage) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const pageCount = this.screenshots.length;
      const filename = `screenshot_${timestamp}_${pageCount}p.png`;

      this.downloadImage(filename, mergedImage);
      this.sendProgress('complete', `完成！已保存 ${pageCount} 页截图`);
    } else {
      this.sendProgress('error', '截图失败');
    }
  }

  async start(fullscreen = true) {
    if (this.isCapturing) {
      console.log('[ScreenshotCapture] Already capturing');
      return;
    }

    this.scrollContainer = this.findScrollContainer();
    const { width, height } = this.getVisibleSize();
    console.log('[ScreenshotCapture] Visible size:', width, 'x', height);

    this.isCapturing = true;
    this.screenshots = [];
    this.page = 0;

    this.sendProgress('starting', '开始截图...');

    if (!fullscreen) {
      const image = await this.captureVisibleTab();
      if (image) {
        this.page++;
        this.screenshots.push(image);
      }
      this.isCapturing = false;
      await this.mergeAndSave();
      return;
    }

    // 记录当前滚动位置，从当前位置开始截图
    const startScrollY = this.scrollContainer === document.documentElement 
      ? window.scrollY 
      : this.scrollContainer.scrollTop;
    
    // 给页面一点时间稳定
    await new Promise(r => setTimeout(r, 500));

    const firstImage = await this.captureVisibleTab();
    if (firstImage) {
      this.page++;
      this.screenshots.push(firstImage);
      this.sendProgress('capturing', `${this.page}`);
    }

    let maxPages = 100;

    while (this.isCapturing && this.page < maxPages) {
      const info = this.getScrollInfo();
      const scrollBottom = info.scrollY + info.innerHeight;
      const atBottom = scrollBottom >= info.scrollHeight - 10;

      // 如果已经到达底部，停止循环
      if (atBottom) {
        console.log('[ScreenshotCapture] Reached bottom!');
        break;
      }

      // 先滚动到下一屏
      this.doScroll(height);
      await new Promise(r => setTimeout(r, this.scrollDelay));

      // 再截图
      const image = await this.captureVisibleTab();
      if (image) {
        this.page++;
        this.screenshots.push(image);
        this.sendProgress('capturing', `${this.page}`);
      }
    }

    // 只有正常完成（非停止）时才调用 mergeAndSave
    // 如果 isCapturing 为 false，说明用户点击了停止，由 stop() 方法处理合并
    if (this.isCapturing) {
      await this.mergeAndSave();
    }

    this.isCapturing = false;
    console.log('[ScreenshotCapture] Finished');
  }

  stop() {
    this.isCapturing = false;
    console.log('[ScreenshotCapture] Stopped, merging captured images...');
    this.mergeAndSave();
  }
}

window.screenshotCapture = new ScreenshotCapture();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[ScreenshotCapture] Received:', request.action);

  switch (request.action) {
    case 'startCapture':
      window.screenshotCapture.start(request.fullscreen !== false);
      sendResponse({ success: true });
      break;

    case 'stopCapture':
      window.screenshotCapture.stop();
      sendResponse({ success: true });
      break;

    case 'getStatus':
      sendResponse({
        isCapturing: window.screenshotCapture.isCapturing,
        screenshotCount: window.screenshotCapture.page
      });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true;
});

console.log('[ScreenshotCapture] Script loaded');