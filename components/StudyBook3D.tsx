import React from 'react';

interface StudyBook3DProps {
  title: string;
  color: string;
  className?: string;
  preview?: React.ReactNode;
}

const getInkColor = (hex: string) => {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#fffaf0';
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const luminance = channels
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.42 ? '#473c33' : '#fffaf0';
};

/** A compact, CSS-only 3D book cover inspired by the supplied rotating-book demo. */
const StudyBook3D: React.FC<StudyBook3DProps> = ({ title, color, className = '', preview }) => (
  <div
    className={`study-book ${className}`}
    style={{ '--study-book-color': color, '--study-book-ink': getInkColor(color) } as React.CSSProperties}
    aria-label={`Caderno ${title}`}
  >
    <div className="study-book__pages" aria-hidden="true">
      <div className="study-book__page-lines" />
      {preview && <div className="study-book__preview">{preview}</div>}
    </div>
    <div className="study-book__cover">
      <div className="study-book__spine" />
      <span className="study-book__brand">ToDAHora · CADERNO</span>
      <strong className="study-book__title">{title || 'Sem título'}</strong>
    </div>
  </div>
);

export default StudyBook3D;
