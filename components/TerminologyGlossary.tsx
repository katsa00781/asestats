'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { terminologySections } from '@/lib/terminology';

const renderList = (items?: string[], label?: string) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1">
      {label && <div className="text-xs text-slate-400">{label}</div>}
      <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1">
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

export function TerminologyGlossary() {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <details className="group">
          <summary className="cursor-pointer select-none">
            <CardTitle className="text-slate-50">Kosárlabda elemzési terminológiai szótár</CardTitle>
            <p className="text-xs text-slate-400 mt-1">
              Egységes fogalmi keret a csapat- és játékoselemzések értelmezéséhez.
            </p>
          </summary>
          <div className="mt-4">
            <CardContent className="space-y-4">
              {terminologySections.map(section => (
                <details key={section.id} className="rounded-lg border border-slate-800 bg-slate-950/40">
                  <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-200 flex items-center justify-between">
                    <span>{section.title}</span>
                    <span className="text-xs text-slate-400">{section.entries.length} fogalom</span>
                  </summary>
                  <div className="px-4 pb-4 space-y-3">
                    {section.entries.map(entry => (
                      <details key={entry.term} className="rounded-md border border-slate-800 bg-slate-900/60">
                        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-orange-300">
                          {entry.term}
                        </summary>
                        <div className="px-3 pb-3 space-y-2">
                          <div className="text-xs text-slate-300">{entry.definition}</div>
                          {renderList(entry.coverage, 'Statisztikai lefedés')}
                          {renderList(entry.conditions, 'Alkalmazási feltétel')}
                          {renderList(entry.metrics, 'Mutatók / Proxy mutatók')}
                          {renderList(entry.notes, 'Megjegyzés')}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </CardContent>
          </div>
        </details>
      </CardHeader>
    </Card>
  );
}