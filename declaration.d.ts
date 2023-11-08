import type { SpecType, FloatExtensionProps } from "./src/types";
import type { CreateWebGLHeatmap } from "./index";

declare global {
	interface WebGLRenderingContext {
		getFloatExtension(spec: SpecType): FloatExtensionProps | null;
	}
	interface Window {
		WebGLDebugUtils: any;
		createWebGLHeatmap: CreateWebGLHeatmap;
	}
}
