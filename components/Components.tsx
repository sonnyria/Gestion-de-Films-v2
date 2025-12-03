import React, { useEffect, useRef, useState } from 'react';
import { SupportType } from '../types';
import { Disc, ShoppingCart, Film, Tv, Video, CheckCircle, AlertCircle, X, Camera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// --- ICONS & UTILS ---
export const getSupportIcon = (support: SupportType) => {
  switch (support) {
    case 'à acheter': return <ShoppingCart className="w-5 h-5" />;
    case 'LASERDISC': return <Disc className="w-5 h-5" />;
    case 'DVD': return <Tv className="w-5 h-5" />;
    case 'Blu-Ray': return <Film className="w-5 h-5" />;
    default: return <Video className="w-5 h-5" />;
  }
};

export const getSupportColor = (support: SupportType) => {
  switch (support) {
    case 'Blu-Ray': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'DVD': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'LASERDISC': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    case 'à acheter': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    default: return 'text-slate-400 bg-slate-800 border-slate-700';
  }
};

// --- BASIC UI ---
export const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  icon: Icon 
}: any) => {
  const base = "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
  const variants: any = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-100"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

export const Input = ({ value, onChange, placeholder, autoFocus, className = "" }: any) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    autoFocus={autoFocus}
    className={`w-full bg-slate-900/50 border border-slate-700 text-slate-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-500 ${className}`}
  />
);

export const Card = ({ children, className = "", onClick }: any) => (
  <div 
    onClick={onClick}
    className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden ${onClick ? 'cursor-pointer active:bg-slate-800 transition-colors' : ''} ${className}`}
  >
    {children}
  </div>
);

export const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-slide-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="overflow-y-auto">
            {children}
        </div>
      </div>
    </div>
  );
};

export const Notification = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const style = type === 'success' 
    ? 'bg-emerald-500 text-white shadow-emerald-900/20' 
    : 'bg-red-500 text-white shadow-red-900/20';

  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl animate-fade-in ${style} max-w-[90vw] w-max`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const BarcodeScannerModal = ({ isOpen, onClose, onScanSuccess }: { isOpen: boolean, onClose: () => void, onScanSuccess: (code: string) => void }) => {
    const [error, setError] = useState<string>('');
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const onScanSuccessRef = useRef(onScanSuccess);

    // Keep callback ref up to date to avoid effect re-runs
    useEffect(() => {
        onScanSuccessRef.current = onScanSuccess;
    }, [onScanSuccess]);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const elementId = "reader";
        let scannerInstance: Html5Qrcode | null = null;

        const initScanner = async () => {
            // Wait for DOM to be ready (critical for React mounting timing)
            await new Promise(r => setTimeout(r, 100));
            if (!isMounted) return;
            
            const element = document.getElementById(elementId);
            if (!element) return;

            try {
                scannerInstance = new Html5Qrcode(elementId);
                scannerRef.current = scannerInstance;
                
                await scannerInstance.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    (decodedText) => {
                        if (isMounted) {
                            // Call success but don't stop here manually if it causes race conditions
                            // The parent usually closes the modal which triggers cleanup
                            onScanSuccessRef.current(decodedText);
                        }
                    },
                    (errorMessage) => {
                        // ignore
                    }
                );
            } catch (err: any) {
                if (isMounted) {
                    console.error("Scanner start error:", err);
                    if (err?.toString().includes("already under transition")) {
                        // Ignore transition errors which can happen in strict mode
                    } else {
                        setError("Impossible d'accéder à la caméra.");
                    }
                }
            }
        };

        initScanner();

        return () => {
            isMounted = false;
            if (scannerInstance) {
                scannerInstance.stop().then(() => {
                    return scannerInstance?.clear();
                }).catch(err => {
                    console.warn("Scanner stop error:", err);
                    // If stop fails, try to clear anyway
                    scannerInstance?.clear();
                });
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in">
            <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
                <h3 className="text-white font-bold flex items-center gap-2">
                    <Camera className="w-5 h-5" /> Scanner
                </h3>
                <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
            <div className="flex-1 bg-black relative flex flex-col items-center justify-center overflow-hidden">
                 <div id="reader" className="w-full max-w-md overflow-hidden rounded-lg bg-black"></div>
                 {error && (
                     <div className="mt-4 px-6 text-center absolute top-1/2 left-0 right-0 -translate-y-1/2">
                        <p className="text-red-500 mb-4 bg-red-900/20 p-3 rounded-lg border border-red-500/20">{error}</p>
                        <Button variant="secondary" onClick={onClose}>Fermer</Button>
                     </div>
                 )}
                 {!error && <p className="text-slate-400 mt-6 text-sm animate-pulse absolute bottom-10">Recherche de code-barres...</p>}
            </div>
        </div>
    );
};