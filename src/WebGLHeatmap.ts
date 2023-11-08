import Shader from "./Shader";
import Heights from "./Heights";
import Texture from "./Texture";
import { fragmentShaderBlit, vertexShaderBlit } from "./constants";
import { HeatPoint, WebGLHeatmapOptions } from "./types";
export default class WebGLHeatmap {
	public width: number;
	public height: number;
	private canvas: HTMLCanvasElement;
	private gl: WebGLRenderingContext | null;
	private shader: Shader;
	private quad: WebGLBuffer | null;
	private heights: Heights;
	private gradientTexture: Texture | undefined;

	constructor(options: WebGLHeatmapOptions = {}) {
		let alphaEnd,
			alphaRange,
			alphaStart,
			error,
			getColorFun,
			image: HTMLImageElement | HTMLCanvasElement,
			intensityToAlpha,
			output,
			quad,
			textureGradient: Texture | null;

		this.canvas = options.canvas || document.createElement("canvas");
		this.width = options.width || this.canvas.offsetWidth || 2;
		this.height = options.height || this.canvas.offsetHeight || 2;
		intensityToAlpha = options.intensityToAlpha;
		const gradientTexture = options.gradientTexture as string | TexImageSource;
		alphaRange = options.alphaRange;

		try {
			this.gl = this.canvas.getContext("webgl", {
				depth: false,
				antialias: false,
				preserveDrawingBuffer: true,
			});
		} catch (_error) {
			error = _error;
			throw "WebGL not supported";
		}

		if ("WebGLDebugUtils" in window && window.WebGLDebugUtils != null) {
			try {
				console.log("debugging mode");
				this.gl = window.WebGLDebugUtils.makeDebugContext(
					this.gl,
					(err: any, funcName: string) => {
						throw (
							window.WebGLDebugUtils.glEnumToString(err) +
							" was caused by call to: " +
							funcName
						);
					}
				);
			} catch (_error) {
				error = _error;
				throw "WebGL not supported";
			}
		}

		if (this.gl == null) {
			throw "WebGL not supported";
		}

		this.gl.enableVertexAttribArray(0);
		this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
		if (gradientTexture) {
			textureGradient = this.gradientTexture = new Texture(this.gl, {
				channels: "rgba",
			})
				.bind(0)
				.setSize(2, 2)
				.nearest()
				.clampToEdge();

			if (
				gradientTexture instanceof HTMLImageElement ||
				gradientTexture instanceof HTMLCanvasElement
			) {
				if (gradientTexture.width > 0 && gradientTexture.height > 0) {
					textureGradient.upload(gradientTexture);
				} else {
					gradientTexture.onload = () => {
						return textureGradient!.upload(gradientTexture);
					};
				}
			} else if (typeof gradientTexture === "string") {
				image = new Image();
				image.onload = function () {
					return textureGradient!.bind(0).upload(image);
				};
				image.src = gradientTexture;
			}

			getColorFun =
				"uniform sampler2D gradientTexture;\nvec3 getColor(float intensity){\n    return texture2D(gradientTexture, vec2(intensity, 0.0)).rgb;\n}";
		} else {
			textureGradient = null;
			getColorFun =
				"vec3 getColor(float intensity){\n    vec3 blue = vec3(0.0, 0.0, 1.0);\n    vec3 cyan = vec3(0.0, 1.0, 1.0);\n    vec3 green = vec3(0.0, 1.0, 0.0);\n    vec3 yellow = vec3(1.0, 1.0, 0.0);\n    vec3 red = vec3(1.0, 0.0, 0.0);\n\n    vec3 color = (\n        fade(-0.25, 0.25, intensity)*blue +\n        fade(0.0, 0.5, intensity)*cyan +\n        fade(0.25, 0.75, intensity)*green +\n        fade(0.5, 1.0, intensity)*yellow +\n        smoothstep(0.75, 1.0, intensity)*red\n    );\n    return color;\n}";
		}
		if (intensityToAlpha == null) {
			intensityToAlpha = true;
		}
		if (intensityToAlpha) {
			const ref1 = alphaRange ?? [0, 1];
			alphaStart = ref1[0];
			alphaEnd = ref1[1];

			output =
				"vec4 alphaFun(vec3 color, float intensity){\n    float alpha = smoothstep(" +
				alphaStart.toFixed(8) +
				", " +
				alphaEnd.toFixed(8) +
				", intensity);\n    return vec4(color*alpha, alpha);\n}";
		} else {
			output =
				"vec4 alphaFun(vec3 color, float intensity){\n    return vec4(color, 1.0);\n}";
		}
		this.shader = new Shader(this.gl, {
			vertex: vertexShaderBlit,
			fragment:
				fragmentShaderBlit +
				("float linstep(float low, float high, float value){\n    return clamp((value-low)/(high-low), 0.0, 1.0);\n}\n\nfloat fade(float low, float high, float value){\n    float mid = (low+high)*0.5;\n    float range = (high-low)*0.5;\n    float x = 1.0 - clamp(abs(mid-value)/range, 0.0, 1.0);\n    return smoothstep(0.0, 1.0, x);\n}\n\n" +
					getColorFun +
					"\n" +
					output +
					"\n\nvoid main(){\n    float intensity = smoothstep(0.0, 1.0, texture2D(source, texcoord).r);\n    vec3 color = getColor(intensity);\n    gl_FragColor = alphaFun(color, intensity);\n}"),
		});
		this.canvas.width = this.width;
		this.canvas.height = this.height;

		this.gl.viewport(0, 0, this.width, this.height);
		this.quad = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quad);
		quad = new Float32Array([
			-1, -1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, 1, 0, 1, 1, -1, 0, 1, 1, 1, 0,
			1,
		]);

		this.gl.bufferData(this.gl.ARRAY_BUFFER, quad, this.gl.STATIC_DRAW);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
		this.heights = new Heights(this, this.gl, this.width, this.height);
	}

	adjustSize() {
		const canvasWidth = this.canvas.offsetWidth || 2;
		const canvasHeight = this.canvas.offsetHeight || 2;
		if (
			this.gl &&
			(this.width !== canvasWidth || this.height !== canvasHeight)
		) {
			this.gl.viewport(0, 0, canvasWidth, canvasHeight);
			this.canvas.width = canvasWidth;
			this.canvas.height = canvasHeight;
			this.width = canvasWidth;
			this.height = canvasHeight;
			return this.heights.resize(this.width, this.height);
		}
	}

	display() {
		if (this.gl === null) return;

		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quad);
		this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 0, 0);
		this.heights.nodeFront.bind(0);
		if (this.gradientTexture) {
			this.gradientTexture.bind(1);
		}
		this.shader.use().int("source", 0).int("gradientTexture", 1);
		return this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
	}

	update() {
		return this.heights.update();
	}

	clear() {
		return this.heights.clear();
	}

	clamp(min: number | null, max: number | null) {
		if (min == null) min = 0;
		if (max == null) max = 1;
		return this.heights.clamp(min, max);
	}

	multiply(value: number | null) {
		if (value == null) value = 0.95;
		return this.heights.multiply(value);
	}

	blur() {
		return this.heights.blur();
	}

	addPoint(
		x: number,
		y: number,
		size: number | null,
		intensity: number | null = null
	) {
		return this.heights.addPoint(x, y, size, intensity);
	}

	addPoints(items: HeatPoint[]) {
		const results = [];
		for (const item of items) {
			const result = this.addPoint(item.x, item.y, item.size, item.intensity);
			results.push(result);
		}
		return results;
	}
}
