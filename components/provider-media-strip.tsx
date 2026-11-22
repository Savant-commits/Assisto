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
		if (!mobile || openRef.current) return;
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
			<div className="grid grid-cols-3 gap-1.5 px-4 pb-4">
				{items.map((item, index) => (
					<button
						key={item.id}
						type="button"
						disabled={!mobile}
						aria-label={mobile ? `View ${item.media_type === "video" ? "video" : "photo"} ${index + 1}` : undefined}
						onClick={(event) => openViewer(index, event)}
						className="relative aspect-[4/3] min-w-0 overflow-hidden rounded-md bg-neutral-900 text-white disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:focus-visible:ring-0"
					>
						{item.media_type === "video" ? (
							<span className="absolute inset-0 grid place-items-center bg-neutral-900" aria-hidden="true"><Play className="size-7 fill-current text-white/90" /></span>
						) : (
							<img src={item.image_url ?? undefined} alt="" decoding="async" className="h-full w-full object-cover" />
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
