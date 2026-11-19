import { useState } from 'react';
import { Utensils } from 'lucide-react';
import { RECIPE_CATEGORY_LABELS, RecipeCategory } from '../types';

interface RecipeImageProps {
  src?: string;
  alt: string;
  category: RecipeCategory;
  className?: string;
}

export function RecipeImage({
  src,
  alt,
  category,
  className = 'w-full aspect-[4/3]',
}: RecipeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-[#1C1611] via-[#14100C] to-[#0D0A08] flex flex-col items-center justify-center p-4 text-center select-none`}
        role="img"
        aria-label={alt}
      >
        <div className="w-11 h-11 rounded-full bg-[#D9AF72]/12 border border-[#D9AF72]/35 flex items-center justify-center mb-2.5 text-[#E8C589]">
          <Utensils className="w-4 h-4" />
        </div>
        <span className="text-xs font-medium text-[#B8AEA0] tracking-wide">
          {RECIPE_CATEGORY_LABELS[category]}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover bg-[#14100C]`}
    />
  );
}
