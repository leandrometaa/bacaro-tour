import { Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { LocationPicker } from './components/LocationPicker';
import { AppProvider } from './context/AppContext';
import { useLocation as useAppGeoLocation } from './hooks/useLocation';
import { InfoPage } from './pages/InfoPage';
import { ListPage } from './pages/ListPage';

const MapPage = lazy(() =>
  import('./pages/MapPage').then((m) => ({ default: m.MapPage }))
);
const MyPlacesPage = lazy(() =>
  import('./pages/MyPlacesPage').then((m) => ({ default: m.MyPlacesPage }))
);
const SavedListPage = lazy(() =>
  import('./pages/SavedListPage').then((m) => ({ default: m.SavedListPage }))
);
const VenueDetailPage = lazy(() =>
  import('./pages/VenueDetailPage').then((m) => ({
    default: m.VenueDetailPage,
  }))
);
const SharedListPage = lazy(() =>
  import('./pages/SharedListPage').then((m) => ({
    default: m.SharedListPage,
  }))
);

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh flex flex-col bg-app">
      {children}
      <BottomNav />
    </div>
  );
}

/** Keep the Leaflet map mounted across tab switches to avoid remount shake. */
function LocatedRoutes() {
  const { pathname } = useLocation();
  const onMap = pathname === '/' || pathname === '';

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        className={
          onMap
            ? 'flex-1 min-h-0'
            : 'absolute inset-0 invisible pointer-events-none'
        }
        aria-hidden={!onMap}
      >
        <Suspense fallback={onMap ? <PageFallback /> : null}>
          <MapPage />
        </Suspense>
      </div>

      {!onMap && (
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="lista" element={<ListPage />} />
            <Route path="i-miei-posti" element={<MyPlacesPage />} />
            <Route path="lista-salvata/:listId" element={<SavedListPage />} />
            <Route path="giro" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )}
    </div>
  );
}

function LocatedShell() {
  const {
    coordinates,
    locationName,
    loading,
    error,
    permissionDenied,
    requestLocation,
    setManualLocation,
    clearLocation,
  } = useAppGeoLocation();

  if (!coordinates) {
    return (
      <LocationPicker
        onLocationSelect={(coords, name) => setManualLocation(coords, name)}
        onRequestGeolocation={requestLocation}
        geolocationLoading={loading}
        geolocationError={error ?? (permissionDenied ? 'Permesso negato' : null)}
      />
    );
  }

  return (
    <AppProvider
      center={coordinates}
      locationName={locationName || 'La tua posizione'}
      onChangeLocation={clearLocation}
    >
      <AppChrome>
        <LocatedRoutes />
      </AppChrome>
    </AppProvider>
  );
}

function App() {
  return (
    <BrowserRouter basename={basename === '/' ? undefined : basename}>
      <Routes>
        <Route
          path="/locale/:id"
          element={
            <AppChrome>
              <Suspense fallback={<PageFallback />}>
                <VenueDetailPage />
              </Suspense>
            </AppChrome>
          }
        />
        <Route
          path="/condivisa"
          element={
            <AppChrome>
              <Suspense fallback={<PageFallback />}>
                <SharedListPage />
              </Suspense>
            </AppChrome>
          }
        />
        <Route
          path="/info"
          element={
            <AppChrome>
              <InfoPage />
            </AppChrome>
          }
        />
        <Route path="/*" element={<LocatedShell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
