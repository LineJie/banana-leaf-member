// Kartu pengumuman — dipakai di dashboard member dan di pratinjau halaman owner,
// supaya yang dilihat owner sama persis dengan yang dilihat member.
export default function AnnouncementCard({ title, body, imageUrl, buttonLabel, buttonUrl }) {
  return (
    <div className="rounded-2xl border border-gold-200 bg-white overflow-hidden">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" className="w-full h-auto block" />
      )}
      <div className="p-4">
        <h2 className="font-display text-lg text-ink">{title}</h2>
        {body && (
          <p className="font-body text-sm text-ink/70 mt-1 whitespace-pre-line break-words">{body}</p>
        )}
        {buttonLabel && buttonUrl && (
          <a
            href={buttonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-block mt-3 rounded-lg bg-leaf-700 hover:bg-leaf-800 text-white font-body text-sm font-medium px-4 py-2"
          >
            {buttonLabel}
          </a>
        )}
      </div>
    </div>
  );
}
