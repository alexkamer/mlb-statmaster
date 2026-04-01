import React, { useState } from 'react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  hideOnError?: boolean;
}

export const SafeImage: React.FC<SafeImageProps> = ({ 
  fallbackSrc, 
  hideOnError = false, 
  src, 
  alt, 
  className, 
  ...props 
}) => {
  const [error, setError] = useState(false);

  if (error && hideOnError) {
    return null;
  }

  const currentSrc = error && fallbackSrc ? fallbackSrc : src;

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (!error) {
           setError(true);
        }
      }}
      {...props}
    />
  );
};