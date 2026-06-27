"use client";

interface Props {
  title: string;
  text: string;
  url: string;
}

export function ShareButton({ title, text, url }: Props) {
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // user cancelled or clipboard unavailable
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex-1 bg-white/20 border border-white/30 text-white font-semibold py-4 rounded-2xl text-base active:scale-95 transition-transform"
    >
      Sdílet
    </button>
  );
}
