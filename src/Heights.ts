import Shader from "./Shader";
import Node from "./Node";
import { fragmentShaderBlit, vertexShaderBlit } from "./constants";

export default class Heights {
	private shader: Shader;
	private clampShader: Shader;
	private multiplyShader: Shader;
	private blurShader: Shader;
	public nodeBack: Node;
	public nodeFront: Node;
	private vertexBuffer: WebGLBuffer | null;
	private vertexSize: number;
	private maxPointCount: number;
	private vertexBufferData: Float32Array;
	private vertexBufferViews: Float32Array[];
	private bufferIndex: number;
	private pointCount: number;

	constructor(
		private heatmap: any,
		private gl: WebGLRenderingContext,
		private width: number,
		private height: number
	) {
		this.shader = new Shader(this.gl, {
			vertex:
				"attribute vec4 position, intensity;\nvarying vec2 off, dim;\nvarying float vIntensity;\nuniform vec2 viewport;\n\nvoid main(){\n    dim = abs(position.zw);\n    off = position.zw;\n    vec2 pos = position.xy + position.zw;\n    vIntensity = intensity.x;\n    gl_Position = vec4((pos/viewport)*2.0-1.0, 0.0, 1.0);\n}",
			fragment:
				"#ifdef GL_FRAGMENT_PRECISION_HIGH\n    precision highp int;\n    precision highp float;\n#else\n    precision mediump int;\n    precision mediump float;\n#endif\nvarying vec2 off, dim;\nvarying float vIntensity;\nvoid main(){\n    float falloff = (1.0 - smoothstep(0.0, 1.0, length(off/dim)));\n    float intensity = falloff*vIntensity;\n    gl_FragColor = vec4(intensity);\n}",
		});
		this.clampShader = new Shader(this.gl, {
			vertex: vertexShaderBlit,
			fragment:
				fragmentShaderBlit +
				"uniform float low, high;\nvoid main(){\n    gl_FragColor = vec4(clamp(texture2D(source, texcoord).rgb, low, high), 1.0);\n}",
		});
		this.multiplyShader = new Shader(this.gl, {
			vertex: vertexShaderBlit,
			fragment:
				fragmentShaderBlit +
				"uniform float value;\nvoid main(){\n    gl_FragColor = vec4(texture2D(source, texcoord).rgb*value, 1.0);\n}",
		});
		this.blurShader = new Shader(this.gl, {
			vertex: vertexShaderBlit,
			fragment:
				fragmentShaderBlit +
				"uniform vec2 viewport;\nvoid main(){\n    vec4 result = vec4(0.0);\n    for(int x=-1; x<=1; x++){\n        for(int y=-1; y<=1; y++){\n            vec2 off = vec2(x,y)/viewport;\n            //float factor = 1.0 - smoothstep(0.0, 1.5, length(off));\n            float factor = 1.0;\n            result += vec4(texture2D(source, texcoord+off).rgb*factor, factor);\n        }\n    }\n    gl_FragColor = vec4(result.rgb/result.w, 1.0);\n}",
		});
		this.nodeBack = new Node(this.gl, this.width, this.height);
		this.nodeFront = new Node(this.gl, this.width, this.height);
		this.vertexBuffer = this.gl.createBuffer();
		this.vertexSize = 8;
		this.maxPointCount = 1024 * 10;
		this.vertexBufferData = new Float32Array(
			this.maxPointCount * this.vertexSize * 6
		);
		this.vertexBufferViews = [];
		let _i = 0;
		let _ref = this.maxPointCount;

		for (
			let i = _i;
			_ref >= 0 ? _i < _ref : _i > _ref;
			i = _ref >= 0 ? ++_i : --_i
		) {
			this.vertexBufferViews.push(
				new Float32Array(
					this.vertexBufferData.buffer,
					0,
					i * this.vertexSize * 6
				)
			);
		}
		this.bufferIndex = 0;
		this.pointCount = 0;
	}

	resize(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.nodeBack.resize(this.width, this.height);
		return this.nodeFront.resize(this.width, this.height);
	}

	update() {
		if (this.pointCount <= 0) return;

		this.gl.enable(this.gl.BLEND);
		this.nodeFront.use();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			this.vertexBufferViews[this.pointCount],
			this.gl.STREAM_DRAW
		);
		const positionLoc = this.shader.attribLocation("position");
		const intensityLoc = this.shader.attribLocation("intensity");
		this.gl.enableVertexAttribArray(1);
		this.gl.vertexAttribPointer(
			positionLoc,
			4,
			this.gl.FLOAT,
			false,
			8 * 4,
			0 * 4
		);
		this.gl.vertexAttribPointer(
			intensityLoc,
			4,
			this.gl.FLOAT,
			false,
			8 * 4,
			4 * 4
		);

		this.shader.use().vec2("viewport", this.width, this.height);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, this.pointCount * 6);
		this.gl.disableVertexAttribArray(1);
		this.pointCount = 0;
		this.bufferIndex = 0;
		this.nodeFront.end();

		return this.gl.disable(this.gl.BLEND);
	}

	clear() {
		this.nodeFront.use();
		this.gl.clearColor(0, 0, 0, 1);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		return this.nodeFront.end();
	}

	clamp(min: number, max: number) {
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.heatmap.quad);
		this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 0, 0);
		this.nodeFront.bind(0);
		this.nodeBack.use();
		this.clampShader
			.use()
			.int("source", 0)
			.float("low", min)
			.float("high", max);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
		this.nodeBack.end();

		return this.swap();
	}

	multiply(value: number) {
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.heatmap.quad);
		this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 0, 0);
		this.nodeFront.bind(0);
		this.nodeBack.use();
		this.multiplyShader.use().int("source", 0).float("value", value);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
		this.nodeBack.end();

		return this.swap();
	}

	blur() {
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.heatmap.quad);
		this.gl.vertexAttribPointer(0, 4, this.gl.FLOAT, false, 0, 0);
		this.nodeFront.bind(0);
		this.nodeBack.use();
		this.blurShader
			.use()
			.int("source", 0)
			.vec2("viewport", this.width, this.height);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
		this.nodeBack.end();

		return this.swap();
	}

	swap() {
		const tmp = this.nodeFront;
		this.nodeFront = this.nodeBack;
		return (this.nodeBack = tmp);
	}

	addVertex(x: number, y: number, xs: number, ys: number, intensity: number) {
		this.vertexBufferData[this.bufferIndex++] = x;
		this.vertexBufferData[this.bufferIndex++] = y;
		this.vertexBufferData[this.bufferIndex++] = xs;
		this.vertexBufferData[this.bufferIndex++] = ys;
		this.vertexBufferData[this.bufferIndex++] = intensity;
		this.vertexBufferData[this.bufferIndex++] = intensity;
		this.vertexBufferData[this.bufferIndex++] = intensity;

		return (this.vertexBufferData[this.bufferIndex++] = intensity);
	}

	addPoint(
		x: number,
		y: number,
		size: number | null,
		intensity: number | null
	) {
		if (size == null) {
			size = 50;
		}
		if (intensity == null) {
			intensity = 0.2;
		}
		if (this.pointCount >= this.maxPointCount - 1) {
			this.update();
		}
		y = this.height - y;
		const s = size / 2;
		this.addVertex(x, y, -s, -s, intensity);
		this.addVertex(x, y, +s, -s, intensity);
		this.addVertex(x, y, -s, +s, intensity);
		this.addVertex(x, y, -s, +s, intensity);
		this.addVertex(x, y, +s, -s, intensity);
		this.addVertex(x, y, +s, +s, intensity);
		return (this.pointCount += 1);
	}
}
