import type { SpecType, FloatExtensionProps } from "./types";
import checkSupport from "./utils/checkSupport";

export default function textureFloatShims() {
	// createSourceCanvas();
	if (window.WebGLRenderingContext == null) return;

	const supported = checkSupport();
	if (!supported) return;

	const { shimExtensions, unshimExtensions, shimLookup } = supported;

	const unshimLookup = unshimExtensions.reduce(
		(acc, cur) => ({ ...acc, [cur]: true }),
		{} as Record<string, any>
	);

	const getExtension = WebGLRenderingContext.prototype.getExtension;
	WebGLRenderingContext.prototype.getExtension = function (name) {
		const extobj = shimLookup[name];
		return extobj == null
			? unshimLookup[name]
				? null
				: getExtension.call(this, name)
			: extobj;
	};

	const getSupportedExtensions =
		WebGLRenderingContext.prototype.getSupportedExtensions;
	WebGLRenderingContext.prototype.getSupportedExtensions = function () {
		const supported = getSupportedExtensions.call(this);
		const result = [];
		if (supported) {
			for (const extension of supported) {
				if (unshimLookup[extension] == null) {
					result.push(extension);
				}
			}
			for (const extension of shimExtensions) {
				if (result.indexOf(extension) < 0) {
					result.push(extension);
				}
			}
		}

		return result;
	};

	return (window.WebGLRenderingContext.prototype.getFloatExtension = function (
		spec: SpecType
	) {
		if (spec.prefer == null) {
			spec.prefer = ["half"];
		}
		if (spec.require == null) {
			spec.require = [];
		}
		if (spec.throws == null) {
			spec.throws = true;
		}

		const singleTexture = this.getExtension("OES_texture_float");
		const halfTexture = this.getExtension("OES_texture_half_float");
		const singleFramebuffer = this.getExtension("WEBGL_color_buffer_float");
		const halfFramebuffer = this.getExtension("EXT_color_buffer_half_float");
		const singleLinear = this.getExtension("OES_texture_float_linear");
		const halfLinear = this.getExtension("OES_texture_half_float_linear");
		const single: FloatExtensionProps = {
			texture: singleTexture !== null,
			filterable: singleLinear !== null,
			renderable: singleFramebuffer !== null,
			score: 0,
			precision: "single",
			half: false,
			single: true,
			type: this.FLOAT,
		};
		let _ref;
		const half: FloatExtensionProps = {
			texture: halfTexture !== null,
			filterable: halfLinear !== null,
			renderable: halfFramebuffer !== null,
			score: 0,
			precision: "half",
			half: true,
			single: false,
			type:
				(_ref = halfTexture != null ? halfTexture.HALF_FLOAT_OES : void 0) !=
				null
					? _ref
					: null,
		};
		const candidates: Array<typeof single> = [];
		if (single.texture) {
			candidates.push(single);
		}
		if (half.texture) {
			candidates.push(half);
		}
		const result = [];

		for (const candidate of candidates) {
			let use = true;
			const _ref1: Array<keyof typeof single> = spec.require;

			for (const name of _ref1) {
				if (candidate[name] === false) {
					use = false;
				}
			}
			if (use) {
				result.push(candidate);
			}
		}

		for (const [j, candidate] of result.entries()) {
			const _ref2: Array<keyof typeof single> = spec.prefer;

			for (const [i, preference] of _ref2.entries()) {
				const importance = Math.pow(2, spec.prefer.length - i - 1);
				if (candidate[preference]) {
					candidate.score += importance;
					result[j] = candidate;
				}
			}
		}

		result.sort((a, b) =>
			a.score === b.score ? 0 : a.score < b.score ? 1 : -1
		);

		if (result.length) {
			const finalResult = result[0];
			return {
				filterable: finalResult.filterable,
				renderable: finalResult.renderable,
				type: finalResult.type,
				precision: finalResult.precision,
				score: finalResult.score,
			};
		}

		if (spec.throws) {
			throw (
				"No floating point texture support that is " + spec.require.join(", ")
			);
		}

		return null;
	});
}
