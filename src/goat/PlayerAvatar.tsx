import React, { useEffect, useMemo, useState } from 'react';
import { GoatPlayer } from './types';
import { buildFallbackAvatar } from './fallbackAvatar';
import { frameImageStyle, usePhotoFrame } from './photoFrames';
import { playerPhotoUrl } from './images';

/**
 * @file PlayerAvatar.tsx
 * Vignette du joueur, cadrée en **carte sportive 3:4** avec bordure fine.
 *
 * - la photo Wikimedia est affichée entière, chargée en différé
 *   (`loading="lazy"`) et décodée en tâche de fond (`decoding="async"`) : les
 *   500 vignettes de la réserve ne bloquent ni le rendu ni le défilement ;
 * - toute erreur d'image bascule **définitivement** sur la vignette de secours
 *   (initiales + couleur de la discipline + drapeau du pays), et l'URL fautive
 *   est mémorisée pour ne pas être retentée à chaque remontage ;
 * - le conteneur garde un ratio fixe : aucun décalage de mise en page
 *   (*layout shift*) pendant le chargement ;
 * - l'image apparaît en fondu dès qu'elle est prête.
 */

interface PlayerAvatarProps {
  player: GoatPlayer;
  className?: string;
}

/**
 * URL dont le chargement a déjà échoué pendant la session : on ne redemande
 * pas l'image à chaque défilement (la réserve affiche 500 cartes).
 */
const brokenPhotos = new Set<string>();

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, className = '' }) => {
  const fallback = useMemo(
    () => buildFallbackAvatar(player.name, { sport: player.sport, countryCode: player.countryCode }),
    [player.name, player.sport, player.countryCode],
  );
  const frame = usePhotoFrame(player.id);
  const photoUrl = useMemo(() => playerPhotoUrl(player.image), [player.image]);
  const usablePhoto = photoUrl && !brokenPhotos.has(photoUrl) ? photoUrl : '';
  const [src, setSrc] = useState(usablePhoto || fallback);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    usablePhoto ? 'loading' : 'error',
  );

  useEffect(() => {
    const next = photoUrl && !brokenPhotos.has(photoUrl) ? photoUrl : '';
    setSrc(next || fallback);
    setStatus(next ? 'loading' : 'error');
  }, [photoUrl, fallback]);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b from-slate-800/80 to-slate-950 ring-1 ring-inset ring-white/10 ${className}`}
    >
      {status === 'loading' && (
        <div className="absolute inset-0 bg-slate-800 animate-pulse" aria-hidden="true" />
      )}

      <img
        src={src}
        alt={player.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        width={300}
        height={400}
        onLoad={() => setStatus('ready')}
        onError={() => {
          // Repli strict : on abandonne la photo pour la vignette dessinée.
          if (photoUrl) brokenPhotos.add(photoUrl);
          if (src !== fallback) setSrc(fallback);
          setStatus('error');
        }}
        style={frameImageStyle(status === 'error' ? null : frame)}
        className={`w-full h-full transition-opacity duration-300 ${
          status === 'ready' ? 'opacity-100 goat-fade-in' : 'opacity-0'
        }`}
      />
    </div>
  );
};
