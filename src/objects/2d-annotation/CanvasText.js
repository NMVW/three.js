import { _Math as Math3 } from '../../math/Math.js';

import { TextOptions } from "./Text2D";
import { getFontHeight } from "./utils";

export class CanvasText {

  constructor() {
    this.textWidth = null;
    this.textHeight = null;

    this.canvas = document.createElement('canvas'); // HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d'); // CanvasRenderingContext2D
  }

  get width() {
    return this.canvas.width;
  }
  get height() {
    return this.canvas.height;
  }

  drawText(text, ctxOptions) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.font = ctxOptions.font;

    this.textWidth = Math.ceil(this.ctx.measureText(text).width);
    this.textHeight = getFontHeight(this.ctx.font);

    this.canvas.width = Math3.ceilPowerOfTwo(this.textWidth);
    this.canvas.height = Math3.ceilPowerOfTwo(this.textHeight);

    this.ctx.font = ctxOptions.font;
    this.ctx.fillStyle = ctxOptions.fillStyle;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.shadowColor = ctxOptions.shadowColor;
    this.ctx.shadowBlur = ctxOptions.shadowBlur;
    this.ctx.shadowOffsetX = ctxOptions.shadowOffsetX;
    this.ctx.shadowOffsetY = ctxOptions.shadowOffsetY;
    this.ctx.fillText(text, 0, 0);

    return this.canvas;
  }
}
