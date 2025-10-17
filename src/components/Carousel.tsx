import type { ComponentChildren } from "preact";
import useEmblaCarousel from 'embla-carousel-react';

export default function Carousel({ items }: { items: ComponentChildren[] }) {
  const [ref] = useEmblaCarousel({ loop: true, align: 'start' });

  return (
    <div className="overflow-hidden" ref={ref}>
      <div className="flex gap-4">
        {items.map((c, i) => (
          <div key={i} className="min-w-[80%] md:min-w-[33%]">
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}
