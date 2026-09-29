import React from 'react';

// Small looping page-flip animation — CSS lives in index.css (.book-loader*).
// Purely decorative (aria-hidden); pair it with real loading text nearby.
const BookLoader: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`book-loader ${className}`} aria-hidden="true">
    <div className="book-loader__pg-shadow" />
    <div className="book-loader__pg" />
    <div className="book-loader__pg book-loader__pg--2" />
    <div className="book-loader__pg book-loader__pg--3" />
    <div className="book-loader__pg book-loader__pg--4" />
    <div className="book-loader__pg book-loader__pg--5" />
  </div>
);

export default BookLoader;
