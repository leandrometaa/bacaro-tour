import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function InfoPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-app pb-[calc(4rem+env(safe-area-inset-bottom))] overflow-y-auto">
      <div className="sticky top-0 z-10 bg-card border-b border-line px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg text-muted hover:bg-elev focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Indietro"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-display text-xl text-ink">Info</h1>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto w-full">
        <section>
          <h2 className="font-display text-lg text-ink mb-1">Bacaro Tour</h2>
          <p className="text-sm text-muted leading-relaxed">
            Trova bacari, osterie e locali vicino a te. I dati arrivano da
            OpenStreetMap e da dataset aperti Overture Maps (copertura
            regionale, non esaustiva).
          </p>
        </section>

        <section className="bg-card rounded-xl border border-line p-4 space-y-3 text-sm text-muted">
          <h2 className="font-semibold text-ink">Crediti e dati</h2>
          <p>
            Dati mappa e molti locali ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              OpenStreetMap contributors
            </a>
            , licenza{' '}
            <a
              href="https://opendatacommons.org/licenses/odbl/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              ODbL
            </a>
            .
          </p>
          <p>
            Locali aggiuntivi e contatti da{' '}
            <a
              href="https://overturemaps.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Overture Maps Foundation
            </a>
            . Consulta i{' '}
            <a
              href="https://docs.overturemaps.org/attribution/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              requisiti di attribuzione
            </a>{' '}
            Overture per i dataset che usi.
          </p>
          <p>
            Foto aggiuntive da Wikimedia Commons / Wikipedia quando
            disponibili. Tessere mappa © OpenStreetMap.
          </p>
          <p>
            Percorsi del Giro sono stime (linea d&apos;aria o routing
            best-effort), non navigazione pedonale certificata.
          </p>
          <p>
            Puoi migliorare orari e schede OSM con{' '}
            <a
              href="https://www.openstreetmap.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              OpenStreetMap
            </a>{' '}
            o l&apos;app StreetComplete.
          </p>
        </section>
      </div>
    </div>
  );
}
