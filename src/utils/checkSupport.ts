import checkFloatLinear from "./checkFloatLinear";
import checkTexture from "./checkTexture";
import checkColorBuffer from "./checkColorBuffer";

export default function checkSupport() {
	const shimExtensions: string[] = [];
	const shimLookup: Record<string, any> = {};
	const unshimExtensions: string[] = [];

	let extobj: WEBGL_color_buffer_float | OES_texture_float_linear | null;
	const canvas = document.createElement("canvas");
	let gl: WebGLRenderingContext | null = null;

	try {
		// check support for webgl
		gl = canvas.getContext("webgl");
	} catch (_e) {}

	if (gl == null) {
		console.debug("WebGL not supported");
		return;
	}

	let singleFloatTexturing;
	const singleFloatExt = gl.getExtension("OES_texture_float");
	if (checkTexture(gl, gl.FLOAT)) {
		singleFloatTexturing = true;
		shimExtensions.push("OES_texture_float");
		if (singleFloatExt === null) {
			shimLookup["OES_texture_float"] = { shim: true };
		}
	} else {
		singleFloatTexturing = false;
		unshimExtensions.push("OES_texture_float");
	}

	if (singleFloatTexturing) {
		// 1. check color buffer support
		extobj = gl.getExtension("WEBGL_color_buffer_float");
		const colorBufferFloat = checkColorBuffer(gl, gl.FLOAT);

		if (extobj === null && colorBufferFloat) {
			shimLookup.WEBGL_color_buffer_float = {
				shim: true,
				RGBA32F_EXT: 0x8814,
				RGB32F_EXT: 0x8815,
				FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE_EXT: 0x8211,
				UNSIGNED_NORMALIZED_EXT: 0x8c17,
			};
		}

		if (colorBufferFloat) {
			shimExtensions.push("WEBGL_color_buffer_float");
		} else {
			unshimExtensions.push("WEBGL_color_buffer_float");
		}

		// 2. check float linear filtering
		extobj = gl.getExtension("OES_texture_float_linear");
		const floatLinear = checkFloatLinear(gl, gl.FLOAT);

		if (extobj === null && floatLinear) {
			shimLookup["OES_texture_float_linear"] = { shim: true };
		}

		if (floatLinear) {
			shimExtensions.push("OES_texture_float_linear");
		} else {
			unshimExtensions.push("OES_texture_float_linear");
		}
	}

	let halfFloatExt = gl.getExtension("OES_texture_half_float");
	let halfFloatTexturing;
	if (halfFloatExt === null) {
		if (checkTexture(gl, 0x8d61)) {
			halfFloatTexturing = true;
			shimExtensions.push("OES_texture_half_float");
			shimLookup["OES_texture_half_float"] = {
				HALF_FLOAT_OES: 0x8d61,
				shim: true,
			};
			halfFloatExt = {
				HALF_FLOAT_OES: 0x8d61,
			};
		} else {
			halfFloatTexturing = false;
			unshimExtensions.push("OES_texture_half_float");
		}
	} else {
		if (checkTexture(gl, halfFloatExt.HALF_FLOAT_OES)) {
			halfFloatTexturing = true;
			shimExtensions.push("OES_texture_half_float");
		} else {
			halfFloatTexturing = false;
			unshimExtensions.push("OES_texture_half_float");
		}
	}

	if (halfFloatTexturing && halfFloatExt) {
		extobj = gl.getExtension("EXT_color_buffer_half_float");
		const colorBufferHalfFloat = checkColorBuffer(
			gl,
			halfFloatExt.HALF_FLOAT_OES,
		);

		if (extobj === null && colorBufferHalfFloat) {
			shimLookup["EXT_color_buffer_half_float"] = {
				shim: true,
				RGBA16F_EXT: 0x881a,
				RGB16F_EXT: 0x881b,
				FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE_EXT: 0x8211,
				UNSIGNED_NORMALIZED_EXT: 0x8c17,
			};
		}

		if (colorBufferHalfFloat) {
			shimExtensions.push("EXT_color_buffer_half_float");
		} else {
			unshimExtensions.push("EXT_color_buffer_half_float");
		}

		//----
		extobj = gl.getExtension("OES_texture_half_float_linear");
		const floatLinearHalfFloat = checkFloatLinear(
			gl,
			halfFloatExt.HALF_FLOAT_OES,
		);

		if (extobj === null && floatLinearHalfFloat) {
			shimLookup.OES_texture_half_float_linear = {
				shim: true,
			};
		}

		if (floatLinearHalfFloat) {
			shimExtensions.push("OES_texture_half_float_linear");
		} else {
			unshimExtensions.push("OES_texture_half_float_linear");
		}
	}

	return { shimExtensions, unshimExtensions, shimLookup };
}
