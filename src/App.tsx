import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { LocationPicker } from './components/LocationPicker';
import { AppProvider } from './context/AppContext';
import { useLocation } from './hooks/useLocation';
import { ListPage } from './pages/ListPage';
import { MapPage } from './pages/MapPage';
import { MyPlacesPage } from './pages/MyPlacesPage';
import { VenueDetailPage } from './pages/VenueDetailPage';

function App() {
  const {
    coordinates,
    locationName,
    loading,
    error,
    permissionDenied,
    requestLocation,
    setManualLocation,
  } = useLocation();

  const showLocationPicker =
    !coordinates && (loading || permissionDenied || error);

  if (loading && !permissionDenied && !error) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-600">Ottenimento posizione…</p>
        </div>
      </div>
    );
  }

  if (showLocationPicker || !coordinates) {
    return (
      <LocationPicker
        onLocationSelect={(coords, name) => setManualLocation(coords, name)}
        onRequestGeolocation={requestLocation}
        geolocationLoading={loading}
        geolocationError={error}
      />
    );
  }

  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

  return (
    <BrowserRouter basename={basename === '/' ? undefined : basename}>
      <AppProvider
        center={coordinates}
        locationName={locationName || 'La tua posizione'}
      >
        <div className="h-screen flex flex-col bg-surface-50">
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/lista" element={<ListPage />} />
            <Route path="/i-miei-posti" element={<MyPlacesPage />} />
            <Route path="/locale/:id" element={<VenueDetailPage />} />
          </Routes>
          <BottomNav />
          <footer className="fixed bottom-16 left-0 right-0 bg-surface-50/95 text-center py-1 border-t border-surface-100 z-40">
            <p className="text-[10px] text-surface-400">
              Dati © OpenStreetMap contributors
            </p>
          </footer>
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
