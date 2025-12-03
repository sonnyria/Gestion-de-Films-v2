
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Library, Settings, Plus, Edit2, Save, RotateCw, Loader2, AlertCircle, Trash2, X, ScanLine, Barcode, Download } from 'lucide-react';
import { movieService, getScriptUrl, setScriptUrl } from './services/movieService';
import { barcodeService } from './services/barcodeService';
import { Movie, SupportType, SUPPORT_OPTIONS } from './types';
import { Button, Input, Card, Modal, Notification, BarcodeScannerModal, getSupportIcon, getSupportColor } from './components/Components';

// --- TYPES LOCAL ---
type NotifyFunc = (msg: string, type: 'success' | 'error') => void;

// --- UTILS DE RECHERCHE FLOUE ---

// Normalise le texte : minuscules, sans accents, remplace ponctuation par espace
const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève les accents
    .replace(/[^a-z0-9\s]/g, " ") // Remplace tout ce qui n'est pas lettre/chiffre par espace
    .replace(/\s+/g, " ") // Réduit les espaces multiples
    .trim();
};

// Mots à ignorer lors de la comparaison par mots-clés
const STOP_WORDS = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'the', 'a', 'an', 'and', 'of', 'in', 'on', 'at', 'to']);

const getSignificantTokens = (text: string) => {
  return normalizeText(text)
    .split(' ')
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
};

const isFuzzyMatch = (libraryTitle: string, userQuery: string): boolean => {
  const libNorm = normalizeText(libraryTitle);
  const queryNorm = normalizeText(userQuery);

  // 1. Inclusion directe (ex: "Matrix" dans "The Matrix Reloaded")
  if (queryNorm.includes(libNorm) || libNorm.includes(queryNorm)) {
    return true;
  }

  // 2. Comparaison par mots-clés significatifs
  const libTokens = getSignificantTokens(libraryTitle);
  const queryTokens = getSignificantTokens(userQuery);

  if (libTokens.length === 0 || queryTokens.length === 0) return false;

  // Combien de mots du titre de ma bibliothèque se retrouvent dans la recherche utilisateur ?
  const matches = libTokens.filter(token => queryTokens.includes(token)).length;
  
  // Si plus de 50% des mots du titre bibliothèque sont trouvés, c'est un match.
  const ratio = matches / libTokens.length;

  return ratio >= 0.5;
};

// --- PAGES ---

