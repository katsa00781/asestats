import type { PostgameSummarySection } from '@/lib/postgame-report';
import { cn } from '@/lib/utils';

type PostgameSummaryProps = {
  sections: PostgameSummarySection[];
};

/** „Címke: szöveg” alakú pont kettébontása; hosszú vagy összetett eleje nem címke. */
const splitLabel = (item: string): { label: string | null; text: string } => {
  const match = /^([^:;]{2,60}): (.+)$/.exec(item);
  return match ? { label: match[1], text: match[2] } : { label: null, text: item };
};

/**
 * A post-game összefoglaló olvasható nézete: szakaszonként kártya, címmel és
 * pontokba szedett sorokkal. A meccs-összefoglaló és a fókusz teljes
 * szélességű, a többi szakasz két oszlopba rendeződik.
 */
export function PostgameSummary({ sections }: PostgameSummaryProps) {
  if (sections.length === 0) return null;

  return (
    <div className="stagger grid gap-3 lg:grid-cols-2">
      {sections.map((section, index) => {
        const isFocus = section.key === 'focus';
        const fullWidth = section.key === 'overview' || isFocus || section.key === 'text';
        return (
          <section
            key={`${section.key}-${section.title}`}
            className={cn(
              'animate-fade-slide-up rounded-md border bg-base/60 p-3',
              isFocus ? 'border-orange/30' : 'border-border-subtle',
              fullWidth && 'lg:col-span-2'
            )}
            style={{ ['--i' as unknown as string]: index }}
          >
            {section.title && (
              <h4 className={cn('font-display text-xs uppercase tracking-widest mb-2', isFocus ? 'text-orange' : 'text-secondary')}>
                {section.title}
              </h4>
            )}
            <ul className="space-y-1.5">
              {section.items.map(item => {
                const { label, text } = splitLabel(item);
                return (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed text-primary">
                    <span
                      aria-hidden
                      className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', isFocus ? 'bg-orange' : 'bg-cyan')}
                    />
                    <span className="min-w-0 break-words">
                      {label && <span className="font-medium text-secondary">{label}: </span>}
                      {text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
