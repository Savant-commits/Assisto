"use client";

export default function LoadingSpinner({ size = 6 }: { size?: number }) {
  const s = `${size * 4}px`;
  return (
    <div className="flex items-center justify-center">
      <div
        className="animate-spin rounded-full border-t-2 border-b-2 border-gray-300"
        style={{ width: s, height: s }}
        aria-hidden
      />
    </div>
  );
}
