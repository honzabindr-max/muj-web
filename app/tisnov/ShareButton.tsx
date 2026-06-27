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
    <button onClick={handleShare} className="t-btn-share">
      Sdílet
    </button>
  );
}
