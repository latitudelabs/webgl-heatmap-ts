require("browser-env")();

let init = false;
/**
 * stub HTMLCanvasElement.getContext
 *
 * @param {"2d" | "webgl"} contextId
 * @param {CanvasRenderingContext2DSettings | WebGLRenderingContext} options
 *
 * @returns {CanvasRenderingContext2D | WebGLRenderingContext | null}
 */
HTMLCanvasElement.prototype.getContext = function () {
	if (init) return;
	init = true;
	return document.createElement("canvas").getContext.call(this, ...arguments);
};

// stub WebGLRenderingContext.getFloatExtension
import("@playcanvas/canvas-mock").then(({ WebGLRenderingContext }) => {
	WebGLRenderingContext.prototype.getFloatExtension = function () {
		return this.getExtension("OES_texture_float");
	};
});
