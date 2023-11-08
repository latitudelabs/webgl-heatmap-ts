export default class Shader {
	private program: WebGLProgram | null;
	private vs: WebGLShader | null;
	private fs: WebGLShader | null;
	private value_cache: Record<string, any>;
	private uniform_cache: Record<string, WebGLUniformLocation | null>;
	private attribCache: Record<string, number>;

	constructor(
		private gl: WebGLRenderingContext,
		options: { vertex: string; fragment: string }
	) {
		this.program = this.gl.createProgram();
		this.vs = this.gl.createShader(this.gl.VERTEX_SHADER);
		this.fs = this.gl.createShader(this.gl.FRAGMENT_SHADER);

		if (this.program) {
			if (this.vs) {
				this.gl.attachShader(this.program, this.vs);
				this.compileShader(this.vs, options.vertex);
			}

			if (this.fs) {
				this.gl.attachShader(this.program, this.fs);
				this.compileShader(this.fs, options.fragment);
			}
		}

		this.link();
		this.value_cache = {};
		this.uniform_cache = {};
		this.attribCache = {};
	}

	attribLocation(name: string) {
		let location = this.attribCache[name];
		if (this.program && typeof location === "undefined") {
			location = this.gl.getAttribLocation(this.program, name);
			this.attribCache[name] = location;
		}
		return location;
	}

	compileShader(shader: WebGLShader, source: string) {
		this.gl.shaderSource(shader, source);
		this.gl.compileShader(shader);
		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
			throw "Shader Compile Error: " + this.gl.getShaderInfoLog(shader);
		}
	}

	link() {
		if (!this.program) return;

		this.gl.linkProgram(this.program);
		if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
			throw "Shader Link Error: " + this.gl.getProgramInfoLog(this.program);
		}
	}

	use() {
		this.gl.useProgram(this.program);
		return this;
	}

	uniformLoc(name: string) {
		let location = this.uniform_cache[name];
		if (this.program && typeof location === "undefined") {
			location = this.gl.getUniformLocation(this.program, name);
			this.uniform_cache[name] = location;
		}
		return location;
	}

	int(name: string, value: number) {
		const cached = this.value_cache[name];
		if (cached !== value) {
			this.value_cache[name] = value;
			const loc = this.uniformLoc(name);
			if (loc) {
				this.gl.uniform1i(loc, value);
			}
		}
		return this;
	}

	vec2(name: string, a: number, b: number) {
		const loc = this.uniformLoc(name);
		if (loc) {
			this.gl.uniform2f(loc, a, b);
		}
		return this;
	}

	float(name: string, value: number) {
		const cached = this.value_cache[name];
		if (cached !== value) {
			this.value_cache[name] = value;
			const loc = this.uniformLoc(name);
			if (loc) {
				this.gl.uniform1f(loc, value);
			}
		}
		return this;
	}
}