const SearchPage = ({ onEditMovie, refreshTrigger }: { onEditMovie: (m: Movie) => void, refreshTrigger: number }) => {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e?: React.FormEvent, queryOverride?: string) => {
    if (e) e.preventDefault();
    let query = queryOverride !== undefined ? queryOverride : term;
    query = query.trim();
    
    if (!query) return;

    setLoading(true);
    setResults([]); // Reset visual
    
    // Détection code barre manuel
    const isManualBarcode = /^\d{8,14}$/.test(query);
    let searchTerm = query;

    // 1. Si c'est un code barre, on essaie d'abord de récupérer le titre produit
    if (isManualBarcode) {
        const productTitle = await barcodeService.getProductTitle(query);
        if (productTitle) {
            searchTerm = productTitle;
            setTerm(productTitle); // Met à jour l'input pour montrer le titre trouvé
        }
    }

    // 2. Recherche standard via API (Rapide, mais exactitude requise)
    let foundMovies: Movie[] = [];
    const serverRes = await movieService.search(searchTerm);
    
    if (serverRes.status === 'success' && serverRes.data) {
        foundMovies = serverRes.data;
    }

    // 3. FALLBACK INTELLIGENT
    if (foundMovies.length === 0) {
         const allMoviesRes = await movieService.getAll();
         if (allMoviesRes.status === 'success' && allMoviesRes.data) {
             foundMovies = allMoviesRes.data.filter(m => isFuzzyMatch(m.title, searchTerm));
         }
    }

    setResults(foundMovies);
    setSearched(true);
    setLoading(false);
  };

  const handleScanSuccess = async (code: string) => {
    setIsScanning(false);
    setTerm(code); 
    handleSearch(undefined, code);
  };

  // Re-lancer la recherche si une modification a eu lieu (suppression/edit)
  useEffect(() => {
    if (searched && term) {
        handleSearch();
    }
  }, [refreshTrigger]);

  return (
    <div className="space-y-6 pb-24">
      <BarcodeScannerModal 
        isOpen={isScanning} 
        onClose={() => setIsScanning(false)} 
        onScanSuccess={handleScanSuccess} 
      />

      <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 -mx-4 mb-4">
        <h1 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Rechercher</h1>
        
        <div className="flex gap-2">
            <form onSubmit={(e) => handleSearch(e)} className="relative flex-1 flex gap-2">
                <div className="relative flex-1">
                    <Input 
                        value={term} 
                        onChange={(e: any) => setTerm(e.target.value)} 
                        placeholder="Titre ou code-barres..." 
                        className="pl-10 pr-10"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        {/^\d{8,14}$/.test(term.trim()) ? <Barcode className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                    </div>
                    {term && (
                        <button
                            type="button"
                            onClick={() => setTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-300 transition-colors"
                            aria-label="Effacer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <Button 
                    type="submit" 
                    variant="primary" 
                    className="px-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 shadow-none text-slate-300"
                >
                    <Search className="w-5 h-5" />
                </Button>
            </form>
            
            <Button 
                type="button" 
                onClick={() => setIsScanning(true)} 
                variant="primary" 
                className="px-3"
            >
                <ScanLine className="w-5 h-5" />
            </Button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-500 text-sm">Recherche dans la collection...</p>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12 space-y-4 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 text-slate-600 mb-2">
            <Search className="w-8 h-8" />
          </div>
          <div>
            <p className="text-slate-300 font-medium">Aucun résultat trouvé</p>
            <p className="text-slate-500 text-sm">
                {/^\d{8,14}$/.test(term) ? `Code ${term} inconnu dans la liste.` : "Ce film n'est pas dans la liste."}
            </p>
          </div>
          <Button 
            onClick={() => navigate(`/add?title=${encodeURIComponent(term)}`)}
            variant="primary"
            icon={Plus}
            className="mx-auto"
          >
            Ajouter "{term}"
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {results.map((movie, idx) => (
          <MovieRow key={idx} movie={movie} onClick={() => onEditMovie(movie)} />
        ))}
      </div>
    </div>
  );
};

const LibraryPage = ({ onEditMovie, refreshTrigger }: { onEditMovie: (m: Movie) => void, refreshTrigger: number }) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SupportType>('Blu-Ray');
  const [filter, setFilter] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const res = await movieService.getAll();
    if (res.status === 'success' && res.data) {
      setMovies(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [refreshTrigger]);

  const filteredMovies = useMemo(() => {
    if (!filter) {
        return movies
            .filter(m => m.support === activeTab)
            .sort((a, b) => a.title.localeCompare(b.title));
    }
    
    return movies
      .filter(m => m.support === activeTab)
      .filter(m => isFuzzyMatch(m.title, filter))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [movies, activeTab, filter]);

  return (
    <div className="space-y-4 h-full flex flex-col pb-20">
      <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 pt-4 px-4 -mx-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-slate-100">Ma Bibliothèque</h1>
          <button onClick={fetchAll} className="p-2 text-slate-400 hover:text-blue-400 transition-colors">
            <RotateCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          {SUPPORT_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setActiveTab(opt)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === opt 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        
        {/* Filter within tab */}
        <div className="pb-4">
            <Input 
                value={filter} 
                onChange={(e:any) => setFilter(e.target.value)} 
                placeholder={`Filtrer ${activeTab}...`}
                className="py-2 text-sm"
            />
        </div>
      </div>

      {loading && movies.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3 min-h-0 flex-1">
          {filteredMovies.length === 0 ? (
             <div className="text-center py-10 text-slate-500">Aucun film dans cette catégorie.</div>
          ) : (
            filteredMovies.map((movie, idx) => (
              <MovieRow key={idx} movie={movie} onClick={() => onEditMovie(movie)} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const AddPage = ({ onAdded }: { onAdded: (msg: string, type: 'success' | 'error') => void }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTitle = searchParams.get('title') || '';
  
  const [title, setTitle] = useState(initialTitle);
  const [support, setSupport] = useState<SupportType>('Blu-Ray');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAdd = async () => {
    if (!title.trim()) return;
    setLoading(true);
    const res = await movieService.add(title, support);
    setLoading(false);
    if (res.status === 'success') {
      onAdded(`"${title}" ajouté à la collection !`, 'success');
      navigate('/library');
    } else {
      onAdded(res.message || 'Erreur lors de l\'ajout', 'error');
    }
  };

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ajouter un film</h1>
        <button onClick={() => navigate(-1)} className="text-slate-400">Annuler</button>
      </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">Titre</label>
          <Input value={title} onChange={(e: any) => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">Format</label>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORT_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setSupport(opt)}
                className={`p-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                  support === opt 
                    ? getSupportColor(opt) + ' ring-1 ring-inset ring-white/10' 
                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'
                }`}
              >
                {getSupportIcon(opt)}
                {opt}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleAdd} disabled={loading || !title} className="w-full mt-4">
          {loading ? <Loader2 className="animate-spin" /> : <><Save className="w-4 h-4" /> Enregistrer</>}
        </Button>
      </Card>
    </div>
  );
};

const ConfigPage = ({ notify, deferredPrompt, setDeferredPrompt }: { notify: NotifyFunc, deferredPrompt: any, setDeferredPrompt: any }) => {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(getScriptUrl() || '');
  }, []);

  const handleSave = () => {
    setScriptUrl(url);
    notify('Configuration sauvegardée avec succès', 'success');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        setDeferredPrompt(null);
    }
  };

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-xl font-bold">Configuration</h1>
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">URL Script Google</label>
          <Input 
            value={url} 
            onChange={(e: any) => setUrl(e.target.value)} 
            placeholder="https://script.google.com/..." 
          />
          <p className="text-xs text-slate-500">
            Entrez "demo" pour tester l'interface sans backend.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} icon={Save}>Sauvegarder</Button>
        </div>
      </Card>

      {deferredPrompt && (
        <Card className="p-4 bg-emerald-900/20 border-emerald-500/30 flex items-center justify-between">
            <div>
                <h3 className="font-semibold text-emerald-100">Installation</h3>
                <p className="text-xs text-emerald-400/80">Installer l'app sur l'écran d'accueil</p>
            </div>
            <Button onClick={handleInstall} variant="primary" className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20" icon={Download}>
                Installer
            </Button>
        </Card>
      )}

      <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-500/20 text-sm text-blue-200 space-y-2">
        <div className="flex items-center gap-2 font-bold text-blue-100">
           <AlertCircle className="w-4 h-4" /> Info Backend
        </div>
        <p>Pour toutes les fonctionnalités, le script doit gérer: <code>getAll</code>, <code>edit</code>, et <code>delete</code>.</p>
      </div>
    </div>
  );
};

// --- SHARED COMPONENTS ---

const MovieRow: React.FC<{ movie: Movie, onClick: () => void }> = ({ movie, onClick }) => (
  <Card onClick={onClick} className="p-4 flex items-center justify-between group hover:bg-slate-800 transition-all active:scale-[0.99]">
    <div className="flex items-center gap-4 overflow-hidden">
      <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center border ${getSupportColor(movie.support)}`}>
        {getSupportIcon(movie.support)}
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-slate-100 truncate pr-2 group-hover:text-blue-400 transition-colors">{movie.title}</h3>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{movie.support}</p>
      </div>
    </div>
    <div className="text-slate-600 group-hover:text-slate-400">
      <Edit2 className="w-4 h-4" />
    </div>
  </Card>
);

const BottomNav = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  
  const navItemClass = (active: boolean) => `
    flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-all duration-300
    ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}
  `;

  return (
    <nav className="fixed bottom-0 left-0 w-full h-16 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 flex justify-around items-center z-40 pb-safe">
      <Link to="/" className={navItemClass(isActive('/'))}>
        <Search className={`w-6 h-6 ${isActive('/') ? 'scale-110' : ''} transition-transform`} />
        <span>Recherche</span>
      </Link>
      <Link to="/library" className={navItemClass(isActive('/library'))}>
        <Library className={`w-6 h-6 ${isActive('/library') ? 'scale-110' : ''} transition-transform`} />
        <span>Bibliothèque</span>
      </Link>
      <Link to="/config" className={navItemClass(isActive('/config'))}>
        <Settings className={`w-6 h-6 ${isActive('/config') ? 'scale-110' : ''} transition-transform`} />
        <span>Config</span>
      </Link>
    </nav>
  );
};

// --- MAIN APP CONTAINER ---

function App() {
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0); 
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    // Capture l'événement d'installation PWA
    window.addEventListener('beforeinstallprompt', (e) => {
      // Empêche la mini-barre d'info par défaut de Chrome (optionnel)
      e.preventDefault();
      // Stocke l'événement pour le déclencher plus tard via le bouton
      setDeferredPrompt(e);
    });
  }, []);

  const notify = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };

  const openEdit = (movie: Movie) => {
    setEditingMovie(movie);
    setEditTitle(movie.title);
    setIsDeleteConfirming(false);
  };

  const triggerUpdate = () => setLastUpdate(prev => prev + 1);

  const handleSaveEdit = async () => {
    if (!editingMovie || !editTitle.trim()) return;
    setEditLoading(true);
    
    const res = await movieService.edit(editingMovie.title, editTitle, editingMovie.support);
    setEditLoading(false);
    
    if (res.status === 'success') {
      setEditingMovie(null);
      triggerUpdate();
      notify('Titre modifié avec succès', 'success');
    } else {
      notify(res.message || 'Erreur lors de la modification', 'error');
    }
  };

  const handleDelete = async () => {
    if (!editingMovie) return;
    setEditLoading(true);
    const res = await movieService.delete(editingMovie.title, editingMovie.support);
    setEditLoading(false);

    if (res.status === 'success') {
      setEditingMovie(null);
      triggerUpdate();
      notify('Film supprimé', 'success');
    } else {
      notify(res.message || 'Erreur lors de la suppression', 'error');
    }
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
        <div className="max-w-lg mx-auto min-h-screen relative px-4">
          
          {notification && (
            <Notification 
              message={notification.message} 
              type={notification.type} 
              onClose={() => setNotification(null)} 
            />
          )}

          <Routes>
            <Route path="/" element={<SearchPage onEditMovie={openEdit} refreshTrigger={lastUpdate} />} />
            <Route path="/library" element={<LibraryPage onEditMovie={openEdit} refreshTrigger={lastUpdate} />} />
            <Route path="/add" element={<AddPage onAdded={(msg, type) => { triggerUpdate(); notify(msg, type); }} />} />
            <Route path="/config" element={<ConfigPage notify={notify} deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} />} />
          </Routes>

          <BottomNav />

          <Modal 
            isOpen={!!editingMovie} 
            onClose={() => setEditingMovie(null)} 
            title="Modifier le film"
          >
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center gap-3">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${editingMovie && getSupportColor(editingMovie.support)}`}>
                    {editingMovie && getSupportIcon(editingMovie.support)}
                 </div>
                 <span className="text-sm font-mono text-slate-400">{editingMovie?.support}</span>
              </div>

              <div className="space-y-2">
                 <label className="text-sm text-slate-400">Titre</label>
                 <Input value={editTitle} onChange={(e: any) => setEditTitle(e.target.value)} />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => setEditingMovie(null)} className="flex-1">Annuler</Button>
                    <Button onClick={handleSaveEdit} disabled={editLoading} className="flex-1">
                        {editLoading ? <Loader2 className="animate-spin" /> : "Sauvegarder"}
                    </Button>
                  </div>
                  
                  <div className="border-t border-slate-800 pt-3 mt-1">
                    {!isDeleteConfirming ? (
                        <Button variant="danger" onClick={() => setIsDeleteConfirming(true)} disabled={editLoading} className="w-full text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 border-red-900/50">
                            {editLoading ? <Loader2 className="animate-spin" /> : <><Trash2 className="w-4 h-4" /> Supprimer ce film</>}
                        </Button>
                    ) : (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-fade-in">
                            <p className="text-sm text-center text-red-300 mb-3 font-medium">Êtes-vous sûr de vouloir supprimer ?</p>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => setIsDeleteConfirming(false)} className="flex-1 text-xs h-9">
                                    Annuler
                                </Button>
                                <Button variant="danger" onClick={handleDelete} disabled={editLoading} className="flex-1 bg-red-600 text-white hover:bg-red-500 border-none text-xs h-9 shadow-lg shadow-red-900/20">
                                    {editLoading ? <Loader2 className="animate-spin w-3 h-3" /> : "Oui, supprimer"}
                                </Button>
                            </div>
                        </div>
                    )}
                  </div>
              </div>
            </div>
          </Modal>

        </div>
      </div>
    </HashRouter>
  );
}

export default App;
