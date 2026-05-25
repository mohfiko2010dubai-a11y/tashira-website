export default function FormDecorations() {
  return (
    <>
      {/* LEFT SIDE - Floating shapes */}
      <div className="hidden xl:block fixed left-4 2xl:left-8 top-1/2 -translate-y-1/2 z-0 pointer-events-none">
        <div className="flex flex-col items-center gap-6 opacity-30">
          {/* Rotating diamond */}
          <div className="w-3 h-3 bg-[#C9A04C] rotate-45 animate-pulse" style={{ animationDuration: '3s' }} />
          {/* Line */}
          <div className="w-px h-16 bg-gradient-to-b from-[#C9A04C]/50 to-transparent" />
          {/* Small circle */}
          <div className="w-2 h-2 rounded-full border border-[#C9A04C]/40" />
          {/* Line */}
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-[#C9A04C]/30 to-transparent" />
          {/* Hexagon SVG */}
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none" className="text-[#C9A04C]/40">
            <path d="M8 0L15.794 4.5V13.5L8 18L0.206 13.5V4.5L8 0Z" stroke="currentColor" strokeWidth="1" />
          </svg>
          {/* Line */}
          <div className="w-px h-10 bg-gradient-to-b from-[#C9A04C]/30 to-transparent" />
          {/* Star */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#C9A04C]/30">
            <path d="M12 2L14.5 9.5H22L16 14L18.5 22L12 17.5L5.5 22L8 14L2 9.5H9.5L12 2Z" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
      </div>

      {/* RIGHT SIDE - Floating shapes (mirrored) */}
      <div className="hidden xl:block fixed right-4 2xl:right-8 top-1/2 -translate-y-1/2 z-0 pointer-events-none">
        <div className="flex flex-col items-center gap-6 opacity-30">
          {/* Star */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#C9A04C]/30">
            <path d="M12 2L14.5 9.5H22L16 14L18.5 22L12 17.5L5.5 22L8 14L2 9.5H9.5L12 2Z" stroke="currentColor" strokeWidth="1" />
          </svg>
          {/* Line */}
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-[#C9A04C]/30 to-transparent" />
          {/* Hexagon SVG */}
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none" className="text-[#C9A04C]/40">
            <path d="M8 0L15.794 4.5V13.5L8 18L0.206 13.5V4.5L8 0Z" stroke="currentColor" strokeWidth="1" />
          </svg>
          {/* Line */}
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-[#C9A04C]/30 to-transparent" />
          {/* Small circle */}
          <div className="w-2 h-2 rounded-full border border-[#C9A04C]/40" />
          {/* Line */}
          <div className="w-px h-16 bg-gradient-to-b from-[#C9A04C]/50 to-transparent" />
          {/* Rotating diamond */}
          <div className="w-3 h-3 bg-[#C9A04C] rotate-45 animate-pulse" style={{ animationDuration: '3s', animationDelay: '1.5s' }} />
        </div>
      </div>

      {/* Bottom decorative line across full width */}
      <div className="hidden lg:block absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A04C]/20 to-transparent pointer-events-none" />
    </>
  );
}
