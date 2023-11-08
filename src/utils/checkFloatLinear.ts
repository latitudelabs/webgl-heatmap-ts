import createSourceCanvas from "./createSourceCanvas";

export default function checkFloatLinear(
	gl: WebGLRenderingContext,
	sourceType: number
) {
	const program = gl.createProgram();
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);

	if (!program || !vertexShader) return false;

	gl.attachShader(program, vertexShader);
	gl.shaderSource(
		vertexShader,
		"attribute vec2 position;\nvoid main(){\n    gl_Position = vec4(position, 0.0, 1.0);\n}"
	);

	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		throw gl.getShaderInfoLog(vertexShader);
	}

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

	if (fragmentShader) {
		gl.attachShader(program, fragmentShader);

		gl.shaderSource(
			fragmentShader,
			"uniform sampler2D source;\nvoid main(){\n    gl_FragColor = texture2D(source, vec2(1.0, 1.0));\n}"
		);
		gl.compileShader(fragmentShader);
		if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
			throw gl.getShaderInfoLog(fragmentShader);
		}
	}

	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw gl.getProgramInfoLog(program);
	}
	gl.useProgram(program);

	const target = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, target);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		2,
		2,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		null
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	const framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		target,
		0
	);

	const sourceCanvas = createSourceCanvas();
	const source = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, source);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, sourceType, sourceCanvas);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	const vertices = new Float32Array([1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1]);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

	const positionLoc = gl.getAttribLocation(program, "position");
	const sourceLoc = gl.getUniformLocation(program, "source");
	gl.enableVertexAttribArray(positionLoc);
	gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
	gl.uniform1i(sourceLoc, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	const readBuffer = new Uint8Array(4 * 4);
	gl.readPixels(0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, readBuffer);
	const result = Math.abs(readBuffer[0] - 127) < 10;

	// cleanup
	gl.deleteShader(fragmentShader);
	gl.deleteShader(vertexShader);
	gl.deleteProgram(program);
	gl.deleteBuffer(buffer);
	gl.deleteTexture(source);
	gl.deleteTexture(target);
	gl.deleteFramebuffer(framebuffer);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.useProgram(null);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return result;
}
