import { useEffect, useRef, useState } from 'react';

export default function AlertaSonoro() {
  const [avisoAtivo, setAvisoAtivo] = useState(null);
  const [somLiberado, setSomLiberado] = useState(false);
  const ultimoIdRef = useRef(null);
  const audioRef = useRef(null);

  // Libera o áudio no primeiro clique
  useEffect(() => {
    const liberarSom = () => {
      setSomLiberado(true);
      if (audioRef.current) {
        audioRef.current.volume = 0;
        audioRef.current.play().then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.volume = 1;
        }).catch(() => {});
      }
      document.removeEventListener('click', liberarSom);
      document.removeEventListener('keydown', liberarSom);
    };
    document.addEventListener('click', liberarSom);
    document.addEventListener('keydown', liberarSom);
    return () => {
      document.removeEventListener('click', liberarSom);
      document.removeEventListener('keydown', liberarSom);
    };
  }, []);

  useEffect(() => {
    const verificar = async () => {
      try {
        const r = await fetch('/avisos.json?v=' + Date.now());
        const lista = await r.json();
        const arr = Array.isArray(lista) ? lista : (lista && lista.Id ? [lista] : []);
        if (arr.length === 0) return;

        const maisRecente = arr[0];
        if (ultimoIdRef.current !== maisRecente.Id) {
          ultimoIdRef.current = maisRecente.Id;
          setAvisoAtivo(maisRecente);
          if (audioRef.current && somLiberado) {
            audioRef.current.currentTime = 0;
            audioRef.current.volume = 1;
            audioRef.current.loop = true;
            audioRef.current.play().catch(e => console.log('Erro som:', e));
          }
        }
      } catch (e) {}
    };
    verificar();
    const interval = setInterval(verificar, 5000);
    return () => clearInterval(interval);
  }, [somLiberado]);

  const parar = () => {
    setAvisoAtivo(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/sounds/cirene.wav" preload="auto" />
      {avisoAtivo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-900/90 backdrop-blur-sm">
          <div className="mx-4 max-w-2xl rounded-3xl border-4 border-red-500 bg-slate-950 p-10 text-center shadow-2xl">
            <div className="mb-4 animate-pulse text-7xl">🚨</div>
            <h1 className="mb-4 text-4xl font-black uppercase tracking-wider text-red-400">
              {avisoAtivo.Titulo || 'AVISO URGENTE'}
            </h1>
            {avisoAtivo.Descricao && (
              <p className="mb-6 text-2xl text-slate-200">{avisoAtivo.Descricao}</p>
            )}
            <button
              onClick={parar}
              className="rounded-2xl bg-red-500 px-8 py-4 text-xl font-bold text-white shadow-lg hover:bg-red-600 transition"
            >
              🔇 SILENCIAR
            </button>
          </div>
        </div>
      )}
    </>
  );
}
