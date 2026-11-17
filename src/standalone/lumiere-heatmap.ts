import createWebGLHeatmap, { type WebGLHeatmap } from "../../index";

// Rendering constants mirror Lumiere Studio's heatmap overlay
// (StudioVideoHeatmap.svelte in lumiere-v4). Change them in both places.

// Point footprint as a fraction of the surface's larger dimension, so a click
// covers the same portion of the frame at any size.
const POINT_SIZE_FRACTION = 0.16;
const INTENSITY = 0.82;

// Accumulated intensity at which a cluster reads as fully hot; the static
// heatmap normalizes its densest cluster to this ceiling.
const SATURATION_INTENSITY = 3;
const STATIC_GRID = 10;

// Decay and blur rates are expressed against this interval.
const BUCKET_INTERVAL = 0.25;
const DECAY_PER_BUCKET = 0.85;
const MAX_BLUR_PASSES_PER_FRAME = 4;

const SIM_FPS = 30;
const MIN_FRAME_INTERVAL_MS = 1000 / SIM_FPS - 1000 / (SIM_FPS * 4);

// A jump larger than this is a seek: the trail is rebuilt at the destination.
const SEEK_DELTA = 0.5;

const TRAIL_FLOOR = 0.05;
const TRAIL_WINDOW =
	BUCKET_INTERVAL * (Math.log(TRAIL_FLOOR) / Math.log(DECAY_PER_BUCKET));

const OVERLAY_OPACITY = 0.5;

export type HeatmapPoint = { x: number; y: number; t: number };

type RawPoint = {
	x?: number;
	y?: number;
	t?: number;
	position?: { x: number; y: number };
	submittedAt?: number;
};

type RawBuckets = Record<string, { feedbackItems?: RawPoint[] }>;

export type HeatmapInput = RawPoint[] | RawBuckets | null | undefined;

// Accepts plain points ({ x, y, t }), Lumiere feedback items
// ({ position: { x, y }, submittedAt }) or a Lumiere heatmap bucket map.
function normalizePoints(input: HeatmapInput): HeatmapPoint[] {
	if (!input) return [];
	let items: RawPoint[] = [];
	if (Array.isArray(input)) {
		items = input;
	} else {
		for (const key in input) {
			items = items.concat(input[key]?.feedbackItems ?? []);
		}
	}

	const points: HeatmapPoint[] = [];
	for (const item of items) {
		const x = Number(item?.position?.x ?? item?.x);
		const y = Number(item?.position?.y ?? item?.y);
		const t = Number(item?.submittedAt ?? item?.t ?? 0);
		if (Number.isFinite(x) && Number.isFinite(y)) {
			points.push({ x, y, t: Number.isFinite(t) ? t : 0 });
		}
	}
	return points.sort((a, b) => a.t - b.t);
}

function pointSize(width: number, height: number) {
	return Math.max(width, height) * POINT_SIZE_FRACTION;
}

function staticPointIntensity(points: HeatmapPoint[]) {
	const counts = new Map<number, number>();
	let maxCluster = 1;
	for (const { x, y } of points) {
		const col = Math.min(STATIC_GRID - 1, Math.floor(x * STATIC_GRID));
		const row = Math.min(STATIC_GRID - 1, Math.floor(y * STATIC_GRID));
		const key = col * STATIC_GRID + row;
		const count = (counts.get(key) ?? 0) + 1;
		counts.set(key, count);
		if (count > maxCluster) maxCluster = count;
	}
	return Math.min(INTENSITY, SATURATION_INTENSITY / maxCluster);
}

/** First index at or after `time` in a `t`-sorted array. */
function indexAtTime(points: HeatmapPoint[], time: number) {
	let low = 0;
	let high = points.length;
	while (low < high) {
		const mid = (low + high) >> 1;
		if (points[mid].t < time) low = mid + 1;
		else high = mid;
	}
	return low;
}

const TEMPLATE = `<style>
:host { position: absolute; inset: 0; display: block; pointer-events: none; }
:host([hidden]) { display: none; }
canvas { display: block; width: 100%; height: 100%; opacity: ${OVERLAY_OPACITY}; }
</style><canvas part="canvas"></canvas>`;

export class LumiereHeatmap extends HTMLElement {
	static observedAttributes = ["for", "mode"];

	#canvas: HTMLCanvasElement;
	#heatmap: WebGLHeatmap | null = null;
	#failed = false;
	#observer: ResizeObserver | null = null;
	#frame = 0;

