import Texture from "./Texture";

export default class Framebuffer {
	private buffer: WebGLFramebuffer | null;

	constructor(private gl: WebGLRenderingContext) {
		this.buffer = this.gl.createFramebuffer();
	}

	bind() {
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.buffer);
		return this;
	}

	unbind() {
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
		return this;
	}

	check() {
		const result = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
		switch (result) {
			case this.gl.FRAMEBUFFER_UNSUPPORTED:
				throw "Framebuffer is unsupported";
			case this.gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
				throw "Framebuffer incomplete attachment";
			case this.gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
				throw "Framebuffer incomplete dimensions";
			case this.gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
				throw "Framebuffer incomplete missing attachment";
		}
		return this;
	}

	color(texture: Texture) {
		this.gl.framebufferTexture2D(
			this.gl.FRAMEBUFFER,
			this.gl.COLOR_ATTACHMENT0,
			texture.target,
			texture.handle,
			0
		);
		this.check();
		return this;
	}

	depth(buffer: { id: WebGLRenderbuffer }) {
		this.gl.framebufferRenderbuffer(
			this.gl.FRAMEBUFFER,
			this.gl.DEPTH_ATTACHMENT,
			this.gl.RENDERBUFFER,
			buffer.id
		);
		this.check();
		return this;
	}

	destroy() {
		return this.gl.deleteFramebuffer(this.buffer);
	}
}
