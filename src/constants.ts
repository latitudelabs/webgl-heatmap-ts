export const vertexShaderBlit =
	"attribute vec4 position;\nvarying vec2 texcoord;\nvoid main(){\n    texcoord = position.xy*0.5+0.5;\n    gl_Position = position;\n}";

export const fragmentShaderBlit =
	"#ifdef GL_FRAGMENT_PRECISION_HIGH\n    precision highp int;\n    precision highp float;\n#else\n    precision mediump int;\n    precision mediump float;\n#endif\nuniform sampler2D source;\nvarying vec2 texcoord;";
