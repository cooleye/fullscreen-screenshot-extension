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

// 区域截图功能
class AreaScreenshot {
  constructor() {
    this.isSelecting = false;
    this.overlay = null;
    this.selectionBox = null;
    this.startX = 0;
    this.startY = 0;
    this.endX = 0;
    this.endY = 0;
  }

  createOverlay() {
    // 创建遮罩层
    this.overlay = document.createElement('div');
    this.overlay.id = 'area-screenshot-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      cursor: crosshair;
      z-index: 999999;
      user-select: none;
    `;

    // 创建选框
    this.selectionBox = document.createElement('div');
    this.selectionBox.id = 'area-screenshot-selection';
    this.selectionBox.style.cssText = `
      position: fixed;
      border: 2px solid #007AFF;
      background: rgba(0, 122, 255, 0.15);
      pointer-events: none;
      display: none;
      z-index: 1000000;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
    `;

    // 创建提示文字
    const hint = document.createElement('div');
    hint.id = 'area-screenshot-hint';
    hint.textContent = '拖拽选择截图区域，按 ESC 取消';
    hint.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 1000001;
      pointer-events: none;
    `;

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.selectionBox);
    document.body.appendChild(hint);

    // 绑定事件
    this.overlay.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
    const hint = document.getElementById('area-screenshot-hint');
    if (hint) hint.remove();

    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
  }

  onMouseDown(e) {
    if (e.button !== 0) return; // 只响应左键
    this.isSelecting = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.endX = e.clientX;
    this.endY = e.clientY;
    this.updateSelectionBox();
    this.selectionBox.style.display = 'block';
  }

  onMouseMove(e) {
    if (!this.isSelecting) return;
    this.endX = e.clientX;
    this.endY = e.clientY;
    this.updateSelectionBox();
  }

  onMouseUp(e) {
    if (!this.isSelecting) return;
    this.isSelecting = false;
    this.endX = e.clientX;
    this.endY = e.clientY;

    // 计算选区
    const left = Math.min(this.startX, this.endX);
    const top = Math.min(this.startY, this.endY);
    const width = Math.abs(this.endX - this.startX);
    const height = Math.abs(this.endY - this.startY);

    // 如果选区太小，认为是误操作，取消截图
    if (width < 10 || height < 10) {
      this.cancel();
      return;
    }

    // 执行截图
    this.captureArea(left, top, width, height);
  }

  onKeyDown(e) {
    if (e.key === 'Escape') {
      this.cancel();
    }
  }

  updateSelectionBox() {
    const left = Math.min(this.startX, this.endX);
    const top = Math.min(this.startY, this.endY);
    const width = Math.abs(this.endX - this.startX);
    const height = Math.abs(this.endY - this.startY);

    this.selectionBox.style.left = left + 'px';
    this.selectionBox.style.top = top + 'px';
    this.selectionBox.style.width = width + 'px';
    this.selectionBox.style.height = height + 'px';
  }

  async captureArea(x, y, width, height) {
    // 移除遮罩
    this.removeOverlay();

    try {
      // 截取整个可见区域
      const dataUrl = await window.screenshotCapture.captureVisibleTab();
      if (!dataUrl) {
        this.notifyComplete(false);
        return;
      }

      // 使用 canvas 裁剪选区
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // 裁剪指定区域
        ctx.drawImage(
          img,
          x, y, width, height,  // 源图像裁剪区域
          0, 0, width, height   // 目标 canvas 绘制区域
        );

        const croppedDataUrl = canvas.toDataURL('image/png');

        // 下载截图
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `area_screenshot_${timestamp}.png`;
        window.screenshotCapture.downloadImage(filename, croppedDataUrl);

        this.notifyComplete(true);
      };
      img.src = dataUrl;
    } catch (error) {
      console.error('[AreaScreenshot] Capture error:', error);
      this.notifyComplete(false);
    }
  }

  cancel() {
    this.removeOverlay();
    this.notifyComplete(false);
  }

  notifyComplete(success) {
    chrome.runtime.sendMessage({
      action: 'areaSelectionComplete',
      success: success
    });
  }

  start() {
    this.createOverlay();
  }
}

window.areaScreenshot = new AreaScreenshot();

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

    case 'startAreaSelection':
      window.areaScreenshot.start();
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