	#points: HeatmapPoint[] = [];
	#pointsSet = false;
	#video: HTMLMediaElement | null = null;
	#manualTime: number | null = null;

	#simTime = 0;
	#cursor = 0;
	#blurDebt = 0;
	#lastFrameMs = -Infinity;

	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = TEMPLATE;
		this.#canvas = root.querySelector("canvas")!;
	}

	/** Clicks to draw. See `HeatmapInput` for the accepted shapes. */
	get points(): HeatmapPoint[] {
		return this.#points;
	}
	set points(value: HeatmapInput) {
		this.#points = normalizePoints(value);
		this.#pointsSet = true;
		this.#rebuild();
	}

	/** Media element whose playhead drives the animated heatmap. */
	get video(): HTMLMediaElement | null {
		return this.#video;
	}
	set video(value: HTMLMediaElement | null) {
		this.#video = value;
		this.#restart();
	}

	/** Playhead in seconds, for an animated heatmap with no media element. */
	get currentTime(): number {
		return this.#time();
	}
	set currentTime(value: number) {
		const wasTimeline = this.#isTimeline();
		this.#manualTime = Number(value) || 0;
		if (!wasTimeline) this.#restart();
	}

	connectedCallback() {
		if (!this.#pointsSet) {
			this.#readInlinePoints();
			if (!this.#pointsSet && document.readyState === "loading") {
				document.addEventListener(
					"DOMContentLoaded",
					() => {
						if (!this.#pointsSet) this.#readInlinePoints();
					},
					{ once: true },
				);
			}
		}

		this.#observer = new ResizeObserver(() => this.#syncSize());
		this.#observer.observe(this.#canvas);
		this.#syncSize();
		this.#restart();
	}

	disconnectedCallback() {
		this.#observer?.disconnect();
		this.#observer = null;
		cancelAnimationFrame(this.#frame);
		this.#destroy();
		this.#failed = false;
	}

	attributeChangedCallback() {
		if (this.isConnected) this.#restart();
	}

	#readInlinePoints() {
		const script = this.querySelector('script[type="application/json"]');
		if (!script?.textContent?.trim()) return;
		try {
			this.points = JSON.parse(script.textContent);
		} catch (error) {
			this.#report(error);
		}
	}

	#mediaElement(): HTMLMediaElement | null {
		if (this.#video) return this.#video;
		const id = this.getAttribute("for");
		if (!id) return null;
		const root = this.getRootNode() as Document | ShadowRoot;
		const element = root.getElementById?.(id) ?? document.getElementById(id);
		return element instanceof HTMLMediaElement ? element : null;
	}

	#isTimeline() {
		const mode = this.getAttribute("mode");
		if (mode) return mode === "timeline";
		return (
			this.#video != null ||
			this.hasAttribute("for") ||
			this.#manualTime != null
		);
	}

	#time() {
		return this.#mediaElement()?.currentTime ?? this.#manualTime ?? 0;
	}

	// The library reads the canvas box at construction and falls back to a 2x2
	// framebuffer when it has not been laid out, so creation waits for a real box.
	#syncSize() {
		const { offsetWidth: width, offsetHeight: height } = this.#canvas;
		if (width <= 0 || height <= 0 || this.#failed) return;

		if (!this.#heatmap) {
			try {
				const heatmap = createWebGLHeatmap({
					canvas: this.#canvas,
					intensityToAlpha: true,
				});
				heatmap.addPoint(0, 0, 0);
				heatmap.update();
				heatmap.display();
				heatmap.blur();
				this.#heatmap = heatmap;
			} catch (error) {
				this.#failed = true;
				this.#report(error);
				return;
			}
		} else if (
			this.#heatmap.width !== width ||
			this.#heatmap.height !== height
		) {
			// Resizing reallocates the textures and discards the accumulated heat.
			this.#draw(() => this.#heatmap!.adjustSize());
		} else {
			return;
		}

		this.#rebuild();
	}

	#rebuild() {
		if (!this.#heatmap) return;
		if (this.#isTimeline()) this.#resync();
		else this.#drawStatic();
	}

	#restart() {
		cancelAnimationFrame(this.#frame);
		this.#rebuild();
		if (!this.isConnected || !this.#isTimeline()) return;

		const tick = (now: number) => {
			this.#frame = requestAnimationFrame(tick);
			if (now - this.#lastFrameMs < MIN_FRAME_INTERVAL_MS) return;
			this.#lastFrameMs = now;
			this.#advance();
		};
		this.#frame = requestAnimationFrame(tick);
	}

	#drawStatic() {
		const target = this.#heatmap;
		if (!target) return;
		this.#draw(() => {
			target.multiply(0);
			const intensity = staticPointIntensity(this.#points);
			const { width, height } = target;
			const size = pointSize(width, height);
			for (const { x, y } of this.#points) {
				target.addPoint(x * width, (1 - y) * height, size, intensity);
			}
			target.update();
			target.blur();
			target.display();
		});
	}

	// Replays the trailing window of clicks so the overlay is a pure function of
	// the playhead: a seek or resize shows the same trail that playing through
	// to `atTime` would have accumulated.
	#primeTrail(atTime: number) {
		const target = this.#heatmap;
		const timeline = this.#points;
		const from = Math.max(0, atTime - TRAIL_WINDOW);
		let index = indexAtTime(timeline, from);
		if (!target) return index;

		this.#draw(() => {
			target.multiply(0);
			const { width, height } = target;
			const size = pointSize(width, height);

			for (let t = from; t < atTime; t += BUCKET_INTERVAL) {
				const until = Math.min(atTime, t + BUCKET_INTERVAL);
				target.multiply(
					Math.pow(DECAY_PER_BUCKET, (until - t) / BUCKET_INTERVAL),
				);
				target.blur();

				while (index < timeline.length && timeline[index].t <= until) {
					const { x, y } = timeline[index];
					target.addPoint(x * width, (1 - y) * height, size, INTENSITY);
					index += 1;
				}
				target.update();
			}

			target.display();
		});

		return index;
	}

	#resync() {
		this.#simTime = this.#time();
		this.#cursor = this.#primeTrail(this.#simTime);
		this.#blurDebt = 0;
	}

	#advance() {
		const target = this.#heatmap;
		if (!target) return;

		const media = this.#mediaElement();
		const videoTime = this.#time();
		const rate = media && !media.paused ? media.playbackRate : 1;
		const elapsed = videoTime - this.#simTime;

		if (elapsed < 0 || elapsed > SEEK_DELTA * rate) {
			this.#resync();
			return;
		}
		if (elapsed === 0) return;

		this.#blurDebt += elapsed;
		let blurPasses = 0;
		while (
			this.#blurDebt >= BUCKET_INTERVAL &&
			blurPasses < MAX_BLUR_PASSES_PER_FRAME
		) {
			this.#blurDebt -= BUCKET_INTERVAL;
			blurPasses += 1;
		}
		this.#blurDebt = Math.min(this.#blurDebt, BUCKET_INTERVAL);

		const timeline = this.#points;
		const firstClick = this.#cursor;
		while (
			this.#cursor < timeline.length &&
			timeline[this.#cursor].t <= videoTime
		) {
			this.#cursor += 1;
		}
		const lastClick = this.#cursor;

		this.#draw(() => {
			target.multiply(Math.pow(DECAY_PER_BUCKET, elapsed / BUCKET_INTERVAL));
			for (let pass = 0; pass < blurPasses; pass += 1) target.blur();

			const { width, height } = target;
			const size = pointSize(width, height);
			for (let i = firstClick; i < lastClick; i += 1) {
				const { x, y } = timeline[i];
				target.addPoint(x * width, (1 - y) * height, size, INTENSITY);
			}

			target.update();
			target.display();
		});

		this.#simTime = videoTime;
	}

	// The GL context can be lost mid-playback. A failed draw tears the heatmap
	// down instead of throwing on every subsequent frame.
	#draw(draw: () => void) {
		try {
			draw();
		} catch (error) {
			this.#failed = true;
			this.#destroy();
			this.#report(error);
		}
	}

	#destroy() {
		const heatmap = this.#heatmap;
		this.#heatmap = null;
		try {
			heatmap?.clear();
		} catch {
			// The browser may already have evicted the context.
		}
		this.#canvas
			.getContext("webgl")
			?.getExtension("WEBGL_lose_context")
			?.loseContext();

		// A lost context stays lost for its canvas, so a later reconnect needs a
		// fresh one.
		const canvas = this.#canvas.cloneNode() as HTMLCanvasElement;
		this.#canvas.replaceWith(canvas);
		this.#canvas = canvas;
	}

	#report(error: unknown) {
		this.dispatchEvent(new CustomEvent("heatmaperror", { detail: error }));
	}
}

if (
	typeof customElements !== "undefined" &&
	!customElements.get("lumiere-heatmap")
) {
	customElements.define("lumiere-heatmap", LumiereHeatmap);
}
