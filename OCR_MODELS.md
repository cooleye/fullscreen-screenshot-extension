# OCR 模型下载说明

## 浏览器插件 (Tesseract.js)

### 自动下载（默认）

首次使用插件时，Tesseract.js 会自动从 CDN 下载所需的语言包：

- **中文语言包**: `chi_sim.traineddata` (~10MB)
- **英文语言包**: `eng.traineddata` (~4MB)
- **下载地址**: `https://tessdata.projectnaptha.com/`

下载过程会显示进度，只需等待一次，之后会自动缓存。

### 手动下载（可选）

如果自动下载失败或网络较慢，可以手动下载：

#### 方法1：直接下载语言包

```bash
# 创建语言包目录
mkdir -p traineddata

# 下载中文语言包
curl -L "https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata" \
  -o traineddata/chi_sim.traineddata

# 下载英文语言包
curl -L "https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata" \
  -o traineddata/eng.traineddata
```

#### 方法2：修改代码使用本地语言包

在 `content.js` 中修改初始化代码：

```javascript
this.ocrEngine = await Tesseract.createWorker('chi_sim+eng', 1, {
  langPath: chrome.runtime.getURL('traineddata'),  // 使用本地路径
  logger: m => console.log(m)
});
```

然后在 `manifest.json` 中添加：

```json
"web_accessible_resources": [
  {
    "resources": ["traineddata/*"],
    "matches": ["<all_urls>"]
  }
]
```

### 语言包缓存

Tesseract.js 会将下载的语言包缓存到：

**Chrome 浏览器**:
- IndexedDB: `tesseract.js`
- 存储位置：浏览器内部存储

**缓存有效期**:
- 默认长期有效
- 清除浏览器缓存会删除

## Python 工具 (PaddleOCR)

### 自动下载

首次运行时会自动下载模型到 `~/.paddleocr/` 目录：

```
~/.paddleocr/
├── whl/
│   ├── det/
│   │   └── ch_PP-OCRv4_det_infer/      # 检测模型 (~40MB)
│   ├── rec/
│   │   └── ch_PP-OCRv4_rec_infer/      # 识别模型 (~100MB)
│   └── cls/
│       └── ch_ppocr_mobile_v2.0_cls/   # 分类模型 (~10MB)
```

### 手动下载

如果自动下载失败，可以手动下载：

```bash
# 创建模型目录
mkdir -p ~/.paddleocr/whl/{det,rec,cls}

# 下载检测模型
curl -L "https://paddleocr.bj.bcebos.com/PP-OCRv4/chinese/ch_PP-OCRv4_det_infer.tar" \
  -o /tmp/ch_PP-OCRv4_det_infer.tar
tar -xf /tmp/ch_PP-OCRv4_det_infer.tar -C ~/.paddleocr/whl/det/

# 下载识别模型
curl -L "https://paddleocr.bj.bcebos.com/PP-OCRv4/chinese/ch_PP-OCRv4_rec_infer.tar" \
  -o /tmp/ch_PP-OCRv4_rec_infer.tar
tar -xf /tmp/ch_PP-OCRv4_rec_infer.tar -C ~/.paddleocr/whl/rec/

# 下载分类模型
curl -L "https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar" \
  -o /tmp/ch_ppocr_mobile_v2.0_cls_infer.tar
tar -xf /tmp/ch_ppocr_mobile_v2.0_cls_infer.tar -C ~/.paddleocr/whl/cls/
```

### 模型版本

PaddleOCR 支持多种模型版本：

| 版本 | 检测模型 | 识别模型 | 特点 |
|------|----------|----------|------|
| PP-OCRv4 | ch_PP-OCRv4_det | ch_PP-OCRv4_rec | 最新版，精度高 |
| PP-OCRv3 | ch_PP-OCRv3_det | ch_PP-OCRv3_rec | 平衡版 |
| PP-OCRv2 | ch_ppocr_mobile | ch_ppocr_mobile | 轻量版 |

## 网络问题解决方案

### 国内镜像

如果下载速度慢，可以使用国内镜像：

**PaddleOCR 模型镜像**:
```python
# 在代码中设置镜像
import os
os.environ['PADDLE_OCR_BASE_URL'] = 'https://paddleocr.bj.bcebos.com/'
```

**Tesseract 语言包镜像**:
```javascript
// 在 content.js 中修改 langPath
langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim/4.0.0/'
```

### 离线使用

1. 在有网络的环境下首次运行，让模型自动下载
2. 复制模型文件到离线机器
3. 配置使用本地模型路径

## 常见问题

### Q: 下载速度慢？
A: 
- 使用国内镜像
- 检查网络连接
- 使用代理

### Q: 下载失败？
A:
- 检查磁盘空间（至少 200MB）
- 检查网络权限
- 尝试手动下载

### Q: 如何更新模型？
A:
- 删除旧模型目录
- 重新运行程序会自动下载最新版

### Q: 可以只下载需要的语言吗？
A:
- Tesseract: 可以，只下载 `chi_sim.traineddata`
- PaddleOCR: 中文模型已包含常用字符
