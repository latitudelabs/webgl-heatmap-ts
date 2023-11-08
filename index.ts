import nukeVendorPrefix from "./src/nukeVendorPrefix";
import textureFloatShims from "./src/textureFloatShims";
import WebGLHeatmap from "./src/WebGLHeatmap";
import type { WebGLHeatmapOptions } from "./src/types";

export default function createWebGLHeatmap(options: WebGLHeatmapOptions) {
	nukeVendorPrefix();
	textureFloatShims();
	return new WebGLHeatmap(options);
}

if (typeof window !== "undefined") {
	window.createWebGLHeatmap = createWebGLHeatmap;
}
export type CreateWebGLHeatmap = typeof createWebGLHeatmap;
export { type WebGLHeatmap };
