"use client";

import * as React from "react";
import { Play } from "lucide-react";
import MediaViewer from "@/components/media-viewer";
import type { ProviderPortfolioItem } from "@/lib/types";

type Props = { items: ProviderPortfolioItem[]; providerName: string };
type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FullscreenRoot = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const subscribeMobile = (callback: () => void) => {
	const query = window.matchMedia("(max-width: 639px)");
	query.addEventListener("change", callback);
	return () => query.removeEventListener("change", callback);
};
const getMobileSnapshot = () => window.matchMedia("(max-width: 639px)").matches;
const getMobileServerSnapshot = () => false;

export default function ProviderMediaStrip({ items, providerName }: Props) {
	const mobile = React.useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);
	const [open, setOpen] = React.useState(false);
	const [initialIndex, setInitialIndex] = React.useState(0);
	const [trigger, setTrigger] = React.useState<HTMLElement | null>(null);
	const openRef = React.useRef(false);
	const enteredByViewerRef = React.useRef(false);
	const pendingRequestRef = React.useRef<Promise<boolean> | null>(null);
	const pointerStartsRef = React.useRef(new Map<number, { x: number; y: number }>());
	const pointerDraggedRef = React.useRef(false);

	const requestFullscreen = React.useCallback((): Promise<boolean> => {
		const doc = document as FullscreenDoc;
		if (doc.fullscreenElement || doc.webkitFullscreenElement) return Promise.resolve(true);
		if (pendingRequestRef.current) return pendingRequestRef.current;
		const root = document.documentElement as FullscreenRoot;
		let request: Promise<void>;
		try {
			if (typeof root.requestFullscreen === "function") request = Promise.resolve(root.requestFullscreen());
			else if (typeof root.webkitRequestFullscreen === "function") request = Promise.resolve(root.webkitRequestFullscreen());
			else return Promise.resolve(false);
		} catch {
			return Promise.resolve(false);
		}
		const pending = request.then(() => {
			const currentDoc = document as FullscreenDoc;
			const entered = currentDoc.fullscreenElement === root || currentDoc.webkitFullscreenElement === root;
			if (entered) {
				enteredByViewerRef.current = true;
				if (!openRef.current) {
					try {
						if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
						else if (currentDoc.webkitExitFullscreen) void Promise.resolve(currentDoc.webkitExitFullscreen()).catch(() => {});
					} catch {}
				}
			}
			return entered;
		}).catch(() => false).finally(() => {
			if (pendingRequestRef.current === pending) pendingRequestRef.current = null;
		});
		pendingRequestRef.current = pending;
		return pending;
	}, []);

	function openViewer(index: number, event: React.MouseEvent<HTMLButtonElement>) {
		const pointerDragged = pointerDraggedRef.current && event.detail !== 0;
		pointerDraggedRef.current = false;
		pointerStartsRef.current.clear();
		if (!mobile || openRef.current || pointerDragged) return;
		openRef.current = true;
		enteredByViewerRef.current = false;
		setTrigger(event.currentTarget);
		setInitialIndex(index);
		// Must stay in this click handler: fullscreen activation is gesture-gated.
		if (!(document as FullscreenDoc).fullscreenElement && !(document as FullscreenDoc).webkitFullscreenElement) {
			void requestFullscreen();
		}
		setOpen(true);
	}

	function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
		if (pointerStartsRef.current.size === 0) pointerDraggedRef.current = false;
		pointerStartsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
	}

	function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
		const start = pointerStartsRef.current.get(event.pointerId);
		if (!start || pointerDraggedRef.current) return;
		if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) pointerDraggedRef.current = true;
	}

	function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
		pointerStartsRef.current.delete(event.pointerId);
	}

	function handlePointerCancel() {
		pointerStartsRef.current.clear();
		pointerDraggedRef.current = false;
	}

	const closeViewer = React.useCallback(async () => {
		openRef.current = false;
		try {
			const doc = document as FullscreenDoc;
			const root = document.documentElement;
			if (enteredByViewerRef.current && (doc.fullscreenElement === root || doc.webkitFullscreenElement === root)) {
				try {
					if (doc.fullscreenElement === root) await document.exitFullscreen();
					else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
				} catch {}
			}
		} finally {
			enteredByViewerRef.current = false;
			setOpen(false);
		}
	}, []);

	return (
		<>
			<div
				className="relative z-10 flex touch-pan-x flex-nowrap gap-2 overflow-x-auto snap-x snap-mandatory px-4 pb-4 scrollbar-none sm:grid sm:grid-cols-3 sm:gap-1.5 sm:overflow-visible sm:snap-none"
				style={{ touchAction: mobile ? "pan-x pan-y" : "auto" }}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
			>
				{items.slice(0, 6).map((item, index) => (
					<button
						key={item.id}
						type="button"
						disabled={!mobile}
						aria-label={mobile ? `View ${item.media_type === "video" ? "video" : "photo"} ${index + 1}` : undefined}
						onClick={(event) => openViewer(index, event)}
						className={`relative z-10 aspect-[4/3] w-[calc((100%_-_1rem)_/_2.2)] shrink-0 snap-start overflow-hidden rounded-lg bg-neutral-900 text-white disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:aspect-square sm:snap-none sm:rounded-md sm:focus-visible:ring-0 ${index >= 3 ? "sm:hidden" : ""}`}
					>
						{item.media_type === "video" ? (
							<span className="absolute inset-0 grid place-items-center bg-neutral-900" aria-hidden="true"><Play className="size-7 fill-current text-white/90" /></span>
						) : (
							<img src={item.image_url ?? undefined} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
						)}
					</button>
				))}
			</div>
			<MediaViewer
				key={`${open}-${initialIndex}`}
				open={open}
				items={items}
				providerName={providerName}
				initialIndex={initialIndex}
				trigger={trigger}
				requestFullscreen={requestFullscreen}
				onClose={closeViewer}
			/>
		</>
	);
}
