# 装修贴图资源规范

装修系统的逻辑占地与视觉贴图完全分离。`width`、`height` 只表示网格占地，不能使用图片像素尺寸参与边界或重叠判断。

## 文件要求

- 使用透明背景 PNG，每件家具一个独立文件。
- 文件名与 `spriteKey` 一致，建议放入 `assets/furniture/`。
- 地板、墙体、家具分别存放，不把整张网吧场景制作成单张大图。
- 同方向家具保持统一俯视角度、光源方向和设计网格。
- 阴影不要大幅超出图片边缘，像素素材不要使用模糊缩放。

## 配置方式

在 `furnitureCatalog` 对应家具的 `visual` 中配置：

```js
visual: {
  spriteKey: 'standard_pc_desk',
  spritePath: 'assets/furniture/standard_pc_desk.png',
  renderScale: 1,
  renderOffsetX: 0,
  renderOffsetY: 0,
  anchorX: 0.5,
  anchorY: 0.5,
  fallbackStyle: { body: '#5b3826', accent: '#2d91c7' }
}
```

图片允许在视觉上超出逻辑占地，可用 `renderScale` 和 `renderOffsetX/renderOffsetY` 调整。加载失败或没有配置图片时，渲染器自动使用 `fallbackStyle` 对应的 Canvas 几何造型。

## 渲染规则

- 图片由 `AssetManager` 统一创建和缓存，同一路径不重复创建 Image。
- `DecorationRenderer` 统一负责概览页和装修编辑器的贴图/占位绘制。
- 家具旋转围绕统一锚点进行。
- 像素贴图绘制时关闭平滑，并尽量使用整数绘制位置和整数缩放尺寸。
